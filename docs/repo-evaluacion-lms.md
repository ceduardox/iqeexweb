# Evaluacion de Repositorio Base LMS (2026-03-23)

## Contexto actual
- Proyecto actual: Node.js + Express + React (Vite) + PostgreSQL.
- Infra actual: Railway con `DATABASE_PUBLIC_URL` PostgreSQL.
- Objetivo: avanzar rapido sin romper lo ya funcional (cursos, miembros, actividades, roles).

## Opciones evaluadas

### 1) CourseLit
- Repo: https://github.com/codelitdev/courselit
- Fortaleza:
  - Muy maduro para open source LMS/commerce (1.1k stars, 223 forks, 46 releases).
  - Monorepo TypeScript con documentacion y despliegue.
- Riesgo para nosotros:
  - Usa MongoDB para migraciones (`mongoose` y `DB_CONNECTION_STRING=mongodb://...`).
  - Dependencia de MediaLit para media (servicio externo/pago).
  - Licencia AGPL-3.0 (obligaciones fuertes si se distribuye o modifica para SaaS).
- Veredicto:
  - Bueno como referencia funcional/producto.
  - No recomendado para copiar completo sobre nuestro stack actual.

### 2) SAM LMS
- Repo: https://github.com/Sudz/sam-lms
- Fortaleza:
  - Stack cercano al nuestro: backend Node/TypeScript, frontend React/TypeScript.
  - Define `DATABASE_URL` PostgreSQL.
- Riesgo para nosotros:
  - Madurez baja en comunidad (2 stars, 1 fork).
  - Arquitectura trae muchas integraciones no necesarias al inicio (Paystack, SMS, AWS, automation flows).
  - Sobrecosto de adopcion si copiamos todo.
- Veredicto:
  - Compatible tecnicamente con PostgreSQL.
  - Util solo como referencia parcial (estructura por modulos), no como reemplazo total.

### 3) Next LMS
- Repo: https://github.com/MrHacker26/next-lms
- Fortaleza:
  - Base moderna Next.js + TypeScript.
  - Incluye `prisma/`, `.env.example`, `docker-compose.yml`.
  - Comunidad intermedia (92 stars, 59 forks).
- Riesgo para nosotros:
  - README generico (boilerplate), poca documentacion de dominio LMS.
  - 1 contribuidor y 43 commits.
  - Requiere movernos de React+Vite a Next.js si lo usamos como base principal.
- Veredicto:
  - Bueno para UI/estructura de frontend.
  - No ideal como core completo para reemplazar el proyecto.

## Decision recomendada
- No reemplazar el repo actual por uno externo completo.
- Mantener el backend actual (Express + PostgreSQL) y avanzar por modulos funcionales.
- Importar solo patrones UI/componentes de repos externos cuando aporten valor.

## Plan recomendado (ejecutable)
1. Mantener base actual y reforzar modulos de negocio:
   - usuarios/roles/permisos,
   - cursos y matriculas,
   - evaluaciones y calificaciones.
2. Tomar inspiracion visual/UX (no logica) de un repo moderno.
3. Crear adaptadores para cada pantalla nueva contra nuestra API existente.
4. Evitar dependencias de terceros no esenciales en esta etapa (pagos/SMS/etc.).

## Conclusión
- Estrategia mas segura y rapida: evolucionar lo ya construido.
- Copiar un LMS completo ahora aumenta riesgo de deuda tecnica, cambio de stack y retrabajo.
