const { pool } = require("./pool");

async function createTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      full_name VARCHAR(120) NOT NULL,
      email VARCHAR(190) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role VARCHAR(30) NOT NULL DEFAULT 'student',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT users_role_check CHECK (role IN ('student', 'teacher', 'admin'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

    CREATE TABLE IF NOT EXISTS courses (
      id BIGSERIAL PRIMARY KEY,
      code VARCHAR(40) NOT NULL UNIQUE,
      title VARCHAR(180) NOT NULL,
      category VARCHAR(80) NOT NULL DEFAULT 'General',
      level VARCHAR(40) NOT NULL DEFAULT 'Beginner',
      theme VARCHAR(20) NOT NULL DEFAULT 'vivid',
      is_published BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_courses_category ON courses (category);

    CREATE TABLE IF NOT EXISTS course_members (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL DEFAULT 'student',
      progress_percent INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT course_members_unique UNIQUE (user_id, course_id),
      CONSTRAINT course_members_role_check CHECK (role IN ('student', 'teacher', 'assistant')),
      CONSTRAINT course_members_progress_check CHECK (progress_percent BETWEEN 0 AND 100)
    );

    CREATE INDEX IF NOT EXISTS idx_course_members_user ON course_members (user_id);
    CREATE INDEX IF NOT EXISTS idx_course_members_course ON course_members (course_id);

    CREATE TABLE IF NOT EXISTS activity_events (
      id BIGSERIAL PRIMARY KEY,
      course_id BIGINT REFERENCES courses(id) ON DELETE SET NULL,
      title VARCHAR(220) NOT NULL,
      description VARCHAR(320) NOT NULL DEFAULT '',
      event_type VARCHAR(30) NOT NULL DEFAULT 'task',
      happened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT activity_event_type_check CHECK (event_type IN ('task', 'file', 'discussion', 'quiz'))
    );

    CREATE INDEX IF NOT EXISTS idx_activity_events_time ON activity_events (happened_at DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_events_course ON activity_events (course_id);
  `);
}

async function seedCourses() {
  const countResult = await pool.query("SELECT COUNT(*)::int AS total FROM courses");
  if (countResult.rows[0].total > 0) {
    return;
  }

  await pool.query(
    `
      INSERT INTO courses (code, title, category, level, theme)
      VALUES
        ('BIO-101', 'Basics on Cell Biology', 'Science', 'Beginner', 'vivid'),
        ('ART-220', 'Gods and Kings: Art of Mesopotamia', 'History', 'Intermediate', 'earth'),
        ('LMS-110', 'In-build Moodle Activities', 'Technology', 'Intermediate', 'vivid'),
        ('PHO-160', 'Your Road to Better Photography', 'Creativity', 'Beginner', 'earth'),
        ('WAT-120', 'World of Water', 'Science', 'Beginner', 'earth')
      ON CONFLICT (code) DO NOTHING
    `
  );
}

async function seedActivityEvents() {
  const countResult = await pool.query("SELECT COUNT(*)::int AS total FROM activity_events");
  if (countResult.rows[0].total > 0) {
    return;
  }

  await pool.query(
    `
      INSERT INTO activity_events (course_id, title, description, event_type, happened_at)
      SELECT c.id, v.title, v.description, v.event_type, NOW() - (v.hours_back || ' hours')::interval
      FROM (
        VALUES
          ('LMS-110', 'What do you think about course completion', 'Forum prompt published for cohort A', 'discussion', 2),
          ('BIO-101', 'Biology quiz review pending', 'Quiz available for week 2', 'quiz', 5),
          ('ART-220', 'Course discussion updated', 'Teacher posted follow-up resources', 'discussion', 8),
          ('PHO-160', 'Chemistry assignment submitted', 'Assignment submitted by student', 'file', 11),
          ('WAT-120', 'End of unit assessment ready', 'Assessment unlocked for students', 'task', 26),
          ('LMS-110', 'Lecture transcript upload', 'New transcript file available', 'file', 32)
      ) AS v(code, title, description, event_type, hours_back)
      INNER JOIN courses c ON c.code = v.code
    `
  );
}

function membershipCourseCodes(role) {
  if (role === "teacher") {
    return ["BIO-101", "LMS-110", "ART-220"];
  }

  if (role === "student") {
    return ["BIO-101", "PHO-160", "WAT-120"];
  }

  return [];
}

function membershipRoleForUser(role) {
  return role === "teacher" ? "teacher" : "student";
}

function deterministicProgress(userId, courseId, role) {
  if (role === "teacher") {
    return 100;
  }

  return ((Number(userId) * 17 + Number(courseId) * 11) % 81) + 10;
}

async function seedCourseMembers() {
  const usersResult = await pool.query("SELECT id, role FROM users ORDER BY id");
  const coursesResult = await pool.query("SELECT id, code FROM courses");

  if (usersResult.rowCount === 0 || coursesResult.rowCount === 0) {
    return;
  }

  const courseByCode = new Map(coursesResult.rows.map((row) => [row.code, row.id]));

  for (const user of usersResult.rows) {
    const courseCodes = membershipCourseCodes(user.role);
    if (courseCodes.length === 0) {
      continue;
    }

    for (const code of courseCodes) {
      const courseId = courseByCode.get(code);
      if (!courseId) {
        continue;
      }

      const memberRole = membershipRoleForUser(user.role);
      const progress = deterministicProgress(user.id, courseId, user.role);

      await pool.query(
        `
          INSERT INTO course_members (user_id, course_id, role, progress_percent)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (user_id, course_id) DO NOTHING
        `,
        [user.id, courseId, memberRole, progress]
      );
    }
  }
}

async function initDatabase() {
  await createTables();
  await seedCourses();
  await seedActivityEvents();
  await seedCourseMembers();
}

module.exports = { initDatabase };
