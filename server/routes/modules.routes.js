const express = require("express");
const { pool } = require("../db/pool");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { resolveCourseAccess } = require("../services/course-access");

const router = express.Router();
const ALLOWED_CONTENT_TYPES = new Set(["video", "text", "file", "mixed"]);

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeNullableText(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function parsePositiveInteger(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const num = Number(value);
  if (!Number.isInteger(num) || num < 1) {
    return null;
  }

  return num;
}

function parseDuration(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const num = Number(value);
  if (!Number.isInteger(num) || num < 0) {
    return null;
  }

  return num;
}

function parseBoolean(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return null;
}

function normalizeContentType(value) {
  const normalized = normalizeText(value).toLowerCase();
  return ALLOWED_CONTENT_TYPES.has(normalized) ? normalized : null;
}

function canReadCourseContent(user, access) {
  if (!access.exists) {
    return false;
  }

  if (user.role === "admin") {
    return true;
  }

  return access.isMember || access.canManage;
}

function mapModuleRow(row, lessonsByModuleId = null) {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    description: row.description,
    sortOrder: row.sort_order,
    isPublished: row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lessons: lessonsByModuleId ? lessonsByModuleId.get(Number(row.id)) || [] : undefined,
  };
}

function mapLessonRow(row) {
  return {
    id: row.id,
    moduleId: row.module_id,
    title: row.title,
    description: row.description,
    contentType: row.content_type,
    contentText: row.content_text,
    videoUrl: row.video_url,
    resourceUrl: row.resource_url,
    durationMinutes: row.duration_minutes,
    sortOrder: row.sort_order,
    isFreePreview: row.is_free_preview,
    isPublished: row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function resolveModuleContext(moduleId) {
  const result = await pool.query(
    `
      SELECT m.id, m.course_id
      FROM course_modules m
      WHERE m.id = $1
      LIMIT 1
    `,
    [moduleId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return {
    moduleId: Number(result.rows[0].id),
    courseId: Number(result.rows[0].course_id),
  };
}

async function resolveLessonContext(lessonId) {
  const result = await pool.query(
    `
      SELECT l.id, l.module_id, m.course_id
      FROM module_lessons l
      INNER JOIN course_modules m ON m.id = l.module_id
      WHERE l.id = $1
      LIMIT 1
    `,
    [lessonId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return {
    lessonId: Number(result.rows[0].id),
    moduleId: Number(result.rows[0].module_id),
    courseId: Number(result.rows[0].course_id),
  };
}

router.get("/courses/:courseId/modules", requireAuth, requirePermission("courses.read"), async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ status: "error", message: "Invalid course id" });
    }

    const includeLessons = parseBoolean(req.query.includeLessons) === true;
    const access = await resolveCourseAccess(req.user, courseId);

    if (!access.exists) {
      return res.status(404).json({ status: "error", message: "Course not found" });
    }

    if (!canReadCourseContent(req.user, access)) {
      return res.status(403).json({ status: "error", message: "You are not allowed to view course modules" });
    }

    const modulesResult = await pool.query(
      `
        SELECT id, course_id, title, description, sort_order, is_published, created_at, updated_at
        FROM course_modules
        WHERE course_id = $1
        ORDER BY sort_order ASC, id ASC
      `,
      [courseId]
    );

    let lessonsByModuleId = null;
    if (includeLessons && modulesResult.rowCount > 0) {
      const moduleIds = modulesResult.rows.map((row) => Number(row.id));
      const lessonsResult = await pool.query(
        `
          SELECT id, module_id, title, description, content_type, content_text, video_url, resource_url,
                 duration_minutes, sort_order, is_free_preview, is_published, created_at, updated_at
          FROM module_lessons
          WHERE module_id = ANY($1::bigint[])
          ORDER BY sort_order ASC, id ASC
        `,
        [moduleIds]
      );

      lessonsByModuleId = new Map();
      for (const moduleId of moduleIds) {
        lessonsByModuleId.set(moduleId, []);
      }

      for (const lessonRow of lessonsResult.rows) {
        const moduleId = Number(lessonRow.module_id);
        if (!lessonsByModuleId.has(moduleId)) {
          lessonsByModuleId.set(moduleId, []);
        }

        lessonsByModuleId.get(moduleId).push(mapLessonRow(lessonRow));
      }
    }

    return res.json({
      status: "ok",
      courseId,
      canManage: access.canManage,
      modules: modulesResult.rows.map((row) => mapModuleRow(row, lessonsByModuleId)),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/courses/:courseId/modules", requireAuth, requirePermission("courses.update"), async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ status: "error", message: "Invalid course id" });
    }

    const access = await resolveCourseAccess(req.user, courseId);
    if (!access.exists) {
      return res.status(404).json({ status: "error", message: "Course not found" });
    }

    if (!access.canManage) {
      return res.status(403).json({ status: "error", message: "You are not allowed to create modules for this course" });
    }

    const title = normalizeText(req.body.title);
    const description = normalizeText(req.body.description);
    const parsedSortOrder = parsePositiveInteger(req.body.sortOrder);
    const publishedInput = parseBoolean(req.body.isPublished);

    if (title.length < 3) {
      return res.status(400).json({ status: "error", message: "Module title must contain at least 3 characters" });
    }

    let sortOrder = parsedSortOrder;
    if (!sortOrder) {
      const nextOrderResult = await pool.query(
        `
          SELECT COALESCE(MAX(sort_order), 0)::int + 1 AS next_order
          FROM course_modules
          WHERE course_id = $1
        `,
        [courseId]
      );
      sortOrder = Number(nextOrderResult.rows[0].next_order || 1);
    }

    const insert = await pool.query(
      `
        INSERT INTO course_modules (course_id, title, description, sort_order, is_published)
        VALUES ($1, $2, $3, $4, COALESCE($5, TRUE))
        RETURNING id, course_id, title, description, sort_order, is_published, created_at, updated_at
      `,
      [courseId, title, description, sortOrder, publishedInput]
    );

    return res.status(201).json({
      status: "ok",
      message: "Module created",
      module: mapModuleRow(insert.rows[0]),
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/modules/:moduleId", requireAuth, requirePermission("courses.update"), async (req, res, next) => {
  try {
    const moduleId = Number(req.params.moduleId);
    if (!Number.isInteger(moduleId) || moduleId <= 0) {
      return res.status(400).json({ status: "error", message: "Invalid module id" });
    }

    const context = await resolveModuleContext(moduleId);
    if (!context) {
      return res.status(404).json({ status: "error", message: "Module not found" });
    }

    const access = await resolveCourseAccess(req.user, context.courseId);
    if (!access.exists) {
      return res.status(404).json({ status: "error", message: "Course not found" });
    }

    if (!access.canManage) {
      return res.status(403).json({ status: "error", message: "You are not allowed to update this module" });
    }

    const updates = [];
    const values = [];

    if (req.body.title !== undefined) {
      const title = normalizeText(req.body.title);
      if (title.length < 3) {
        return res.status(400).json({ status: "error", message: "Module title must contain at least 3 characters" });
      }

      values.push(title);
      updates.push(`title = $${values.length}`);
    }

    if (req.body.description !== undefined) {
      values.push(normalizeText(req.body.description));
      updates.push(`description = $${values.length}`);
    }

    if (req.body.sortOrder !== undefined) {
      const sortOrder = parsePositiveInteger(req.body.sortOrder);
      if (!sortOrder) {
        return res.status(400).json({ status: "error", message: "Sort order must be a positive integer" });
      }

      values.push(sortOrder);
      updates.push(`sort_order = $${values.length}`);
    }

    if (req.body.isPublished !== undefined) {
      const isPublished = parseBoolean(req.body.isPublished);
      if (isPublished === null) {
        return res.status(400).json({ status: "error", message: "Invalid isPublished value" });
      }

      values.push(isPublished);
      updates.push(`is_published = $${values.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ status: "error", message: "No valid fields to update" });
    }

    updates.push("updated_at = NOW()");
    values.push(moduleId);

    const updateResult = await pool.query(
      `
        UPDATE course_modules
        SET ${updates.join(", ")}
        WHERE id = $${values.length}
        RETURNING id, course_id, title, description, sort_order, is_published, created_at, updated_at
      `,
      values
    );

    return res.json({
      status: "ok",
      message: "Module updated",
      module: mapModuleRow(updateResult.rows[0]),
    });
  } catch (error) {
    return next(error);
  }
});

router.delete("/modules/:moduleId", requireAuth, requirePermission("courses.update"), async (req, res, next) => {
  try {
    const moduleId = Number(req.params.moduleId);
    if (!Number.isInteger(moduleId) || moduleId <= 0) {
      return res.status(400).json({ status: "error", message: "Invalid module id" });
    }

    const context = await resolveModuleContext(moduleId);
    if (!context) {
      return res.status(404).json({ status: "error", message: "Module not found" });
    }

    const access = await resolveCourseAccess(req.user, context.courseId);
    if (!access.exists) {
      return res.status(404).json({ status: "error", message: "Course not found" });
    }

    if (!access.canManage) {
      return res.status(403).json({ status: "error", message: "You are not allowed to delete this module" });
    }

    await pool.query("DELETE FROM course_modules WHERE id = $1", [moduleId]);

    return res.json({
      status: "ok",
      message: "Module deleted",
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/modules/:moduleId/lessons", requireAuth, requirePermission("courses.read"), async (req, res, next) => {
  try {
    const moduleId = Number(req.params.moduleId);
    if (!Number.isInteger(moduleId) || moduleId <= 0) {
      return res.status(400).json({ status: "error", message: "Invalid module id" });
    }

    const context = await resolveModuleContext(moduleId);
    if (!context) {
      return res.status(404).json({ status: "error", message: "Module not found" });
    }

    const access = await resolveCourseAccess(req.user, context.courseId);
    if (!access.exists) {
      return res.status(404).json({ status: "error", message: "Course not found" });
    }

    if (!canReadCourseContent(req.user, access)) {
      return res.status(403).json({ status: "error", message: "You are not allowed to view lessons for this module" });
    }

    const lessons = await pool.query(
      `
        SELECT id, module_id, title, description, content_type, content_text, video_url, resource_url,
               duration_minutes, sort_order, is_free_preview, is_published, created_at, updated_at
        FROM module_lessons
        WHERE module_id = $1
        ORDER BY sort_order ASC, id ASC
      `,
      [moduleId]
    );

    return res.json({
      status: "ok",
      moduleId,
      canManage: access.canManage,
      lessons: lessons.rows.map(mapLessonRow),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/modules/:moduleId/lessons", requireAuth, requirePermission("courses.update"), async (req, res, next) => {
  try {
    const moduleId = Number(req.params.moduleId);
    if (!Number.isInteger(moduleId) || moduleId <= 0) {
      return res.status(400).json({ status: "error", message: "Invalid module id" });
    }

    const context = await resolveModuleContext(moduleId);
    if (!context) {
      return res.status(404).json({ status: "error", message: "Module not found" });
    }

    const access = await resolveCourseAccess(req.user, context.courseId);
    if (!access.exists) {
      return res.status(404).json({ status: "error", message: "Course not found" });
    }

    if (!access.canManage) {
      return res.status(403).json({ status: "error", message: "You are not allowed to create lessons in this module" });
    }

    const title = normalizeText(req.body.title);
    const description = normalizeText(req.body.description);
    const contentType = normalizeContentType(req.body.contentType || "text");
    const contentText = normalizeText(req.body.contentText);
    const videoUrl = normalizeNullableText(req.body.videoUrl);
    const resourceUrl = normalizeNullableText(req.body.resourceUrl);
    const durationInput = req.body.durationMinutes === undefined ? 0 : parseDuration(req.body.durationMinutes);
    const sortOrderInput = parsePositiveInteger(req.body.sortOrder);
    const isFreePreview = parseBoolean(req.body.isFreePreview);
    const isPublished = parseBoolean(req.body.isPublished);

    if (title.length < 3) {
      return res.status(400).json({ status: "error", message: "Lesson title must contain at least 3 characters" });
    }

    if (!contentType) {
      return res.status(400).json({ status: "error", message: "Invalid lesson content type" });
    }

    if (durationInput === null) {
      return res.status(400).json({ status: "error", message: "Duration must be a non-negative integer" });
    }

    let sortOrder = sortOrderInput;
    if (!sortOrder) {
      const nextOrderResult = await pool.query(
        `
          SELECT COALESCE(MAX(sort_order), 0)::int + 1 AS next_order
          FROM module_lessons
          WHERE module_id = $1
        `,
        [moduleId]
      );
      sortOrder = Number(nextOrderResult.rows[0].next_order || 1);
    }

    const insert = await pool.query(
      `
        INSERT INTO module_lessons (
          module_id, title, description, content_type, content_text, video_url, resource_url,
          duration_minutes, sort_order, is_free_preview, is_published
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, COALESCE($10, FALSE), COALESCE($11, TRUE)
        )
        RETURNING id, module_id, title, description, content_type, content_text, video_url, resource_url,
                  duration_minutes, sort_order, is_free_preview, is_published, created_at, updated_at
      `,
      [
        moduleId,
        title,
        description,
        contentType,
        contentText,
        videoUrl,
        resourceUrl,
        durationInput,
        sortOrder,
        isFreePreview,
        isPublished,
      ]
    );

    return res.status(201).json({
      status: "ok",
      message: "Lesson created",
      lesson: mapLessonRow(insert.rows[0]),
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/lessons/:lessonId", requireAuth, requirePermission("courses.update"), async (req, res, next) => {
  try {
    const lessonId = Number(req.params.lessonId);
    if (!Number.isInteger(lessonId) || lessonId <= 0) {
      return res.status(400).json({ status: "error", message: "Invalid lesson id" });
    }

    const context = await resolveLessonContext(lessonId);
    if (!context) {
      return res.status(404).json({ status: "error", message: "Lesson not found" });
    }

    const access = await resolveCourseAccess(req.user, context.courseId);
    if (!access.exists) {
      return res.status(404).json({ status: "error", message: "Course not found" });
    }

    if (!access.canManage) {
      return res.status(403).json({ status: "error", message: "You are not allowed to update this lesson" });
    }

    const updates = [];
    const values = [];

    if (req.body.title !== undefined) {
      const title = normalizeText(req.body.title);
      if (title.length < 3) {
        return res.status(400).json({ status: "error", message: "Lesson title must contain at least 3 characters" });
      }

      values.push(title);
      updates.push(`title = $${values.length}`);
    }

    if (req.body.description !== undefined) {
      values.push(normalizeText(req.body.description));
      updates.push(`description = $${values.length}`);
    }

    if (req.body.contentType !== undefined) {
      const contentType = normalizeContentType(req.body.contentType);
      if (!contentType) {
        return res.status(400).json({ status: "error", message: "Invalid lesson content type" });
      }

      values.push(contentType);
      updates.push(`content_type = $${values.length}`);
    }

    if (req.body.contentText !== undefined) {
      values.push(normalizeText(req.body.contentText));
      updates.push(`content_text = $${values.length}`);
    }

    if (req.body.videoUrl !== undefined) {
      values.push(normalizeNullableText(req.body.videoUrl));
      updates.push(`video_url = $${values.length}`);
    }

    if (req.body.resourceUrl !== undefined) {
      values.push(normalizeNullableText(req.body.resourceUrl));
      updates.push(`resource_url = $${values.length}`);
    }

    if (req.body.durationMinutes !== undefined) {
      const duration = parseDuration(req.body.durationMinutes);
      if (duration === null) {
        return res.status(400).json({ status: "error", message: "Duration must be a non-negative integer" });
      }

      values.push(duration);
      updates.push(`duration_minutes = $${values.length}`);
    }

    if (req.body.sortOrder !== undefined) {
      const sortOrder = parsePositiveInteger(req.body.sortOrder);
      if (!sortOrder) {
        return res.status(400).json({ status: "error", message: "Sort order must be a positive integer" });
      }

      values.push(sortOrder);
      updates.push(`sort_order = $${values.length}`);
    }

    if (req.body.isFreePreview !== undefined) {
      const isFreePreview = parseBoolean(req.body.isFreePreview);
      if (isFreePreview === null) {
        return res.status(400).json({ status: "error", message: "Invalid isFreePreview value" });
      }

      values.push(isFreePreview);
      updates.push(`is_free_preview = $${values.length}`);
    }

    if (req.body.isPublished !== undefined) {
      const isPublished = parseBoolean(req.body.isPublished);
      if (isPublished === null) {
        return res.status(400).json({ status: "error", message: "Invalid isPublished value" });
      }

      values.push(isPublished);
      updates.push(`is_published = $${values.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ status: "error", message: "No valid fields to update" });
    }

    updates.push("updated_at = NOW()");
    values.push(lessonId);

    const updateResult = await pool.query(
      `
        UPDATE module_lessons
        SET ${updates.join(", ")}
        WHERE id = $${values.length}
        RETURNING id, module_id, title, description, content_type, content_text, video_url, resource_url,
                  duration_minutes, sort_order, is_free_preview, is_published, created_at, updated_at
      `,
      values
    );

    return res.json({
      status: "ok",
      message: "Lesson updated",
      lesson: mapLessonRow(updateResult.rows[0]),
    });
  } catch (error) {
    return next(error);
  }
});

router.delete("/lessons/:lessonId", requireAuth, requirePermission("courses.update"), async (req, res, next) => {
  try {
    const lessonId = Number(req.params.lessonId);
    if (!Number.isInteger(lessonId) || lessonId <= 0) {
      return res.status(400).json({ status: "error", message: "Invalid lesson id" });
    }

    const context = await resolveLessonContext(lessonId);
    if (!context) {
      return res.status(404).json({ status: "error", message: "Lesson not found" });
    }

    const access = await resolveCourseAccess(req.user, context.courseId);
    if (!access.exists) {
      return res.status(404).json({ status: "error", message: "Course not found" });
    }

    if (!access.canManage) {
      return res.status(403).json({ status: "error", message: "You are not allowed to delete this lesson" });
    }

    await pool.query("DELETE FROM module_lessons WHERE id = $1", [lessonId]);

    return res.json({
      status: "ok",
      message: "Lesson deleted",
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
