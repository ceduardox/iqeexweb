# Guia de Modulos LMS (Operacion Clara)

## Objetivo
Construir un LMS tipo Moodle sobre el stack actual (`Node + Express + React + PostgreSQL`) con una UI simple de operar para:
- Administrador
- Profesor
- Alumno

La regla principal es: **cada pantalla debe responder a una tarea operativa real**.

## Principios de UI
- Navegacion por tareas, no por componentes tecnicos.
- Maximo 6 secciones en sidebar por rol.
- Formularios con pasos cortos y validaciones visibles.
- Estados claros: cargando, exito, error, vacio.
- Acciones criticas con confirmacion (`archivar`, `eliminar`, `desmatricular`).

## Estructura de Pantallas (MVP)
1. `Resumen`
2. `Usuarios y Roles`
3. `Cursos`
4. `Contenido y Temas`
5. `Evaluaciones`
6. `Reportes`

## Modulos Funcionales (en orden recomendado)

### Modulo 1: Identidad y Sesion
- Registro/login/logout.
- Perfil basico.
- Estado activo/inactivo.
- Recuperacion de sesion (`/auth/me`).

### Modulo 2: Roles y Permisos (RBAC real)
- Tablas:
  - `roles`
  - `permissions`
  - `role_permissions`
  - `user_roles`
- Permisos por accion:
  - `users.read`, `users.create`, `users.update`, `users.disable`
  - `courses.read`, `courses.create`, `courses.update`, `courses.archive`
  - `members.manage`
  - `content.manage`
  - `grades.manage`

### Modulo 3: Usuarios
- CRUD de usuarios desde admin.
- Asignacion de rol global.
- Filtros: rol, estado, email.
- Activar/desactivar usuario.

### Modulo 4: Cursos y Matriculas
- CRUD de cursos.
- Publicar/archivar.
- Matricular alumnos/profesores.
- Vista de miembros por curso.

### Modulo 5: Temas y Contenido
- Estructura: Curso -> Tema -> Recurso/Actividad.
- Tipos iniciales:
  - archivo
  - enlace
  - tarea
  - foro

### Modulo 6: Evaluaciones y Calificaciones
- Crear evaluaciones por curso/tema.
- Intentos del alumno.
- Calificacion manual/automatica.
- Libro de notas por curso.

### Modulo 7: Reportes Operativos
- Progreso por alumno.
- Avance por curso.
- Actividad reciente.
- Riesgo de abandono (baja actividad).

### Modulo 8: Configuracion y Operacion
- Parametros del sitio.
- Bitacora de auditoria.
- Backups logicos.
- Seeds y scripts de mantenimiento.

## Flujo UX por Rol

### Admin
- Crear usuarios -> asignar roles -> crear cursos -> asignar profesores/alumnos -> revisar reportes.

### Profesor
- Ver cursos asignados -> crear temas -> publicar actividades -> evaluar -> revisar progreso.

### Alumno
- Ver cursos matriculados -> consumir contenido -> enviar actividades -> ver notas y progreso.

## Mapa de Sprints sugerido
- Sprint A: Modulo 1 + Modulo 2
- Sprint B: Modulo 3 + Modulo 4
- Sprint C: Modulo 5 + Modulo 6
- Sprint D: Modulo 7
- Sprint E: Modulo 8 + hardening de seguridad

## Definition of Done por modulo
- API funcional con validaciones.
- UI operable sin explicacion tecnica.
- Permisos aplicados en backend.
- Build pasando.
- Pruebas minimas de flujo feliz + errores comunes.

## Lo que sigue inmediatamente
1. Redisenar sidebar y rutas con esta estructura de modulos.
2. Implementar Modulo 2 (RBAC) antes de seguir creando pantallas.
3. Implementar Modulo 3 (Usuarios) para destrabar toda la operacion.
