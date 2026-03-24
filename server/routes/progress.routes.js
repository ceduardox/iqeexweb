const express = require("express");
const { pool } = require("../db/pool");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { resolveCourseAccess } = require("../services/course-access");

const router = express.Router();

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

function parseDuration(value) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const num = Number(value);
  if (!Number.isInteger(num) || num < 0) {
    return null;
  }

  return num;
}

function canReadCourseProgress(user, access) {
  if (!access.exists) {
    return false;
  }

  if (user.role === "admin") {
    return true;
  }

  return access.isMember || access.canManage;
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

async function recalculateCourseProgress(userId, courseId) {
  const totals = await pool.query(
    `
      SELECT
        COALESCE(total.total_lessons, 0)::int AS total_lessons,
        COALESCE(done.completed_lessons, 0)::int AS completed_lessons
      FROM (
        SELECT COUNT(*)::int AS total_lessons
        FROM module_lessons l
        INNER JOIN course_modules m ON m.id = l.module_id
        WHERE m.course_id = $1
          AND l.is_published = TRUE
      ) AS total
      CROSS JOIN (
        SELECT COUNT(*)::int AS completed_lessons
        FROM lesson_progress lp
        INNER JOIN module_lessons l ON l.id = lp.lesson_id
        INNER JOIN course_modules m ON m.id = l.module_id
        WHERE lp.user_id = $2
          AND m.course_id = $1
          AND lp.is_completed = TRUE
      ) AS done
    `,
    [courseId, userId]
  );

  const totalLessons = Number(totals.rows[0].total_lessons || 0);
  const completedLessons = Number(totals.rows[0].completed_lessons || 0);
  const progressPercent = totalLessons > 0 ? Math.min(100, Math.round((completedLessons * 100) / totalLessons)) : 0;

  const upsert = await pool.query(
    `
      INSERT INTO course_progress (
        user_id,
        course_id,
        completed_lessons,
        total_lessons,
        progress_percent,
        started_at,
        completed_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        CASE WHEN $3 > 0 THEN NOW() ELSE NULL END,
        CASE WHEN $5 >= 100 AND $4 > 0 THEN NOW() ELSE NULL END,
        NOW()
      )
      ON CONFLICT (user_id, course_id) DO UPDATE
      SET completed_lessons = EXCLUDED.completed_lessons,
          total_lessons = EXCLUDED.total_lessons,
          progress_percent = EXCLUDED.progress_percent,
          started_at = COALESCE(course_progress.started_at, CASE WHEN EXCLUDED.completed_lessons > 0 THEN NOW() ELSE NULL END),
          completed_at = CASE
            WHEN EXCLUDED.progress_percent >= 100 AND EXCLUDED.total_lessons > 0 THEN COALESCE(course_progress.completed_at, NOW())
            ELSE NULL
          END,
          updated_at = NOW()
      RETURNING user_id, course_id, completed_lessons, total_lessons, progress_percent, started_at, completed_at, updated_at
    `,
    [userId, courseId, completedLessons, totalLessons, progressPercent]
  );

  return {
    userId,
    courseId,
    completedLessons,
    totalLessons,
    progressPercent,
    startedAt: upsert.rows[0].started_at,
    completedAt: upsert.rows[0].completed_at,
    updatedAt: upsert.rows[0].updated_at,
  };
}

router.get("/courses/:courseId/progress/me", requireAuth, requirePermission("courses.read"), async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ status: "error", message: "Invalid course id" });
    }

    const access = await resolveCourseAccess(req.user, courseId);
    if (!access.exists) {
      return res.status(404).json({ status: "error", message: "Course not found" });
    }

    if (!canReadCourseProgress(req.user, access)) {
      return res.status(403).json({ status: "error", message: "You are not allowed to view course progress" });
    }

    const progress = await recalculateCourseProgress(req.user.id, courseId);

    const lessons = await pool.query(
      `
        SELECT lp.lesson_id, lp.is_completed, lp.time_spent_minutes, lp.last_viewed_at, lp.completed_at
        FROM lesson_progress lp
        WHERE lp.user_id = $1
          AND lp.course_id = $2
        ORDER BY lp.updated_at DESC
      `,
      [req.user.id, courseId]
    );

    return res.json({
      status: "ok",
      progress,
      lessons: lessons.rows.map((row) => ({
        lessonId: row.lesson_id,
        isCompleted: row.is_completed,
        timeSpentMinutes: row.time_spent_minutes,
        lastViewedAt: row.last_viewed_at,
        completedAt: row.completed_at,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/lessons/:lessonId/progress", requireAuth, requirePermission("courses.read"), async (req, res, next) => {
  try {
    const lessonId = Number(req.params.lessonId);
    if (!Number.isInteger(lessonId) || lessonId <= 0) {
      return res.status(400).json({ status: "error", message: "Invalid lesson id" });
    }

    const lessonContext = await resolveLessonContext(lessonId);
    if (!lessonContext) {
      return res.status(404).json({ status: "error", message: "Lesson not found" });
    }

    const access = await resolveCourseAccess(req.user, lessonContext.courseId);
    if (!access.exists) {
      return res.status(404).json({ status: "error", message: "Course not found" });
    }

    if (!canReadCourseProgress(req.user, access)) {
      return res.status(403).json({ status: "error", message: "You are not allowed to update progress for this lesson" });
    }

    const completedInput = parseBoolean(req.body.isCompleted);
    const isCompleted = completedInput === null ? true : completedInput;
    const timeSpent = parseDuration(req.body.timeSpentMinutes);

    if (timeSpent === null) {
      return res.status(400).json({ status: "error", message: "timeSpentMinutes must be a non-negative integer" });
    }

    const upsert = await pool.query(
      `
        INSERT INTO lesson_progress (
          user_id,
          lesson_id,
          course_id,
          is_completed,
          time_spent_minutes,
          last_viewed_at,
          completed_at,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          NOW(),
          CASE WHEN $4 = TRUE THEN NOW() ELSE NULL END,
          NOW(),
          NOW()
        )
        ON CONFLICT (user_id, lesson_id) DO UPDATE
        SET course_id = EXCLUDED.course_id,
            is_completed = EXCLUDED.is_completed,
            time_spent_minutes = GREATEST(0, lesson_progress.time_spent_minutes + EXCLUDED.time_spent_minutes),
            last_viewed_at = NOW(),
            completed_at = CASE
              WHEN EXCLUDED.is_completed = TRUE THEN COALESCE(lesson_progress.completed_at, NOW())
              ELSE NULL
            END,
            updated_at = NOW()
        RETURNING user_id, lesson_id, course_id, is_completed, time_spent_minutes, last_viewed_at, completed_at, updated_at
      `,
      [req.user.id, lessonId, lessonContext.courseId, isCompleted, timeSpent]
    );

    const progress = await recalculateCourseProgress(req.user.id, lessonContext.courseId);

    return res.json({
      status: "ok",
      message: "Lesson progress updated",
      lessonProgress: {
        lessonId: upsert.rows[0].lesson_id,
        isCompleted: upsert.rows[0].is_completed,
        timeSpentMinutes: upsert.rows[0].time_spent_minutes,
        lastViewedAt: upsert.rows[0].last_viewed_at,
        completedAt: upsert.rows[0].completed_at,
        updatedAt: upsert.rows[0].updated_at,
      },
      progress,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/courses/:courseId/progress/overview", requireAuth, requirePermission("reports.read"), async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ status: "error", message: "Invalid course id" });
    }

    const access = await resolveCourseAccess(req.user, courseId);
    if (!access.exists) {
      return res.status(404).json({ status: "error", message: "Course not found" });
    }

    if (req.user.role !== "admin" && !access.canManage) {
      return res.status(403).json({ status: "error", message: "You are not allowed to view this course progress overview" });
    }

    const membersResult = await pool.query(
      `
        SELECT u.id, u.full_name, u.email, cm.role
        FROM course_members cm
        INNER JOIN users u ON u.id = cm.user_id
        WHERE cm.course_id = $1
        ORDER BY cm.role DESC, u.full_name ASC
      `,
      [courseId]
    );

    const rows = [];
    for (const member of membersResult.rows) {
      const progress = await recalculateCourseProgress(member.id, courseId);
      rows.push({
        userId: member.id,
        fullName: member.full_name,
        email: member.email,
        memberRole: member.role,
        completedLessons: progress.completedLessons,
        totalLessons: progress.totalLessons,
        progressPercent: progress.progressPercent,
        startedAt: progress.startedAt,
        completedAt: progress.completedAt,
        updatedAt: progress.updatedAt,
      });
    }

    return res.json({
      status: "ok",
      courseId,
      rows,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
