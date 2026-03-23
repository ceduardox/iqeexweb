const express = require("express");
const { pool } = require("../db/pool");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const ALLOWED_EVENT_TYPES = new Set(["task", "file", "discussion", "quiz"]);

function toHm(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return date.toISOString().slice(11, 16);
}

function normalizeEventType(type) {
  if (!type) {
    return "task";
  }

  const normalized = String(type).toLowerCase();
  return ALLOWED_EVENT_TYPES.has(normalized) ? normalized : "task";
}

async function fetchCoursesForUser(user) {
  if (user.role === "admin") {
    const result = await pool.query(
      `
        SELECT id, title, level, theme, category
        FROM courses
        WHERE is_published = TRUE
        ORDER BY id
        LIMIT 8
      `
    );

    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      level: row.level,
      tone: row.theme,
      category: row.category,
      progress: null,
    }));
  }

  const result = await pool.query(
    `
      SELECT c.id, c.title, c.level, c.theme, c.category, cm.progress_percent
      FROM courses c
      INNER JOIN course_members cm ON cm.course_id = c.id
      WHERE cm.user_id = $1
        AND c.is_published = TRUE
      ORDER BY c.id
      LIMIT 8
    `,
    [user.id]
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    level: row.level,
    tone: row.theme,
    category: row.category,
    progress: row.progress_percent,
  }));
}

async function fetchTimelineForUser(user) {
  if (user.role === "admin") {
    const result = await pool.query(
      `
        SELECT e.id, e.title, e.event_type, e.happened_at, COALESCE(c.title, 'General') AS course_title
        FROM activity_events e
        LEFT JOIN courses c ON c.id = e.course_id
        ORDER BY e.happened_at DESC
        LIMIT 12
      `
    );

    return result.rows.map((row) => ({
      id: row.id,
      time: toHm(row.happened_at),
      title: row.title,
      course: row.course_title,
      type: normalizeEventType(row.event_type),
    }));
  }

  const result = await pool.query(
    `
      SELECT e.id, e.title, e.event_type, e.happened_at, c.title AS course_title
      FROM activity_events e
      INNER JOIN courses c ON c.id = e.course_id
      INNER JOIN course_members cm ON cm.course_id = c.id
      WHERE cm.user_id = $1
      ORDER BY e.happened_at DESC
      LIMIT 12
    `,
    [user.id]
  );

  return result.rows.map((row) => ({
    id: row.id,
    time: toHm(row.happened_at),
    title: row.title,
    course: row.course_title,
    type: normalizeEventType(row.event_type),
  }));
}

function buildPrimaryNav(coursesCount) {
  return [
    { key: "dashboard", label: "Dashboard", badge: null },
    { key: "calendar", label: "Calendar", badge: null },
    { key: "private-files", label: "Private files", badge: null },
    { key: "content-bank", label: "Content bank", badge: coursesCount > 0 ? String(coursesCount) : null },
  ];
}

function buildSupportNav() {
  return [
    { key: "learn-theme", label: "Learn this theme" },
    { key: "docs", label: "Documentation" },
  ];
}

function buildPrivateFiles(user) {
  const compactName = String(user.fullName || "user")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");

  return [
    `${compactName}-profile.pdf`,
    `${user.role}-workspace-notes.txt`,
    "moodle-style-dashboard-guide.pdf",
  ];
}

router.get("/dashboard/overview", requireAuth, async (req, res, next) => {
  try {
    const courses = await fetchCoursesForUser(req.user);
    const timeline = await fetchTimelineForUser(req.user);

    const categories = Array.from(new Set(courses.map((course) => course.category))).filter(Boolean);
    const tags = Array.from(
      new Set([
        ...categories.map((item) => String(item).toLowerCase()),
        req.user.role,
        "moodle",
        "lms",
        "progress",
      ])
    );

    const recentItems = timeline.slice(0, 4).map((item) => item.title);
    const privateFiles = buildPrivateFiles(req.user);

    return res.json({
      status: "ok",
      user: req.user,
      data: {
        primaryNav: buildPrimaryNav(courses.length),
        supportNav: buildSupportNav(),
        recentCourses: courses,
        timelineItems: timeline,
        tags,
        recentItems,
        privateFiles,
        categories,
      },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
