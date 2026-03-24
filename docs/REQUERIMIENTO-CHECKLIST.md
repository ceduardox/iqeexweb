# Estado de REQUERIMIENTO (Checklist Real)

## 1) Stack y arquitectura
- [x] Backend con Node.js + Express + PostgreSQL (`pg`) + `dotenv`.
- [x] Frontend con React + Vite + Ant Design + icons.
- [x] Frontend y backend separados (`client/` y `server/`).
- [x] API REST modular por rutas (`auth`, `dashboard`, `courses`, `activities`, `modules`, `admin`).
- [~] Middleware de auth, roles/permisos y manejo de errores (hecho base; falta endurecer validaciones por modulo).
- [~] UI moderna tipo SaaS (base lograda, aun falta refinamiento premium en todos los modulos).
- [ ] React Router y arquitectura de paginas por feature (pendiente; hoy es SPA en un solo `App.jsx`).

## 2) Modulos principales
- [x] A. Autenticacion y usuarios (login/register/logout + sesion).
- [~] B. Dashboard por rol (base funcional; faltan metricas avanzadas y widgets por rol).
- [~] C. Gestion de cursos (CRUD base + miembros + estado publicado/archivado).
- [~] D. Modulos y lecciones (base funcional backend+UI lista; falta editor avanzado, reorder drag/drop y preview).
- [~] E. Progreso del alumno (base funcional: progreso por leccion y por curso + reporte; faltan continuidad avanzada y analitica extendida).
- [ ] F. Quizzes/evaluaciones/tareas (pendiente modulo completo).
- [ ] G. Certificados (pendiente).
- [ ] H. Biblioteca archivos/videos (pendiente).
- [~] I. Panel administrativo (usuarios/roles/permisos + cursos base; faltan categorias, auditoria, sistema).
- [ ] J. Ajustes del sistema (pendiente).

## 3) Roles y permisos
- [x] 3 roles principales (`admin`, `teacher`, `student`).
- [x] RBAC con tablas: `roles`, `permissions`, `role_permissions`, `user_roles`.
- [x] Middleware `requirePermission` en endpoints criticos.
- [x] API admin para gestionar usuarios y permisos por rol.
- [~] UI de gestion de usuarios y permisos en panel (hecha base funcional; falta pulir UX y flujos).

## 4) Estructura funcional detallada
### 4.1 Autenticacion
- [x] Login / registro / logout.
- [x] Proteccion por token.
- [ ] Recuperacion de contrasena.
- [~] Perfil y editar perfil (pendiente pantalla dedicada).

### 4.2 Dashboard
- [~] Admin/profesor/alumno con base comun y datos segun acceso.
- [ ] Graficos y metricas avanzadas por rol.

### 4.3 Cursos
- [~] CRUD base con campos principales (`code`, `title`, `category`, `level`, `theme`, `published`).
- [ ] Portada, descripcion larga, duracion, vistas tabla/cards completas, preview avanzado.

### 4.4 Modulos y lecciones
- [~] CRUD base de modulos y lecciones implementado.
- [x] Tipos de leccion: `video`, `text`, `file`, `mixed`.
- [~] Orden por `sortOrder` y publicacion por estado.
- [ ] Drag and drop y constructor visual avanzado.

### 4.5 Progreso alumno
- [x] Marcar leccion como completada/pendiente desde UI.
- [x] Persistencia `lesson_progress` y `course_progress` en base de datos.
- [x] Calculo de porcentaje por curso en backend.
- [x] Vista de progreso propio del alumno (porcentaje, lecciones y tiempo invertido).
- [x] Vista de progreso por alumno para admin/profesor con permiso (`reports.read` + `canManage`).
- [~] Continuar donde quedo y analitica de quizzes/tareas (pendiente siguiente bloque).

### 4.6 Quizzes y tareas
- [ ] Pendiente completo.

### 4.7 Certificados
- [ ] Pendiente.

### 4.8 Videos y archivos
- [ ] Pendiente.

### 4.9 Panel administrativo
- [~] Gestion de usuarios/roles/permisos y cursos base.
- [ ] Auditoria, estado del sistema, categorias completas, paginacion avanzada.

## 5) UI/UX obligatorio
- [~] Base visual moderna, responsive y consistente.
- [x] Estados vacios y feedback de exito/error en modulos actuales.
- [x] Confirmaciones para acciones criticas.
- [ ] Skeleton loaders consistentes en toda la app.
- [ ] Breadcrumbs reales por ruta.
- [ ] Flujo visual premium completo en todos los modulos.

## 6) Navegacion
- [x] Sidebar colapsable + topbar.
- [~] Navegacion por secciones principal (Dashboard/Gestion).
- [ ] Navegacion completa por rol con todas las secciones definidas.

## 7) Base de datos
- [~] Tablas base operativas: `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `courses`, `course_members`, `course_modules`, `module_lessons`, `lesson_progress`, `course_progress`, `activity_events`.
- [ ] Tablas LMS avanzadas pendientes (enrollments formales, quizzes, assignments, certificates).

## 8) Estructura de carpetas
- [~] Separacion backend/frontend y rutas por modulo.
- [ ] Refactor a estructura full por features en frontend y modules completos en backend.

## 9) Orden de salida requerido
- [~] Arquitectura/base implementada parcialmente.
- [~] Backend modular + frontend AntD funcional.
- [ ] Implementar modulos pendientes (lecciones, progreso, quizzes, certificados) en sprints.

## 10-11) Reglas y entregables
- [~] Ya hay base seria y escalable.
- [ ] Falta completar el set total de entregables y pulido final de producto.

---

## Cambios fuertes ya implementados (nuevos)
- RBAC real en backend con seed y sincronizacion de roles.
- Endpoints admin:
  - `GET /api/admin/users`
  - `POST /api/admin/users`
  - `PATCH /api/admin/users/:userId`
  - `GET /api/admin/permissions`
  - `PATCH /api/admin/roles/:roleCode/permissions`
- Permisos aplicados en rutas de cursos/actividades/dashboard.
- UI en panel para `Usuarios` y `Roles y Permisos`.
- Endpoints modulos/lecciones:
  - `GET /api/courses/:courseId/modules`
  - `POST /api/courses/:courseId/modules`
  - `PATCH /api/modules/:moduleId`
  - `DELETE /api/modules/:moduleId`
  - `GET /api/modules/:moduleId/lessons`
  - `POST /api/modules/:moduleId/lessons`
  - `PATCH /api/lessons/:lessonId`
  - `DELETE /api/lessons/:lessonId`
- UI en panel para `Modulos` y `Lecciones`.
- Endpoints de progreso:
  - `GET /api/courses/:courseId/progress/me`
  - `POST /api/lessons/:lessonId/progress`
  - `GET /api/courses/:courseId/progress/overview`
- UI nueva en `Gestion LMS > Progreso` con:
  - Barra y metricas de progreso propio.
  - Tabla de progreso por alumno (admin/profesor con permiso).
  - Marcado rapido de leccion completada/pendiente en tabla de lecciones.
