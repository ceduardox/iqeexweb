const express = require("express");
const { pool } = require("../db/pool");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { resolveCourseAccess } = require("../services/course-access");

const router = express.Router();

const QUESTION_TYPES = new Set(["multiple_choice", "true_false", "short_answer"]);

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeNullableText(value) {
  const normalized = normalizeText(value);
  return normalized || null;
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

function parseNonNegativeInteger(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const num = Number(value);
  if (!Number.isInteger(num) || num < 0) {
    return null;
  }

  return num;
}

function normalizeQuestionType(value) {
  const normalized = normalizeText(value).toLowerCase();
  return QUESTION_TYPES.has(normalized) ? normalized : null;
}

function normalizeOptions(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((row) => normalizeText(row))
    .filter(Boolean)
    .slice(0, 8);
}

function normalizedAnswer(value) {
  return normalizeText(value).toLowerCase();
}

function canReadQuizContent(user, access) {
  if (!access.exists) {
    return false;
  }

  if (user.role === "admin") {
    return true;
  }

  return access.isMember || access.canManage;
}

function mapQuizRow(row) {
  return {
    id: row.id,
    courseId: row.course_id,
    moduleId: row.module_id,
    title: row.title,
    description: row.description,
    isPublished: row.is_published,
    passingScore: row.passing_score,
    allowMultipleAttempts: row.allow_multiple_attempts,
    timeLimitMinutes: row.time_limit_minutes,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    questionCount: row.question_count != null ? Number(row.question_count) : undefined,
    attemptCount: row.attempt_count != null ? Number(row.attempt_count) : undefined,
  };
}

function mapQuestionRow(row, includeCorrectAnswer = false) {
  const mapped = {
    id: row.id,
    quizId: row.quiz_id,
    prompt: row.prompt,
    questionType: row.question_type,
    options: Array.isArray(row.options_json) ? row.options_json : [],
    points: row.points,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (includeCorrectAnswer) {
    mapped.correctAnswer = row.correct_answer;
  }

  return mapped;
}

async function resolveQuizContext(quizId) {
  const result = await pool.query(
    `
      SELECT id, course_id, title, is_published, allow_multiple_attempts, passing_score
      FROM quizzes
      WHERE id = $1
      LIMIT 1
    `,
    [quizId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return {
    quizId: Number(result.rows[0].id),
    courseId: Number(result.rows[0].course_id),
    title: result.rows[0].title,
    isPublished: Boolean(result.rows[0].is_published),
    allowMultipleAttempts: Boolean(result.rows[0].allow_multiple_attempts),
    passingScore: Number(result.rows[0].passing_score || 0),
  };
}

async function resolveQuestionContext(questionId) {
  const result = await pool.query(
    `
      SELECT qn.id AS question_id, qn.quiz_id, q.course_id
      FROM quiz_questions qn
      INNER JOIN quizzes q ON q.id = qn.quiz_id
      WHERE qn.id = $1
      LIMIT 1
    `,
    [questionId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return {
    questionId: Number(result.rows[0].question_id),
    quizId: Number(result.rows[0].quiz_id),
    courseId: Number(result.rows[0].course_id),
  };
}

function evaluateQuestion(question, answerText) {
  const expected = normalizedAnswer(question.correct_answer);
  const candidate = normalizedAnswer(answerText);

  if (!candidate) {
    return false;
  }

  if (question.question_type === "short_answer") {
    return candidate === expected;
  }

  if (question.question_type === "true_false") {
    return ["true", "false"].includes(candidate) && candidate === expected;
  }

  const options = Array.isArray(question.options_json) ? question.options_json : [];
  const optionFound = options.some((option) => normalizedAnswer(option) === candidate);
  return optionFound && candidate === expected;
}

router.get("/courses/:courseId/quizzes", requireAuth, requirePermission("courses.read"), async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ status: "error", message: "Invalid course id" });
    }

    const access = await resolveCourseAccess(req.user, courseId);
    if (!access.exists) {
      return res.status(404).json({ status: "error", message: "Course not found" });
    }

    if (!canReadQuizContent(req.user, access)) {
      return res.status(403).json({ status: "error", message: "You are not allowed to view quizzes in this course" });
    }

    const includeUnpublished = parseBoolean(req.query.includeUnpublished) === true && access.canManage;

    const result = await pool.query(
      `
        SELECT q.id, q.course_id, q.module_id, q.title, q.description, q.is_published, q.passing_score,
               q.allow_multiple_attempts, q.time_limit_minutes, q.created_by_user_id, q.created_at, q.updated_at,
               COALESCE(qq.question_count, 0)::int AS question_count,
               COALESCE(qa.attempt_count, 0)::int AS attempt_count
        FROM quizzes q
        LEFT JOIN (
          SELECT quiz_id, COUNT(*)::int AS question_count
          FROM quiz_questions
          GROUP BY quiz_id
        ) qq ON qq.quiz_id = q.id
        LEFT JOIN (
          SELECT quiz_id, COUNT(*)::int AS attempt_count
          FROM quiz_attempts
          GROUP BY quiz_id
        ) qa ON qa.quiz_id = q.id
        WHERE q.course_id = $1
          AND ($2::boolean = TRUE OR q.is_published = TRUE)
        ORDER BY q.created_at DESC, q.id DESC
      `,
      [courseId, includeUnpublished]
    );

    return res.json({
      status: "ok",
      courseId,
      canManage: access.canManage,
      quizzes: result.rows.map(mapQuizRow),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/courses/:courseId/quizzes", requireAuth, requirePermission("courses.update"), async (req, res, next) => {
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
      return res.status(403).json({ status: "error", message: "You are not allowed to create quizzes in this course" });
    }

    const title = normalizeText(req.body.title);
    const description = normalizeText(req.body.description);
    const isPublished = parseBoolean(req.body.isPublished);
    const passingScoreInput = parseNonNegativeInteger(req.body.passingScore);
    const allowMultipleAttemptsInput = parseBoolean(req.body.allowMultipleAttempts);
    const timeLimitInput = parseNonNegativeInteger(req.body.timeLimitMinutes);

    let moduleId = null;
    if (req.body.moduleId !== undefined && req.body.moduleId !== null && req.body.moduleId !== "") {
      const moduleCandidate = Number(req.body.moduleId);
      if (!Number.isInteger(moduleCandidate) || moduleCandidate <= 0) {
        return res.status(400).json({ status: "error", message: "Invalid module id" });
      }

      const moduleResult = await pool.query(
        `
          SELECT id
          FROM course_modules
          WHERE id = $1
            AND course_id = $2
          LIMIT 1
        `,
        [moduleCandidate, courseId]
      );

      if (moduleResult.rowCount === 0) {
        return res.status(400).json({ status: "error", message: "Module does not belong to this course" });
      }

      moduleId = moduleCandidate;
    }

    if (title.length < 4) {
      return res.status(400).json({ status: "error", message: "Quiz title must contain at least 4 characters" });
    }

    const passingScore = passingScoreInput === null ? 60 : Math.max(0, Math.min(100, passingScoreInput));
    const allowMultipleAttempts = allowMultipleAttemptsInput === null ? true : allowMultipleAttemptsInput;
    const timeLimitMinutes = timeLimitInput === null ? 0 : timeLimitInput;

    const insert = await pool.query(
      `
        INSERT INTO quizzes (
          course_id,
          module_id,
          title,
          description,
          is_published,
          passing_score,
          allow_multiple_attempts,
          time_limit_minutes,
          created_by_user_id
        )
        VALUES ($1, $2, $3, $4, COALESCE($5, TRUE), $6, $7, $8, $9)
        RETURNING id, course_id, module_id, title, description, is_published, passing_score,
                  allow_multiple_attempts, time_limit_minutes, created_by_user_id, created_at, updated_at
      `,
      [courseId, moduleId, title, description, isPublished, passingScore, allowMultipleAttempts, timeLimitMinutes, req.user.id]
    );

    return res.status(201).json({
      status: "ok",
      message: "Quiz created",
      quiz: mapQuizRow(insert.rows[0]),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/quizzes/:quizId", requireAuth, requirePermission("courses.read"), async (req, res, next) => {
  try {
    const quizId = Number(req.params.quizId);
    if (!Number.isInteger(quizId) || quizId <= 0) {
      return res.status(400).json({ status: "error", message: "Invalid quiz id" });
    }

    const context = await resolveQuizContext(quizId);
    if (!context) {
      return res.status(404).json({ status: "error", message: "Quiz not found" });
    }

    const access = await resolveCourseAccess(req.user, context.courseId);
    if (!access.exists) {
      return res.status(404).json({ status: "error", message: "Course not found" });
    }

    if (!canReadQuizContent(req.user, access)) {
      return res.status(403).json({ status: "error", message: "You are not allowed to view this quiz" });
    }

    if (!context.isPublished && !access.canManage) {
      return res.status(403).json({ status: "error", message: "Quiz is not published yet" });
    }

    const quizResult = await pool.query(
      `
        SELECT id, course_id, module_id, title, description, is_published, passing_score,
               allow_multiple_attempts, time_limit_minutes, created_by_user_id, created_at, updated_at
        FROM quizzes
        WHERE id = $1
        LIMIT 1
      `,
      [quizId]
    );

    const questionsResult = await pool.query(
      `
        SELECT id, quiz_id, prompt, question_type, options_json, correct_answer, points, sort_order, created_at, updated_at
        FROM quiz_questions
        WHERE quiz_id = $1
        ORDER BY sort_order ASC, id ASC
      `,
      [quizId]
    );

    const attemptsSummary = await pool.query(
      `
        SELECT COUNT(*)::int AS total_attempts, COALESCE(MAX(score_percent), 0)::int AS best_score
        FROM quiz_attempts
        WHERE quiz_id = $1
          AND user_id = $2
      `,
      [quizId, req.user.id]
    );

    const latestAttempt = await pool.query(
      `
        SELECT id, score_points, total_points, score_percent, submitted_at, created_at
        FROM quiz_attempts
        WHERE quiz_id = $1
          AND user_id = $2
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `,
      [quizId, req.user.id]
    );

    const includeCorrectAnswer = access.canManage || req.user.role === "admin";

    return res.json({
      status: "ok",
      quiz: mapQuizRow(quizResult.rows[0]),
      canManage: access.canManage,
      questions: questionsResult.rows.map((row) => mapQuestionRow(row, includeCorrectAnswer)),
      mySummary: {
        totalAttempts: Number(attemptsSummary.rows[0].total_attempts || 0),
        bestScorePercent: Number(attemptsSummary.rows[0].best_score || 0),
        latestAttempt:
          latestAttempt.rowCount > 0
            ? {
                id: latestAttempt.rows[0].id,
                scorePoints: latestAttempt.rows[0].score_points,
                totalPoints: latestAttempt.rows[0].total_points,
                scorePercent: latestAttempt.rows[0].score_percent,
                submittedAt: latestAttempt.rows[0].submitted_at,
                createdAt: latestAttempt.rows[0].created_at,
              }
            : null,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/quizzes/:quizId/questions", requireAuth, requirePermission("courses.update"), async (req, res, next) => {
  try {
    const quizId = Number(req.params.quizId);
    if (!Number.isInteger(quizId) || quizId <= 0) {
      return res.status(400).json({ status: "error", message: "Invalid quiz id" });
    }

    const context = await resolveQuizContext(quizId);
    if (!context) {
      return res.status(404).json({ status: "error", message: "Quiz not found" });
    }

    const access = await resolveCourseAccess(req.user, context.courseId);
    if (!access.exists) {
      return res.status(404).json({ status: "error", message: "Course not found" });
    }

    if (!access.canManage) {
      return res.status(403).json({ status: "error", message: "You are not allowed to manage quiz questions in this course" });
    }

    const prompt = normalizeText(req.body.prompt);
    const questionType = normalizeQuestionType(req.body.questionType || "multiple_choice");
    const pointsInput = parsePositiveInteger(req.body.points);
    const sortOrderInput = parsePositiveInteger(req.body.sortOrder);

    if (prompt.length < 5) {
      return res.status(400).json({ status: "error", message: "Question prompt must contain at least 5 characters" });
    }

    if (!questionType) {
      return res.status(400).json({ status: "error", message: "Invalid question type" });
    }

    const points = pointsInput || 1;
    let sortOrder = sortOrderInput;
    if (!sortOrder) {
      const nextOrderResult = await pool.query(
        `
          SELECT COALESCE(MAX(sort_order), 0)::int + 1 AS next_order
          FROM quiz_questions
          WHERE quiz_id = $1
        `,
        [quizId]
      );
      sortOrder = Number(nextOrderResult.rows[0].next_order || 1);
    }

    let options = [];
    let correctAnswer = normalizeText(req.body.correctAnswer);

    if (questionType === "true_false") {
      options = ["true", "false"];
      correctAnswer = normalizedAnswer(correctAnswer);
      if (!["true", "false"].includes(correctAnswer)) {
        return res.status(400).json({ status: "error", message: "Correct answer must be true or false" });
      }
    } else if (questionType === "multiple_choice") {
      options = normalizeOptions(req.body.options);
      if (options.length < 2) {
        return res.status(400).json({ status: "error", message: "Multiple choice requires at least 2 options" });
      }

      const correctNormalized = normalizedAnswer(correctAnswer);
      const optionExists = options.some((option) => normalizedAnswer(option) === correctNormalized);
      if (!optionExists) {
        return res.status(400).json({ status: "error", message: "Correct answer must match one option" });
      }

      correctAnswer = correctNormalized;
    } else {
      options = [];
      if (correctAnswer.length < 1) {
        return res.status(400).json({ status: "error", message: "Short answer questions require a correct answer" });
      }
      correctAnswer = normalizedAnswer(correctAnswer);
    }

    const insert = await pool.query(
      `
        INSERT INTO quiz_questions (
          quiz_id,
          prompt,
          question_type,
          options_json,
          correct_answer,
          points,
          sort_order
        )
        VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
        RETURNING id, quiz_id, prompt, question_type, options_json, correct_answer, points, sort_order, created_at, updated_at
      `,
      [quizId, prompt, questionType, JSON.stringify(options), correctAnswer, points, sortOrder]
    );

    return res.status(201).json({
      status: "ok",
      message: "Question created",
      question: mapQuestionRow(insert.rows[0], true),
    });
  } catch (error) {
    return next(error);
  }
});

router.delete("/questions/:questionId", requireAuth, requirePermission("courses.update"), async (req, res, next) => {
  try {
    const questionId = Number(req.params.questionId);
    if (!Number.isInteger(questionId) || questionId <= 0) {
      return res.status(400).json({ status: "error", message: "Invalid question id" });
    }

    const context = await resolveQuestionContext(questionId);
    if (!context) {
      return res.status(404).json({ status: "error", message: "Question not found" });
    }

    const access = await resolveCourseAccess(req.user, context.courseId);
    if (!access.exists) {
      return res.status(404).json({ status: "error", message: "Course not found" });
    }

    if (!access.canManage) {
      return res.status(403).json({ status: "error", message: "You are not allowed to delete questions in this quiz" });
    }

    await pool.query("DELETE FROM quiz_questions WHERE id = $1", [questionId]);

    return res.json({
      status: "ok",
      message: "Question deleted",
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/quizzes/:quizId/attempts", requireAuth, requirePermission("courses.read"), async (req, res, next) => {
  try {
    const quizId = Number(req.params.quizId);
    if (!Number.isInteger(quizId) || quizId <= 0) {
      return res.status(400).json({ status: "error", message: "Invalid quiz id" });
    }

    const context = await resolveQuizContext(quizId);
    if (!context) {
      return res.status(404).json({ status: "error", message: "Quiz not found" });
    }

    const access = await resolveCourseAccess(req.user, context.courseId);
    if (!access.exists) {
      return res.status(404).json({ status: "error", message: "Course not found" });
    }

    if (!canReadQuizContent(req.user, access)) {
      return res.status(403).json({ status: "error", message: "You are not allowed to answer this quiz" });
    }

    if (!context.isPublished && !access.canManage) {
      return res.status(403).json({ status: "error", message: "Quiz is not published yet" });
    }

    if (!context.allowMultipleAttempts) {
      const attemptsCount = await pool.query(
        `
          SELECT COUNT(*)::int AS total
          FROM quiz_attempts
          WHERE quiz_id = $1
            AND user_id = $2
        `,
        [quizId, req.user.id]
      );

      if (Number(attemptsCount.rows[0].total || 0) > 0) {
        return res.status(409).json({ status: "error", message: "This quiz only allows one attempt" });
      }
    }

    const questionsResult = await pool.query(
      `
        SELECT id, quiz_id, prompt, question_type, options_json, correct_answer, points, sort_order
        FROM quiz_questions
        WHERE quiz_id = $1
        ORDER BY sort_order ASC, id ASC
      `,
      [quizId]
    );

    if (questionsResult.rowCount === 0) {
      return res.status(400).json({ status: "error", message: "Quiz has no questions" });
    }

    const submittedResponses = Array.isArray(req.body.responses) ? req.body.responses : [];
    const answerByQuestionId = new Map();
    for (const response of submittedResponses) {
      const questionId = Number(response?.questionId);
      if (!Number.isInteger(questionId) || questionId <= 0) {
        continue;
      }
      answerByQuestionId.set(questionId, normalizeNullableText(response?.answer));
    }

    let totalPoints = 0;
    let scorePoints = 0;
    const evaluatedRows = [];

    for (const question of questionsResult.rows) {
      const answerText = answerByQuestionId.get(Number(question.id)) || "";
      const isCorrect = evaluateQuestion(question, answerText);
      const questionPoints = Number(question.points || 0);
      const earnedPoints = isCorrect ? questionPoints : 0;

      totalPoints += questionPoints;
      scorePoints += earnedPoints;

      evaluatedRows.push({
        questionId: Number(question.id),
        answerText,
        isCorrect,
        earnedPoints,
      });
    }

    const scorePercent = totalPoints > 0 ? Math.round((scorePoints * 100) / totalPoints) : 0;

    const attemptInsert = await pool.query(
      `
        INSERT INTO quiz_attempts (
          quiz_id,
          user_id,
          score_points,
          total_points,
          score_percent,
          started_at,
          submitted_at,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW())
        RETURNING id, quiz_id, user_id, score_points, total_points, score_percent, submitted_at, created_at
      `,
      [quizId, req.user.id, scorePoints, totalPoints, scorePercent]
    );

    for (const row of evaluatedRows) {
      await pool.query(
        `
          INSERT INTO quiz_attempt_answers (attempt_id, question_id, answer_text, is_correct, earned_points)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [attemptInsert.rows[0].id, row.questionId, row.answerText, row.isCorrect, row.earnedPoints]
      );
    }

    return res.status(201).json({
      status: "ok",
      message: "Quiz attempt submitted",
      attempt: {
        id: attemptInsert.rows[0].id,
        quizId: attemptInsert.rows[0].quiz_id,
        userId: attemptInsert.rows[0].user_id,
        scorePoints: attemptInsert.rows[0].score_points,
        totalPoints: attemptInsert.rows[0].total_points,
        scorePercent: attemptInsert.rows[0].score_percent,
        submittedAt: attemptInsert.rows[0].submitted_at,
        passed: Number(attemptInsert.rows[0].score_percent || 0) >= context.passingScore,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/quizzes/:quizId/my-attempts", requireAuth, requirePermission("courses.read"), async (req, res, next) => {
  try {
    const quizId = Number(req.params.quizId);
    if (!Number.isInteger(quizId) || quizId <= 0) {
      return res.status(400).json({ status: "error", message: "Invalid quiz id" });
    }

    const context = await resolveQuizContext(quizId);
    if (!context) {
      return res.status(404).json({ status: "error", message: "Quiz not found" });
    }

    const access = await resolveCourseAccess(req.user, context.courseId);
    if (!access.exists) {
      return res.status(404).json({ status: "error", message: "Course not found" });
    }

    if (!canReadQuizContent(req.user, access)) {
      return res.status(403).json({ status: "error", message: "You are not allowed to view attempts for this quiz" });
    }

    const attempts = await pool.query(
      `
        SELECT id, quiz_id, user_id, score_points, total_points, score_percent, submitted_at, created_at
        FROM quiz_attempts
        WHERE quiz_id = $1
          AND user_id = $2
        ORDER BY created_at DESC, id DESC
      `,
      [quizId, req.user.id]
    );

    return res.json({
      status: "ok",
      attempts: attempts.rows.map((row) => ({
        id: row.id,
        quizId: row.quiz_id,
        userId: row.user_id,
        scorePoints: row.score_points,
        totalPoints: row.total_points,
        scorePercent: row.score_percent,
        submittedAt: row.submitted_at,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/quizzes/:quizId/results", requireAuth, requirePermission("reports.read"), async (req, res, next) => {
  try {
    const quizId = Number(req.params.quizId);
    if (!Number.isInteger(quizId) || quizId <= 0) {
      return res.status(400).json({ status: "error", message: "Invalid quiz id" });
    }

    const context = await resolveQuizContext(quizId);
    if (!context) {
      return res.status(404).json({ status: "error", message: "Quiz not found" });
    }

    const access = await resolveCourseAccess(req.user, context.courseId);
    if (!access.exists) {
      return res.status(404).json({ status: "error", message: "Course not found" });
    }

    if (req.user.role !== "admin" && !access.canManage) {
      return res.status(403).json({ status: "error", message: "You are not allowed to view quiz results" });
    }

    const latestByUser = await pool.query(
      `
        WITH ranked AS (
          SELECT a.id, a.quiz_id, a.user_id, a.score_points, a.total_points, a.score_percent, a.submitted_at, a.created_at,
                 u.full_name, u.email,
                 ROW_NUMBER() OVER (PARTITION BY a.user_id ORDER BY a.created_at DESC, a.id DESC) AS rn
          FROM quiz_attempts a
          INNER JOIN users u ON u.id = a.user_id
          WHERE a.quiz_id = $1
        )
        SELECT id, quiz_id, user_id, score_points, total_points, score_percent, submitted_at, created_at, full_name, email
        FROM ranked
        WHERE rn = 1
        ORDER BY score_percent DESC, submitted_at DESC NULLS LAST, id DESC
      `,
      [quizId]
    );

    const summary = await pool.query(
      `
        SELECT
          COUNT(*)::int AS total_attempts,
          COUNT(DISTINCT user_id)::int AS total_students,
          COALESCE(ROUND(AVG(score_percent)), 0)::int AS average_score,
          COALESCE(MAX(score_percent), 0)::int AS best_score
        FROM quiz_attempts
        WHERE quiz_id = $1
      `,
      [quizId]
    );

    return res.json({
      status: "ok",
      quizId,
      summary: {
        totalAttempts: Number(summary.rows[0].total_attempts || 0),
        totalStudents: Number(summary.rows[0].total_students || 0),
        averageScorePercent: Number(summary.rows[0].average_score || 0),
        bestScorePercent: Number(summary.rows[0].best_score || 0),
      },
      rows: latestByUser.rows.map((row) => ({
        attemptId: row.id,
        userId: row.user_id,
        fullName: row.full_name,
        email: row.email,
        scorePoints: row.score_points,
        totalPoints: row.total_points,
        scorePercent: row.score_percent,
        submittedAt: row.submitted_at,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
