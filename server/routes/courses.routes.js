const express = require("express");
const { pool } = require("../db/pool");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { resolveCourseAccess } = require("../services/course-access");

const router = express.Router();
const ALLOWED_MEMBER_ROLES = new Set(["student", "teacher", "assistant"]);
const ALLOWED_THEMES = new Set(["vivid", "earth"]);

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeNullableText(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeTheme(value) {
  const normalized = normalizeText(value).toLowerCase();
  return ALLOWED_THEMES.has(normalized) ? normalized : "vivid";
}

function sanitizeCode(inputTitle, inputCode) {
  const fromCode = normalizeText(inputCode).toUpperCase();
  if (fromCode) {
    return fromCode.replace(/[^A-Z0-9-]/g, "-").slice(0, 40);
  }

  const fromTitle = normalizeText(inputTitle)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);

  const suffix = String(Date.now()).slice(-5);
  return `${fromTitle || "COURSE"}-${suffix}`;
}

function parseMemberRole(value) {
  const normalized = normalizeText(value).toLowerCase() || "student";
  if (!ALLOWED_MEMBER_ROLES.has(normalized)) {
    return null;
  }

  return normalized;
}

function parseProgress(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const num = Number(value);
  if (!Number.isFinite(num)) {
    return null;
  }

  const rounded = Math.round(num);
  if (rounded < 0 || rounded > 100) {
    return null;
  }

  return rounded;
}

function parsePublished(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).toLowerCase().trim();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return null;
}

function canCreateCourse(user) {
  return user.role === "admin" || user.role === "teacher";
}

