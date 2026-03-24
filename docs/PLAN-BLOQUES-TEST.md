# Plan por Bloques (Prioridad + Test)

Objetivo: avanzar rapido en lo mas importante y testear por etapas cortas, sin mezclar demasiados cambios.

## Bloque 0 (hecho): Base operativa
Alcance:
- Auth base + dashboard + cursos + miembros + actividades.
- Migracion UI a Ant Design.

Pruebas minimas:
- Login y acceso al panel.
- Crear/editar/archivar curso.
- Agregar/quitar miembro.
- Crear/editar/eliminar actividad.

## Bloque 1 (hecho): Usuarios, roles y permisos (RBAC)
Alcance:
- Tablas `roles`, `permissions`, `role_permissions`, `user_roles`.
- Middleware de permisos.
- APIs admin para usuarios y permisos.
- UI para gestionar usuarios y permisos por rol.

Pruebas minimas:
- Admin crea usuario.
- Admin cambia rol y estado activo/inactivo.
- Admin modifica permisos de un rol.
- Usuario sin permiso recibe 403 en endpoint restringido.

## Bloque 2 (hecho): Modulos y lecciones (base)
Alcance:
- CRUD de modulos por curso.
- CRUD de lecciones por modulo.
- Tipos de leccion: texto, video, archivo y mixto.
- Orden basico de modulos/lecciones.

Pruebas minimas:
- Profesor crea modulo y 2 lecciones.
- Alumno visualiza orden correcto.
- Edicion y eliminacion de leccion sin romper curso.
- Estado actual: cumplido en version base (pendiente drag/drop, preview avanzado y editor enriquecido).

## Bloque 3 (hecho base): Progreso real del alumno
Alcance:
- Marcar leccion completada.
- Guardar ultima leccion vista.
- Calcular progreso por curso.
- Vista progreso para profesor/admin.

Pruebas minimas:
- Alumno completa lecciones y progreso sube.
- Profesor ve progreso por alumno en su curso.
- Reingreso del alumno conserva punto de continuidad.

Estado actual:
- Implementado backend (`lesson_progress`, `course_progress` + rutas `/progress/me`, `/lessons/:id/progress`, `/progress/overview`).
- Implementado frontend (tab `Progreso`, barra de avance, reporte por alumno y acciones completar/pendiente).
- Smoke test E2E completado (registro -> cursos -> modulos -> marcar leccion -> progreso sube de 0 a 25 en entorno local con Railway).
- Pendiente en este bloque: algoritmo de "continuar donde quedo" por leccion exacta y eventos de tiempo por reproduccion real de video.

## Bloque 4: Quizzes y tareas
Alcance:
- Quizzes de opcion multiple + V/F + respuesta corta.
- Intentos y puntaje.
- Vista de resultados por alumno.

Pruebas minimas:
- Profesor crea quiz.
- Alumno responde intento.
- Profesor revisa resultados.

## Bloque 5: UX premium y hardening
Alcance:
- Skeletons, empty states premium, feedback visual consistente.
- Breadcrumbs y navegacion por rutas.
- Paginacion/filtros en tablas grandes.
- Seguridad operativa (rate limit, validaciones extra, auditoria basica).

Pruebas minimas:
- Flujos largos sin bloqueos UX.
- Responsive completo en movil/tablet.
- Errores mostrados de forma clara y consistente.

---

## Criterio de avance por bloque (Definition of Done)
- API estable + permisos aplicados.
- UI operable sin explicar tecnicamente.
- `npm run db:init` correcto.
- `npm --prefix client run lint` y `build` en verde.
- Test manual documentado del flujo principal.

## Orden recomendado para testeo real
1. Bloque 1 (usuarios/roles/permisos).
2. Bloque 2 (modulos/lecciones).
3. Bloque 3 (progreso).
4. Bloque 4 (quizzes).
5. Bloque 5 (pulido final).
