const { pool } = require("./pool");
const { seedRbacCatalog, syncUserRolesFromLegacy } = require("../services/rbac");

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

    CREATE TABLE IF NOT EXISTS roles (
      id BIGSERIAL PRIMARY KEY,
      code VARCHAR(40) NOT NULL UNIQUE,
      name VARCHAR(120) NOT NULL,
      description VARCHAR(260) NOT NULL DEFAULT '',
      is_system BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id BIGSERIAL PRIMARY KEY,
      code VARCHAR(80) NOT NULL UNIQUE,
      name VARCHAR(140) NOT NULL,
      description VARCHAR(260) NOT NULL DEFAULT '',
      is_system BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      id BIGSERIAL PRIMARY KEY,
      role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT role_permissions_unique UNIQUE (role_id, permission_id)
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      is_primary BOOLEAN NOT NULL DEFAULT FALSE,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT user_roles_unique UNIQUE (user_id, role_id)
    );

    CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles (user_id);
    CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles (role_id);
    CREATE INDEX IF NOT EXISTS idx_user_roles_primary ON user_roles (user_id, is_primary);
    CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions (role_id);
    CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions (permission_id);

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

    CREATE TABLE IF NOT EXISTS course_modules (
      id BIGSERIAL PRIMARY KEY,
      course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title VARCHAR(180) NOT NULL,
      description VARCHAR(320) NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 1,
      is_published BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT course_modules_sort_order_check CHECK (sort_order >= 1)
    );

    CREATE INDEX IF NOT EXISTS idx_course_modules_course ON course_modules (course_id);
    CREATE INDEX IF NOT EXISTS idx_course_modules_order ON course_modules (course_id, sort_order, id);

    CREATE TABLE IF NOT EXISTS module_lessons (
      id BIGSERIAL PRIMARY KEY,
      module_id BIGINT NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
      title VARCHAR(220) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      content_type VARCHAR(30) NOT NULL DEFAULT 'text',
      content_text TEXT NOT NULL DEFAULT '',
      video_url VARCHAR(700),
      resource_url VARCHAR(700),
      duration_minutes INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 1,
      is_free_preview BOOLEAN NOT NULL DEFAULT FALSE,
      is_published BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT module_lessons_type_check CHECK (content_type IN ('video', 'text', 'file', 'mixed')),
      CONSTRAINT module_lessons_duration_check CHECK (duration_minutes >= 0),
      CONSTRAINT module_lessons_sort_order_check CHECK (sort_order >= 1)
    );

    CREATE INDEX IF NOT EXISTS idx_module_lessons_module ON module_lessons (module_id);
    CREATE INDEX IF NOT EXISTS idx_module_lessons_order ON module_lessons (module_id, sort_order, id);

    CREATE TABLE IF NOT EXISTS lesson_progress (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lesson_id BIGINT NOT NULL REFERENCES module_lessons(id) ON DELETE CASCADE,
      course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      is_completed BOOLEAN NOT NULL DEFAULT FALSE,
      time_spent_minutes INTEGER NOT NULL DEFAULT 0,
      last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT lesson_progress_unique UNIQUE (user_id, lesson_id),
      CONSTRAINT lesson_progress_time_spent_check CHECK (time_spent_minutes >= 0)
    );

    CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_course ON lesson_progress (user_id, course_id);
    CREATE INDEX IF NOT EXISTS idx_lesson_progress_course ON lesson_progress (course_id);

    CREATE TABLE IF NOT EXISTS course_progress (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      completed_lessons INTEGER NOT NULL DEFAULT 0,
      total_lessons INTEGER NOT NULL DEFAULT 0,
      progress_percent INTEGER NOT NULL DEFAULT 0,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT course_progress_unique UNIQUE (user_id, course_id),
      CONSTRAINT course_progress_completed_check CHECK (completed_lessons >= 0),
      CONSTRAINT course_progress_total_check CHECK (total_lessons >= 0),
      CONSTRAINT course_progress_percent_check CHECK (progress_percent BETWEEN 0 AND 100)
    );

    CREATE INDEX IF NOT EXISTS idx_course_progress_course ON course_progress (course_id);
    CREATE INDEX IF NOT EXISTS idx_course_progress_user ON course_progress (user_id);

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

  await pool.query(`
    ALTER TABLE courses
      ADD COLUMN IF NOT EXISTS created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

    ALTER TABLE activity_events
      ADD COLUMN IF NOT EXISTS created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
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

async function seedCourseModulesAndLessons() {
  const moduleCount = await pool.query("SELECT COUNT(*)::int AS total FROM course_modules");
  if (moduleCount.rows[0].total > 0) {
    return;
  }

  const courses = await pool.query("SELECT id, code, title FROM courses ORDER BY id ASC");
  if (courses.rowCount === 0) {
    return;
  }

  for (const course of courses.rows) {
    const moduleA = await pool.query(
      `
        INSERT INTO course_modules (course_id, title, description, sort_order, is_published)
        VALUES ($1, $2, $3, 1, TRUE)
        RETURNING id
      `,
      [course.id, `Fundamentos de ${course.title}`, "Conceptos base y objetivos del modulo."]
    );

    const moduleB = await pool.query(
      `
        INSERT INTO course_modules (course_id, title, description, sort_order, is_published)
        VALUES ($1, $2, $3, 2, TRUE)
        RETURNING id
      `,
      [course.id, `Practica de ${course.title}`, "Actividades practicas para consolidar aprendizaje."]
    );

    await pool.query(
      `
        INSERT INTO module_lessons (module_id, title, description, content_type, content_text, duration_minutes, sort_order, is_free_preview, is_published)
        VALUES
          ($1, 'Introduccion', 'Contexto inicial del curso', 'text', 'Contenido de introduccion y contexto.', 8, 1, TRUE, TRUE),
          ($1, 'Video principal', 'Explicacion audiovisual del tema', 'video', 'Revisa el video y toma notas.', 18, 2, FALSE, TRUE),
          ($2, 'Guia descargable', 'Material en PDF para repaso', 'file', 'Descarga la guia y completa los ejercicios.', 12, 1, FALSE, TRUE),
          ($2, 'Leccion mixta', 'Texto, video y recursos combinados', 'mixed', 'Integra conceptos con ejemplos aplicados.', 20, 2, FALSE, TRUE)
      `,
      [moduleA.rows[0].id, moduleB.rows[0].id]
    );
  }
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
  await seedRbacCatalog();
  await syncUserRolesFromLegacy();
  await seedCourses();
  await seedCourseModulesAndLessons();
  await seedActivityEvents();
  await seedCourseMembers();
}

module.exports = { initDatabase };
