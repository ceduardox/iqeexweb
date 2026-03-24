const express = require("express");
const { pool } = require("../db/pool");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { resolveCourseAccess } = require("../services/course-access");

const router = express.Router();
const ALLOWED_EVENT_TYPES = new Set(["task", "file", "discussion", "quiz"]);

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeEventType(value) {
  const normalized = normalizeText(value).toLowerCase();
  return ALLOWED_EVENT_TYPES.has(normalized) ? normalized : null;
}

function parseDateOrNow(value) {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function formatTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return date.toISOString().slice(11, 16);
}

async function canAccessCourseEvents(user, courseId) {
  if (user.role === "admin") {
    return true;
  }

  const access = await resolveCourseAccess(user, courseId);
  return access.exists && access.isMember;
}

async function canManageCourseEvents(user, courseId) {
  const access = await resolveCourseAccess(user, courseId);
  return access.exists && access.canManage;
}

router.get("/activities", requireAuth, requirePermission("courses.read"), async (req, res, next) => {
  try {
    const courseId = req.query.courseId ? Number(req.query.courseId) : null;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 40)));

    if (courseId !== null && (!Number.isInteger(courseId) || courseId <= 0)) {
      return res.status(400).json({ status: "error", message: "Invalid course id" });
    }

    if (req.user.role === "admin") {
      const result = await pool.query(
        `
          SELECT e.id, e.course_id, e.title, e.description, e.event_type, e.happened_at,
                 e.created_by_user_id, c.title AS course_title
          FROM activity_events e
          LEFT JOIN courses c ON c.id = e.course_id
          WHERE ($1::bigint IS NULL OR e.course_id = $1)
          ORDER BY e.happened_at DESC
          LIMIT $2
        `,
        [courseId, limit]
      );

      return res.json({
        status: "ok",
        activities: result.rows.map((row) => ({
          id: row.id,
          courseId: row.course_id,
          courseTitle: row.course_title || "General",
          title: row.title,
          description: row.description,
          eventType: row.event_type,
          time: formatTime(row.happened_at),
          happenedAt: row.happened_at,
          createdByUserId: row.created_by_user_id,
          canManage: true,
        })),
      });
    }

    let result;

    if (courseId !== null) {
      const hasAccess = await canAccessCourseEvents(req.user, courseId);
      if (!hasAccess) {
        return res.status(403).json({ status: "error", message: "You are not allowed to view this course activity" });
      }

      result = await pool.query(
        `
          SELECT e.id, e.course_id, e.title, e.description, e.event_type, e.happened_at,
                 e.created_by_user_id, c.title AS course_title
          FROM activity_events e
          INNER JOIN courses c ON c.id = e.course_id
          WHERE e.course_id = $1
          ORDER BY e.happened_at DESC
          LIMIT $2
        `,
        [courseId, limit]
      );
    } else {
      result = await pool.query(
        `
          SELECT e.id, e.course_id, e.title, e.description, e.event_type, e.happened_at,
                 e.created_by_user_id, c.title AS course_title
          FROM activity_events e
          INNER JOIN courses c ON c.id = e.course_id
          INNER JOIN course_members cm ON cm.course_id = c.id
          WHERE cm.user_id = $1
          ORDER BY e.happened_at DESC
          LIMIT $2
        `,
        [req.user.id, limit]
      );
    }

    const activities = [];
    for (const row of result.rows) {
      const manager = await canManageCourseEvents(req.user, row.course_id);
      activities.push({
        id: row.id,
        courseId: row.course_id,
        courseTitle: row.course_title,
        title: row.title,
        description: row.description,
        eventType: row.event_type,
        time: formatTime(row.happened_at),
        happenedAt: row.happened_at,
        createdByUserId: row.created_by_user_id,
        canManage: manager,
      });
    }

    return res.json({
      status: "ok",
      activities,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/activities", requireAuth, requirePermission("activities.manage"), async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "teacher") {
      return res.status(403).json({ status: "error", message: "You are not allowed to create activities" });
    }

    const courseId = Number(req.body.courseId);
    const title = normalizeText(req.body.title);
    const description = normalizeText(req.body.description);
    const eventType = normalizeEventType(req.body.eventType);
    const happenedAt = parseDateOrNow(req.body.happenedAt);

    if (!Number.isInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ status: "error", message: "Course id is required" });
    }

    if (title.length < 3) {
      return res.status(400).json({ status: "error", message: "Activity title must contain at least 3 characters" });
    }

    if (!eventType) {
      return res.status(400).json({ status: "error", message: "Invalid activity type" });
    }

    if (!happenedAt) {
      return res.status(400).json({ status: "error", message: "Invalid activity date" });
    }

    if (req.user.role !== "admin") {
      const canManage = await canManageCourseEvents(req.user, courseId);
      if (!canManage) {
        return res.status(403).json({ status: "error", message: "You are not allowed to create activities in this course" });
      }
    }

    const insert = await pool.query(
      `
        INSERT INTO activity_events (course_id, title, description, event_type, happened_at, created_by_user_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, course_id, title, description, event_type, happened_at, created_by_user_id
      `,
      [courseId, title, description, eventType, happenedAt, req.user.id]
    );

    const course = await pool.query("SELECT title FROM courses WHERE id = $1 LIMIT 1", [courseId]);

    return res.status(201).json({
      status: "ok",
      message: "Activity created",
      activity: {
        id: insert.rows[0].id,
        courseId: insert.rows[0].course_id,
        courseTitle: course.rowCount > 0 ? course.rows[0].title : "General",
        title: insert.rows[0].title,
        description: insert.rows[0].description,
        eventType: insert.rows[0].event_type,
        time: formatTime(insert.rows[0].happened_at),
        happenedAt: insert.rows[0].happened_at,
        createdByUserId: insert.rows[0].created_by_user_id,
        canManage: true,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/activities/:activityId", requireAuth, requirePermission("activities.manage"), async (req, res, next) => {
  try {
    const activityId = Number(req.params.activityId);
    if (!Number.isInteger(activityId) || activityId <= 0) {
      return res.status(400).json({ status: "error", message: "Invalid activity id" });
    }

    const findActivity = await pool.query(
      `
        SELECT id, course_id
        FROM activity_events
        WHERE id = $1
        LIMIT 1
      `,
      [activityId]
    );

    if (findActivity.rowCount === 0) {
      return res.status(404).json({ status: "error", message: "Activity not found" });
    }

    const activity = findActivity.rows[0];

    if (req.user.role !== "admin") {
      const canManage = await canManageCourseEvents(req.user, activity.course_id);
      if (!canManage) {
        return res.status(403).json({ status: "error", message: "You are not allowed to edit this activity" });
      }
    }

    const updates = [];
    const values = [];

    const title = normalizeText(req.body.title);
    if (title) {
      if (title.length < 3) {
        return res.status(400).json({ status: "error", message: "Activity title must contain at least 3 characters" });
      }

      values.push(title);
      updates.push(`title = $${values.length}`);
    }

    if (req.body.description !== undefined) {
      values.push(normalizeText(req.body.description));
      updates.push(`description = $${values.length}`);
    }

    if (req.body.eventType !== undefined) {
      const eventType = normalizeEventType(req.body.eventType);
      if (!eventType) {
        return res.status(400).json({ status: "error", message: "Invalid activity type" });
      }

      values.push(eventType);
      updates.push(`event_type = $${values.length}`);
    }

    if (req.body.happenedAt !== undefined) {
      const happenedAt = parseDateOrNow(req.body.happenedAt);
      if (!happenedAt) {
        return res.status(400).json({ status: "error", message: "Invalid activity date" });
      }

      values.push(happenedAt);
      updates.push(`happened_at = $${values.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ status: "error", message: "No valid fields to update" });
    }

    values.push(activityId);

    const updateResult = await pool.query(
      `
        UPDATE activity_events
        SET ${updates.join(", ")}
        WHERE id = $${values.length}
        RETURNING id, course_id, title, description, event_type, happened_at, created_by_user_id
      `,
      values
    );

    const course = await pool.query("SELECT title FROM courses WHERE id = $1 LIMIT 1", [updateResult.rows[0].course_id]);

    return res.json({
      status: "ok",
      message: "Activity updated",
      activity: {
        id: updateResult.rows[0].id,
        courseId: updateResult.rows[0].course_id,
        courseTitle: course.rowCount > 0 ? course.rows[0].title : "General",
        title: updateResult.rows[0].title,
        description: updateResult.rows[0].description,
        eventType: updateResult.rows[0].event_type,
        time: formatTime(updateResult.rows[0].happened_at),
        happenedAt: updateResult.rows[0].happened_at,
        createdByUserId: updateResult.rows[0].created_by_user_id,
        canManage: true,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.delete("/activities/:activityId", requireAuth, requirePermission("activities.manage"), async (req, res, next) => {
  try {
    const activityId = Number(req.params.activityId);
    if (!Number.isInteger(activityId) || activityId <= 0) {
      return res.status(400).json({ status: "error", message: "Invalid activity id" });
    }

    const findActivity = await pool.query(
      `
        SELECT id, course_id
        FROM activity_events
        WHERE id = $1
        LIMIT 1
      `,
      [activityId]
    );

    if (findActivity.rowCount === 0) {
      return res.status(404).json({ status: "error", message: "Activity not found" });
    }

    const activity = findActivity.rows[0];

    if (req.user.role !== "admin") {
      const canManage = await canManageCourseEvents(req.user, activity.course_id);
      if (!canManage) {
        return res.status(403).json({ status: "error", message: "You are not allowed to delete this activity" });
      }
    }

    await pool.query("DELETE FROM activity_events WHERE id = $1", [activityId]);

    return res.json({
      status: "ok",
      message: "Activity deleted",
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