router.get("/courses", requireAuth, requirePermission("courses.read"), async (req, res, next) => {
  try {
    const scope = normalizeText(req.query.scope).toLowerCase() || "mine";
    const includeUnpublished = parsePublished(req.query.includeUnpublished) === true;

    let result;

    if (req.user.role === "admin" && scope === "all") {
      if (includeUnpublished) {
        result = await pool.query(
          `
            SELECT c.id, c.code, c.title, c.category, c.level, c.theme, c.is_published,
                   c.created_at, c.created_by_user_id,
                   COALESCE(m.member_count, 0)::int AS member_count
            FROM courses c
            LEFT JOIN (
              SELECT course_id, COUNT(*)::int AS member_count
              FROM course_members
              GROUP BY course_id
            ) m ON m.course_id = c.id
            ORDER BY c.created_at DESC
          `
        );
      } else {
        result = await pool.query(
          `
            SELECT c.id, c.code, c.title, c.category, c.level, c.theme, c.is_published,
                   c.created_at, c.created_by_user_id,
                   COALESCE(m.member_count, 0)::int AS member_count
            FROM courses c
            LEFT JOIN (
              SELECT course_id, COUNT(*)::int AS member_count
              FROM course_members
              GROUP BY course_id
            ) m ON m.course_id = c.id
            WHERE c.is_published = TRUE
            ORDER BY c.created_at DESC
          `
        );
      }

      return res.json({
        status: "ok",
        courses: result.rows.map((row) => ({
          id: row.id,
          code: row.code,
          title: row.title,
          category: row.category,
          level: row.level,
          theme: row.theme,
          isPublished: row.is_published,
          createdAt: row.created_at,
          createdByUserId: row.created_by_user_id,
          memberCount: row.member_count,
          memberRole: null,
          progressPercent: null,
          canManage: true,
        })),
      });
    }

    result = await pool.query(
      `
        SELECT c.id, c.code, c.title, c.category, c.level, c.theme, c.is_published,
               c.created_at, c.created_by_user_id,
               cm.role AS member_role, cm.progress_percent,
               COALESCE(m.member_count, 0)::int AS member_count
        FROM courses c
        INNER JOIN course_members cm ON cm.course_id = c.id
        LEFT JOIN (
          SELECT course_id, COUNT(*)::int AS member_count
          FROM course_members
          GROUP BY course_id
        ) m ON m.course_id = c.id
        WHERE cm.user_id = $1
          AND ($2::boolean = TRUE OR c.is_published = TRUE)
        ORDER BY c.created_at DESC
      `,
      [req.user.id, includeUnpublished]
    );

    return res.json({
      status: "ok",
      courses: result.rows.map((row) => {
        const isOwner = row.created_by_user_id != null && Number(row.created_by_user_id) === Number(req.user.id);
        const teacherLike = row.member_role === "teacher" || row.member_role === "assistant";
        const canManage = req.user.role === "admin" || isOwner || teacherLike;

        return {
          id: row.id,
          code: row.code,
          title: row.title,
          category: row.category,
          level: row.level,
          theme: row.theme,
          isPublished: row.is_published,
          createdAt: row.created_at,
          createdByUserId: row.created_by_user_id,
          memberCount: row.member_count,
          memberRole: row.member_role,
          progressPercent: row.progress_percent,
          canManage,
        };
      }),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/courses", requireAuth, requirePermission("courses.create"), async (req, res, next) => {
  try {
    if (!canCreateCourse(req.user)) {
      return res.status(403).json({ status: "error", message: "You are not allowed to create courses" });
    }

    const title = normalizeText(req.body.title);
    const code = sanitizeCode(title, req.body.code);
    const category = normalizeText(req.body.category) || "General";
    const level = normalizeText(req.body.level) || "Beginner";
    const theme = normalizeTheme(req.body.theme);
    const isPublished = parsePublished(req.body.isPublished);

    if (title.length < 3) {
      return res.status(400).json({ status: "error", message: "Course title must contain at least 3 characters" });
    }

    const insert = await pool.query(
      `
        INSERT INTO courses (code, title, category, level, theme, is_published, created_by_user_id)
        VALUES ($1, $2, $3, $4, $5, COALESCE($6, TRUE), $7)
        RETURNING id, code, title, category, level, theme, is_published, created_at, created_by_user_id
      `,
      [code, title, category, level, theme, isPublished, req.user.id]
    );

    const course = insert.rows[0];

    if (req.user.role === "teacher") {
      await pool.query(
        `
          INSERT INTO course_members (user_id, course_id, role, progress_percent)
          VALUES ($1, $2, 'teacher', 100)
          ON CONFLICT (user_id, course_id) DO UPDATE
          SET role = EXCLUDED.role,
              progress_percent = EXCLUDED.progress_percent
        `,
        [req.user.id, course.id]
      );
    }

    return res.status(201).json({
      status: "ok",
      message: "Course created",
      course: {
        id: course.id,
        code: course.code,
        title: course.title,
        category: course.category,
        level: course.level,
        theme: course.theme,
        isPublished: course.is_published,
        createdAt: course.created_at,
        createdByUserId: course.created_by_user_id,
      },
    });
  } catch (error) {
    if (error && error.code === "23505") {
      return res.status(409).json({ status: "error", message: "Course code already exists" });
    }

    return next(error);
  }
});

router.patch("/courses/:courseId", requireAuth, requirePermission("courses.update"), async (req, res, next) => {
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
      return res.status(403).json({ status: "error", message: "You are not allowed to edit this course" });
    }

    const updates = [];
    const values = [];

    const title = normalizeNullableText(req.body.title);
    if (title !== null) {
      if (title.length < 3) {
        return res.status(400).json({ status: "error", message: "Course title must contain at least 3 characters" });
      }

      values.push(title);
      updates.push(`title = $${values.length}`);
    }

    const category = normalizeNullableText(req.body.category);
    if (category !== null) {
      values.push(category);
      updates.push(`category = $${values.length}`);
    }

    const level = normalizeNullableText(req.body.level);
    if (level !== null) {
      values.push(level);
      updates.push(`level = $${values.length}`);
    }

    if (req.body.theme !== undefined) {
      values.push(normalizeTheme(req.body.theme));
      updates.push(`theme = $${values.length}`);
    }

    const isPublished = parsePublished(req.body.isPublished);
    if (isPublished !== null) {
      values.push(isPublished);
      updates.push(`is_published = $${values.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ status: "error", message: "No valid fields to update" });
    }

    updates.push(`updated_at = NOW()`);
    values.push(courseId);

    const updateResult = await pool.query(
      `
        UPDATE courses
        SET ${updates.join(", ")}
        WHERE id = $${values.length}
        RETURNING id, code, title, category, level, theme, is_published, created_at, created_by_user_id, updated_at
      `,
      values
    );

    return res.json({
      status: "ok",
      message: "Course updated",
      course: {
        id: updateResult.rows[0].id,
        code: updateResult.rows[0].code,
        title: updateResult.rows[0].title,
        category: updateResult.rows[0].category,
        level: updateResult.rows[0].level,
        theme: updateResult.rows[0].theme,
        isPublished: updateResult.rows[0].is_published,
        createdAt: updateResult.rows[0].created_at,
        createdByUserId: updateResult.rows[0].created_by_user_id,
        updatedAt: updateResult.rows[0].updated_at,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.delete("/courses/:courseId", requireAuth, requirePermission("courses.archive"), async (req, res, next) => {
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
      return res.status(403).json({ status: "error", message: "You are not allowed to archive this course" });
    }

    await pool.query(
      `
        UPDATE courses
        SET is_published = FALSE,
            updated_at = NOW()
        WHERE id = $1
      `,
      [courseId]
    );

    return res.json({
      status: "ok",
      message: "Course archived",
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/courses/:courseId/members", requireAuth, requirePermission("courses.read"), async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ status: "error", message: "Invalid course id" });
    }

    const access = await resolveCourseAccess(req.user, courseId);
    if (!access.exists) {
      return res.status(404).json({ status: "error", message: "Course not found" });
    }

    if (req.user.role !== "admin" && !access.isMember) {
      return res.status(403).json({ status: "error", message: "You are not allowed to view course members" });
    }

    const members = await pool.query(
      `
        SELECT u.id, u.full_name, u.email, cm.role, cm.progress_percent, cm.created_at
        FROM course_members cm
        INNER JOIN users u ON u.id = cm.user_id
        WHERE cm.course_id = $1
        ORDER BY cm.role DESC, u.full_name ASC
      `,
      [courseId]
    );

    return res.json({
      status: "ok",
      members: members.rows.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        role: row.role,
        progressPercent: row.progress_percent,
        joinedAt: row.created_at,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/courses/:courseId/members", requireAuth, requirePermission("members.manage"), async (req, res, next) => {
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
      return res.status(403).json({ status: "error", message: "You are not allowed to manage members in this course" });
    }

    const email = normalizeText(req.body.email).toLowerCase();
    const memberRole = parseMemberRole(req.body.role);
    const progressPercent = parseProgress(req.body.progressPercent);

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ status: "error", message: "Invalid user email" });
    }

    if (!memberRole) {
      return res.status(400).json({ status: "error", message: "Invalid member role" });
    }

    if (progressPercent === null) {
      return res.status(400).json({ status: "error", message: "Progress percent must be between 0 and 100" });
    }

    const userResult = await pool.query(
      `
        SELECT id, full_name, email, role
        FROM users
        WHERE email = $1
        LIMIT 1
      `,
      [email]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ status: "error", message: "User email not found" });
    }

    const memberUser = userResult.rows[0];

    await pool.query(
      `
        INSERT INTO course_members (user_id, course_id, role, progress_percent)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, course_id) DO UPDATE
        SET role = EXCLUDED.role,
            progress_percent = EXCLUDED.progress_percent
      `,
      [memberUser.id, courseId, memberRole, progressPercent]
    );

    return res.json({
      status: "ok",
      message: "Course member saved",
      member: {
        id: memberUser.id,
        fullName: memberUser.full_name,
        email: memberUser.email,
        role: memberRole,
        progressPercent,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.delete("/courses/:courseId/members/:memberUserId", requireAuth, requirePermission("members.manage"), async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    const memberUserId = Number(req.params.memberUserId);

    if (!Number.isInteger(courseId) || courseId <= 0 || !Number.isInteger(memberUserId) || memberUserId <= 0) {
      return res.status(400).json({ status: "error", message: "Invalid course or member id" });
    }

    const access = await resolveCourseAccess(req.user, courseId);
    if (!access.exists) {
      return res.status(404).json({ status: "error", message: "Course not found" });
    }

    if (!access.canManage) {
      return res.status(403).json({ status: "error", message: "You are not allowed to remove members from this course" });
    }

    await pool.query(
      `
        DELETE FROM course_members
        WHERE course_id = $1
          AND user_id = $2
      `,
      [courseId, memberUserId]
    );

    return res.json({
      status: "ok",
      message: "Member removed from course",
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

