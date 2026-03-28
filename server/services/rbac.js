const { pool } = require("../db/pool");

const SYSTEM_ROLES = [
  {
    code: "admin",
    name: "Administrador",
    description: "Control total de la plataforma y configuraciones de seguridad.",
  },
  {
    code: "teacher",
    name: "Profesor",
    description: "Gestiona cursos, miembros, actividades y reportes academicos.",
  },
  {
    code: "student",
    name: "Estudiante",
    description: "Acceso a cursos asignados, actividades y seguimiento de progreso.",
  },
];

const SYSTEM_PERMISSIONS = [
  { code: "dashboard.read", name: "Ver Dashboard", description: "Permite ingresar y visualizar el panel principal." },
  { code: "users.read", name: "Ver Usuarios", description: "Permite listar usuarios y ver su estado." },
  { code: "users.create", name: "Crear Usuarios", description: "Permite crear cuentas desde el panel administrativo." },
  { code: "users.update", name: "Actualizar Usuarios", description: "Permite editar datos de usuario y rol principal." },
  { code: "users.disable", name: "Desactivar Usuarios", description: "Permite activar o desactivar cuentas." },
  { code: "roles.read", name: "Ver Roles", description: "Permite consultar catalogo de roles y permisos." },
  { code: "roles.manage", name: "Gestionar Roles", description: "Permite modificar permisos asignados a cada rol." },
  { code: "courses.read", name: "Ver Cursos", description: "Permite consultar cursos y su informacion operativa." },
  { code: "courses.create", name: "Crear Cursos", description: "Permite crear nuevos cursos." },
  { code: "courses.update", name: "Actualizar Cursos", description: "Permite editar cursos existentes." },
  { code: "courses.archive", name: "Archivar Cursos", description: "Permite archivar cursos." },
  { code: "members.manage", name: "Gestionar Miembros", description: "Permite matricular o remover miembros por curso." },
  { code: "activities.manage", name: "Gestionar Actividades", description: "Permite crear, editar y eliminar actividad academica." },
  { code: "grades.manage", name: "Gestionar Calificaciones", description: "Permite administrar notas y evaluaciones." },
  { code: "reports.read", name: "Ver Reportes", description: "Permite consultar reportes operativos y de progreso." },
];

const DEFAULT_ROLE_PERMISSION_CODES = {
  admin: SYSTEM_PERMISSIONS.map((permission) => permission.code),
  teacher: [
    "dashboard.read",
    "courses.read",
    "courses.create",
    "courses.update",
    "members.manage",
    "activities.manage",
    "reports.read",
  ],
  student: ["dashboard.read", "courses.read"],
};

