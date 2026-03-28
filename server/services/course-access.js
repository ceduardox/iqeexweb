const { pool } = require("../db/pool");

async function resolveCourseAccess(user, courseId) {
  const result = await pool.query(
    `
      SELECT c.id, c.created_by_user_id, cm.role AS member_role
      FROM courses c
      LEFT JOIN course_members cm
        ON cm.course_id = c.id
       AND cm.user_id = $2
      WHERE c.id = $1
      LIMIT 1
    `,
    [courseId, user.id]
  );

  if (result.rowCount === 0) {
    return {
      exists: false,
      isMember: false,
      canManage: false,
      courseId,
    };
  }

  const row = result.rows[0];
  const isOwner = row.created_by_user_id != null && Number(row.created_by_user_id) === Number(user.id);
  const isTeacherMember = row.member_role === "teacher" || row.member_role === "assistant";

  return {
    exists: true,
    isMember: Boolean(row.member_role),
    canManage: user.role === "admin" || isOwner || isTeacherMember,
    memberRole: row.member_role || null,
    courseId: row.id,
  };
}

module.exports = {
  resolveCourseAccess,
};