function normalizeRoleCode(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizePermissionCode(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function defaultPermissionsForRole(roleCode) {
  const normalized = normalizeRoleCode(roleCode);
  return DEFAULT_ROLE_PERMISSION_CODES[normalized] || [];
}

async function seedRbacCatalog() {
  for (const role of SYSTEM_ROLES) {
    await pool.query(
      `
        INSERT INTO roles (code, name, description, is_system)
        VALUES ($1, $2, $3, TRUE)
        ON CONFLICT (code) DO UPDATE
        SET name = EXCLUDED.name,
            description = EXCLUDED.description
      `,
      [role.code, role.name, role.description]
    );
  }

  for (const permission of SYSTEM_PERMISSIONS) {
    await pool.query(
      `
        INSERT INTO permissions (code, name, description, is_system)
        VALUES ($1, $2, $3, TRUE)
        ON CONFLICT (code) DO UPDATE
        SET name = EXCLUDED.name,
            description = EXCLUDED.description
      `,
      [permission.code, permission.name, permission.description]
    );
  }

  const rolesResult = await pool.query("SELECT id, code FROM roles");
  const permissionsResult = await pool.query("SELECT id, code FROM permissions");

  const roleIdByCode = new Map(rolesResult.rows.map((row) => [row.code, row.id]));
  const permissionIdByCode = new Map(permissionsResult.rows.map((row) => [row.code, row.id]));

  for (const [roleCode, permissionCodes] of Object.entries(DEFAULT_ROLE_PERMISSION_CODES)) {
    const roleId = roleIdByCode.get(roleCode);
    if (!roleId) {
      continue;
    }

    const countResult = await pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM role_permissions
        WHERE role_id = $1
      `,
      [roleId]
    );

    if (countResult.rows[0].total > 0) {
      continue;
    }

    for (const permissionCode of permissionCodes) {
      const permissionId = permissionIdByCode.get(permissionCode);
      if (!permissionId) {
        continue;
      }

      await pool.query(
        `
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES ($1, $2)
          ON CONFLICT (role_id, permission_id) DO NOTHING
        `,
        [roleId, permissionId]
      );
    }
  }
}

async function syncUserRolesFromLegacy() {
  await pool.query(
    `
      INSERT INTO user_roles (user_id, role_id, is_primary)
      SELECT u.id, r.id, TRUE
      FROM users u
      INNER JOIN roles r ON r.code = u.role
      ON CONFLICT (user_id, role_id) DO UPDATE
      SET is_primary = CASE
        WHEN EXCLUDED.is_primary = TRUE THEN TRUE
        ELSE user_roles.is_primary
      END
    `
  );

  await pool.query(
    `
      WITH ranked AS (
        SELECT user_id, role_id, is_primary,
               ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY is_primary DESC, assigned_at DESC, role_id ASC) AS rn
        FROM user_roles
      )
      UPDATE user_roles ur
      SET is_primary = CASE WHEN ranked.rn = 1 THEN TRUE ELSE FALSE END
      FROM ranked
      WHERE ur.user_id = ranked.user_id
        AND ur.role_id = ranked.role_id
    `
  );
}

async function resolveRolesByCode(client, roleCodes) {
  const normalizedCodes = unique(roleCodes.map(normalizeRoleCode));
  if (normalizedCodes.length === 0) {
    return [];
  }

  const result = await client.query(
    `
      SELECT id, code
      FROM roles
      WHERE code = ANY($1::text[])
    `,
    [normalizedCodes]
  );

  if (result.rowCount !== normalizedCodes.length) {
    const foundCodes = new Set(result.rows.map((row) => row.code));
    const missing = normalizedCodes.filter((code) => !foundCodes.has(code));
    const error = new Error(`Invalid role code(s): ${missing.join(", ")}`);
    error.status = 400;
    throw error;
  }

  return result.rows;
}

async function setUserRoles(userId, roleCodes, primaryRoleCode) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const normalizedPrimary = normalizeRoleCode(primaryRoleCode);
    const normalizedCodes = unique(roleCodes.map(normalizeRoleCode));
    if (normalizedCodes.length === 0) {
      const error = new Error("At least one role is required");
      error.status = 400;
      throw error;
    }

    if (normalizedPrimary && !normalizedCodes.includes(normalizedPrimary)) {
      normalizedCodes.unshift(normalizedPrimary);
    }

    const roles = await resolveRolesByCode(client, normalizedCodes);
    const roleIdByCode = new Map(roles.map((row) => [row.code, row.id]));
    const roleIds = roles.map((row) => row.id);

    await client.query(
      `
        DELETE FROM user_roles
        WHERE user_id = $1
          AND role_id <> ALL($2::bigint[])
      `,
      [userId, roleIds]
    );

    for (const role of roles) {
      await client.query(
        `
          INSERT INTO user_roles (user_id, role_id, is_primary)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, role_id) DO UPDATE
          SET is_primary = EXCLUDED.is_primary,
              assigned_at = NOW()
        `,
        [userId, role.id, role.code === normalizedPrimary]
      );
    }

    if (normalizedPrimary) {
      await client.query(
        `
          UPDATE user_roles
          SET is_primary = (role_id = $2)
          WHERE user_id = $1
        `,
        [userId, roleIdByCode.get(normalizedPrimary)]
      );
    } else {
      await client.query(
        `
          WITH ranked AS (
            SELECT role_id,
                   ROW_NUMBER() OVER (ORDER BY assigned_at DESC, role_id ASC) AS rn
            FROM user_roles
            WHERE user_id = $1
          )
          UPDATE user_roles ur
          SET is_primary = (ranked.rn = 1)
          FROM ranked
          WHERE ur.user_id = $1
            AND ur.role_id = ranked.role_id
        `,
        [userId]
      );
    }

    const primaryCode = normalizedPrimary || normalizedCodes[0];
    await client.query("UPDATE users SET role = $2, updated_at = NOW() WHERE id = $1", [userId, primaryCode]);
    await client.query("COMMIT");
    return { primaryRole: primaryCode, roles: normalizedCodes };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function ensureUserPrimaryRole(userId, roleCode) {
  return setUserRoles(userId, [roleCode], roleCode);
}

async function getUserAccess(userId, fallbackRoleCode) {
  const result = await pool.query(
    `
      SELECT r.code AS role_code,
             ur.is_primary,
             p.code AS permission_code
      FROM user_roles ur
      INNER JOIN roles r ON r.id = ur.role_id
      LEFT JOIN role_permissions rp ON rp.role_id = r.id
      LEFT JOIN permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = $1
      ORDER BY ur.is_primary DESC, r.code ASC, p.code ASC
    `,
    [userId]
  );

  const roleCodes = new Set();
  const permissionCodes = new Set();
  let primaryRole = normalizeRoleCode(fallbackRoleCode);

  for (const row of result.rows) {
    if (row.role_code) {
      roleCodes.add(row.role_code);
      if (row.is_primary) {
        primaryRole = row.role_code;
      }
    }

    if (row.permission_code) {
      permissionCodes.add(row.permission_code);
    }
  }

  if (primaryRole) {
    roleCodes.add(primaryRole);
  }

  if (roleCodes.size === 0) {
    roleCodes.add("student");
    primaryRole = "student";
  }

  if (permissionCodes.size === 0) {
    for (const roleCode of roleCodes) {
      for (const permissionCode of defaultPermissionsForRole(roleCode)) {
        permissionCodes.add(permissionCode);
      }
    }
  }

  return {
    primaryRole: primaryRole || "student",
    roles: Array.from(roleCodes),
    permissions: Array.from(permissionCodes),
  };
}

function userHasPermission(user, permissionCode) {
  if (!user) {
    return false;
  }

  const normalizedPermission = normalizePermissionCode(permissionCode);
  if (!normalizedPermission) {
    return false;
  }

  if (String(user.role || "").toLowerCase() === "admin") {
    return true;
  }

  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  return permissions.includes(normalizedPermission);
}

function userHasAnyPermission(user, permissionCodes) {
  const codes = Array.isArray(permissionCodes) ? permissionCodes : [];
  return codes.some((code) => userHasPermission(user, code));
}

module.exports = {
  SYSTEM_ROLES,
  SYSTEM_PERMISSIONS,
  DEFAULT_ROLE_PERMISSION_CODES,
  normalizeRoleCode,
  normalizePermissionCode,
  defaultPermissionsForRole,
  seedRbacCatalog,
  syncUserRolesFromLegacy,
  resolveRolesByCode,
  setUserRoles,
  ensureUserPrimaryRole,
  getUserAccess,
  userHasPermission,
  userHasAnyPermission,
};