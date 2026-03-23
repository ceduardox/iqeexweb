import { useEffect, useMemo, useState } from 'react'
import './App.css'

const DEFAULT_PRIMARY_NAV = [
  { key: 'dashboard', label: 'Resumen', badge: null },
  { key: 'content-bank', label: 'Gestion', badge: null },
]

const EMPTY_COURSE_FORM = {
  code: '',
  title: '',
  category: 'General',
  level: 'Beginner',
  theme: 'vivid',
  isPublished: true,
}

const EMPTY_ACTIVITY_FORM = {
  title: '',
  description: '',
  eventType: 'task',
}

const EMPTY_MEMBER_FORM = {
  email: '',
  role: 'student',
  progressPercent: 0,
}

function parseStoredJson(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      return null
    }

    return JSON.parse(raw)
  } catch (_) {
    return null
  }
}

function initialsFromName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) {
    return 'IQ'
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
}

function roleLabel(role) {
  const normalized = String(role || '').toLowerCase()
  if (normalized === 'admin') {
    return 'Administrador'
  }

  if (normalized === 'teacher') {
    return 'Profesor'
  }

  return 'Estudiante'
}

function activityTime(value) {
  if (!value) return '--:--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'
  return date.toISOString().slice(11, 16)
}

function mapActivityRow(row) {
  const type = row.eventType || row.type || 'task'
  return {
    id: row.id,
    courseId: row.courseId,
    title: row.title,
    course: row.courseTitle || row.course || 'General',
    description: row.description || '',
    type,
    eventType: type,
    time: row.time || activityTime(row.happenedAt),
    happenedAt: row.happenedAt || null,
    canManage: Boolean(row.canManage),
  }
}

function getCourseScope(role) {
  return role === 'admin' ? 'all' : 'mine'
}

async function apiRequest(url, token, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new Error(data.message || 'Solicitud fallida')
    error.status = response.status
    throw error
  }

  return data
}

function Icon({ name }) {
  const pathByName = {
    search: 'M11 11l4 4m-9-4a5 5 0 110-10 5 5 0 010 10z',
    courses: 'M3 5h10v10H3zM13 8h8M13 12h8',
    dashboard: 'M4 4h6v6H4zM14 4h6v4h-6zM14 10h6v10h-6zM4 12h6v8H4z',
    calendar: 'M4 6h16v14H4zM8 2v4M16 2v4M4 10h16',
    files: 'M6 2h8l4 4v14H6zM14 2v4h4',
    content: 'M5 4h14M5 9h14M5 14h14M5 19h10',
    help: 'M12 18h.01M9.1 9a3 3 0 115.8 0c0 2-3 2-3 4',
    doc: 'M6 2h8l4 4v16H6zM14 2v4h4',
    bell: 'M15 17H5l1.4-1.4V10a5.6 5.6 0 1111.2 0v5.6L19 17h-4zm-4 3a2 2 0 004 0h-4z',
    chat: 'M4 5h16v10H7l-3 3z',
    globe: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 0c2.8 2.7 3.8 6 4 10-.2 4-1.2 7.3-4 10-2.8-2.7-3.8-6-4-10 .2-4 1.2-7.3 4-10zM2 12h20',
    menu: 'M4 6h16M4 12h16M4 18h16',
    panel: 'M4 4h16v16H4zM14 4v16',
    task: 'M5 12l4 4 10-10',
    quiz: 'M12 17h.01M9.2 9a2.8 2.8 0 115.6 0c0 1.8-2.8 1.8-2.8 3.6',
    discussion: 'M4 5h16v10H7l-3 3z',
    file: 'M7 3h7l4 4v14H7zM14 3v4h4',
    logout: 'M10 17l5-5-5-5M15 12H5M19 4v16',
    edit: 'M4 20h4l10-10-4-4L4 16v4zM13 7l4 4',
    trash: 'M4 7h16M9 7V4h6v3M8 7l1 13h6l1-13',
    user: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-7 9a7 7 0 0114 0',
    add: 'M12 5v14M5 12h14',
  }

  const d = pathByName[name] || pathByName.dashboard

  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Sidebar({
  activeSection,
  onSectionChange,
  primaryNav,
  courses,
  selectedCourseId,
  onSelectCourse,
  courseQuery,
  onCourseQueryChange,
}) {
  const filteredCourses = useMemo(() => {
    const needle = String(courseQuery || '').trim().toLowerCase()
    if (!needle) return courses
    return courses.filter((course) => {
      return String(course.title || '').toLowerCase().includes(needle) || String(course.code || '').toLowerCase().includes(needle)
    })
  }, [courses, courseQuery])

  return (
    <aside className="left-sidebar">
      <section className="nav-group shell-box">
        <header className="group-header">
          <span>Cursos</span>
          <span className="counter-pill">{courses.length}</span>
        </header>

        <div className="mini-search">
          <Icon name="search" />
          <input value={courseQuery} onChange={(event) => onCourseQueryChange(event.target.value)} placeholder="Buscar curso por titulo o codigo" />
        </div>

        <ul className="course-links">
          {filteredCourses.length > 0 ? (
            filteredCourses.map((course) => {
              const selected = Number(course.id) === Number(selectedCourseId)
              return (
                <li key={course.id} className={selected ? 'active' : ''}>
                  <button type="button" onClick={() => onSelectCourse(course.id)}>
                    <span>{course.title}</span>
                    {course.isPublished === false ? <small>Archivado</small> : null}
                  </button>
                </li>
              )
            })
          ) : (
            <li className="active">
              <button type="button">No hay cursos</button>
            </li>
          )}
        </ul>
      </section>

      <section className="nav-group shell-box">
        <header className="group-header muted">Panel</header>
        <ul className="menu-list">
          {primaryNav.map((item) => (
            <li key={item.key} className={item.key === activeSection ? 'active' : ''}>
              <button type="button" onClick={() => onSectionChange(item.key)}>
                <Icon
                  name={
                    item.key === 'dashboard'
                      ? 'dashboard'
                      : 'content'
                  }
                />
                <span>{item.label}</span>
                {item.badge ? <span className="counter-pill">{item.badge}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </section>

    </aside>
  )
}

function Topbar({ onToggleLeft, user, onLogout, selectedCourse, totalCourses }) {
  const initials = initialsFromName(user.fullName)

  return (
    <header className="topbar shell-box">
      <div className="topbar-left">
        <button className="icon-btn mobile-only" type="button" onClick={onToggleLeft}>
          <Icon name="menu" />
        </button>

        <div className="brand-mark" aria-hidden="true">IQ</div>
        <div className="topbar-context">
          <strong>{selectedCourse?.title || 'Sin curso seleccionado'}</strong>
          <span>{totalCourses} cursos disponibles</span>
        </div>
      </div>

      <div className="topbar-right">
        <div className="user-meta">
          <strong>{user.fullName}</strong>
          <span>{roleLabel(user.role)}</span>
        </div>

        <div className="avatar-block">
          <div className="avatar-dot">3</div>
          <div className="avatar">{initials}</div>
        </div>

        <button className="ghost-btn" type="button" onClick={onLogout}>
          <Icon name="logout" />
          <span>Cerrar sesion</span>
        </button>
      </div>
    </header>
  )
}

function OverviewSection({ user, courses, selectedCourse, timelineItems, onGoToManagement, onRefresh, refreshing }) {
  const totalCourses = courses.length
  const publishedCourses = courses.filter((course) => course.isPublished !== false).length
  const selectedMembers = typeof selectedCourse?.memberCount === 'number' ? selectedCourse.memberCount : 0
  const selectedActivities = timelineItems.filter((item) => Number(item.courseId) === Number(selectedCourse?.id)).length

  return (
    <section className="block shell-box overview-block">
      <header className="block-header">
        <h2>Resumen</h2>
        <div className="manager-actions inline">
          <button className="ghost-btn small" type="button" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? 'Actualizando...' : 'Actualizar'}
          </button>
          <button className="ghost-btn small" type="button" onClick={onGoToManagement}>
            Ir a Gestion
          </button>
        </div>
      </header>

      <div className="overview-grid">
        <article className="overview-card">
          <small>Usuario</small>
          <strong>{user.fullName}</strong>
          <span>{roleLabel(user.role)}</span>
        </article>
        <article className="overview-card">
          <small>Cursos Totales</small>
          <strong>{totalCourses}</strong>
          <span>{publishedCourses} publicados</span>
        </article>
        <article className="overview-card">
          <small>Curso Seleccionado</small>
          <strong>{selectedCourse?.title || 'Sin seleccion'}</strong>
          <span>{selectedCourse ? `${selectedMembers} miembros` : 'Elige un curso'}</span>
        </article>
        <article className="overview-card">
          <small>Actividad Curso</small>
          <strong>{selectedActivities}</strong>
          <span>eventos registrados</span>
        </article>
      </div>
    </section>
  )
}

function CoursesSection({ recentCourses }) {
  return (
    <section className="block shell-box">
      <header className="block-header">
        <h2>Cursos Recientes</h2>
      </header>

      <div className="course-grid">
        {recentCourses.length > 0 ? (
          recentCourses.map((course) => (
            <article key={course.id} className={`course-card ${course.tone === 'earth' ? 'earth' : 'vivid'}`}>
              <div className="overlay" />
              <div className="content">
                <h3>{course.title}</h3>
                <p>
                  {course.level}
                  {typeof course.progress === 'number' ? ` - ${course.progress}%` : ''}
                </p>
              </div>
            </article>
          ))
        ) : (
          <article className="course-card vivid">
            <div className="overlay" />
            <div className="content">
              <h3>Sin Cursos</h3>
              <p>Solicita asignacion de cursos al administrador.</p>
            </div>
          </article>
        )}
      </div>
    </section>
  )
}

function TimelineSection({ timelineItems }) {
  const [filterText, setFilterText] = useState('')

  const rows = useMemo(() => {
    const needle = filterText.trim().toLowerCase()
    if (!needle) {
      return timelineItems
    }

    return timelineItems.filter((item) => {
      return item.title.toLowerCase().includes(needle) || item.course.toLowerCase().includes(needle)
    })
  }, [filterText, timelineItems])

  return (
    <section className="block shell-box">
      <header className="block-header timeline-head">
        <h2>Actividad</h2>
      </header>

      <div className="timeline-tools">
        <div className="mini-search grow">
          <Icon name="search" />
          <input
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
            type="text"
            placeholder="Buscar actividad"
          />
        </div>
      </div>

      <ul className="timeline-list">
        {rows.length > 0 ? (
          rows.map((item) => (
            <li key={item.id}>
              <div className="time-col">
                <span>{item.time}</span>
              </div>
              <div className="event-col">
                <span className="event-icon"><Icon name={item.type} /></span>
                <div>
                  <h4>{item.title}</h4>
                  <p>{item.course}</p>
                </div>
              </div>
            </li>
          ))
        ) : (
          <li>
            <div className="time-col"><span>--:--</span></div>
            <div className="event-col">
              <span className="event-icon"><Icon name="task" /></span>
              <div>
                <h4>No events</h4>
                <p>La actividad aparecera aqui.</p>
              </div>
            </div>
          </li>
        )}
      </ul>
    </section>
  )
}

function ContentBankSection({
  user,
  courses,
  selectedCourse,
  selectedCourseId,
  onSelectCourse,
  members,
  activities,
  courseForm,
  onCourseChange,
  onCreateCourse,
  onUpdateCourse,
  onArchiveCourse,
  memberForm,
  onMemberChange,
  onAddMember,
  onRemoveMember,
  activityForm,
  onActivityChange,
  onCreateActivity,
  onRenameActivity,
  onDeleteActivity,
  busyAction,
  managerMessage,
}) {
  const canCreateCourse = user.role === 'admin' || user.role === 'teacher'
  const canManageSelectedCourse = Boolean(selectedCourse && selectedCourse.canManage)

  return (
    <section className="block shell-box manager-wrap">
      <header className="block-header">
        <h2>Gestion de Plataforma</h2>
      </header>

      {managerMessage ? (
        <p className={`manager-message ${managerMessage.type === 'error' ? 'error' : 'success'}`}>
          {managerMessage.text}
        </p>
      ) : null}

      <div className="manager-grid">
        <article className="manager-card">
          <h3>Cursos</h3>
          <ul className="manager-list">
            {courses.length > 0 ? (
              courses.map((course) => (
                <li key={course.id} className={`manager-item ${Number(course.id) === Number(selectedCourseId) ? 'active' : ''}`}>
                  <button type="button" className="manager-select" onClick={() => onSelectCourse(course.id)}>
                    <span>
                      <strong>{course.title}</strong>
                      <small>{course.code} - {course.category}</small>
                    </span>
                    <span className="manager-meta">{typeof course.memberCount === 'number' ? `${course.memberCount} users` : '--'}</span>
                  </button>
                </li>
              ))
            ) : (
              <li className="manager-empty">No hay cursos disponibles.</li>
            )}
          </ul>
        </article>

        <article className="manager-card">
          <h3>Configuracion del Curso</h3>
          <form className="manager-form" onSubmit={onCreateCourse}>
            <div className="form-grid">
              <label>
                Codigo
                <input name="code" value={courseForm.code} onChange={onCourseChange} placeholder="BIO-101" />
              </label>
              <label>
                Titulo
                <input name="title" value={courseForm.title} onChange={onCourseChange} required minLength={3} />
              </label>
              <label>
                Categoria
                <input name="category" value={courseForm.category} onChange={onCourseChange} />
              </label>
              <label>
                Nivel
                <input name="level" value={courseForm.level} onChange={onCourseChange} />
              </label>
              <label>
                Tema
                <select name="theme" value={courseForm.theme} onChange={onCourseChange}>
                  <option value="vivid">Vivid</option>
                  <option value="earth">Earth</option>
                </select>
              </label>
              <label className="checkbox-row">
                <input type="checkbox" name="isPublished" checked={Boolean(courseForm.isPublished)} onChange={onCourseChange} />
                <span>Publicado</span>
              </label>
            </div>

            <div className="manager-actions">
              <button className="ghost-btn" type="submit" disabled={!canCreateCourse || busyAction === 'create-course'}>
                {busyAction === 'create-course' ? 'Creando...' : 'Crear curso'}
              </button>
              <button className="ghost-btn" type="button" onClick={onUpdateCourse} disabled={!canManageSelectedCourse || busyAction === 'update-course'}>
                {busyAction === 'update-course' ? 'Guardando...' : 'Actualizar seleccionado'}
              </button>
              <button className="ghost-btn danger-btn" type="button" onClick={onArchiveCourse} disabled={!canManageSelectedCourse || busyAction === 'archive-course'}>
                {busyAction === 'archive-course' ? 'Archivando...' : 'Archivar seleccionado'}
              </button>
            </div>

            {selectedCourse ? (
              <p className="manager-note">
                Activo: <strong>{selectedCourse.title}</strong>{' '}
                {selectedCourse.isPublished ? <span className="course-state online">Publicado</span> : <span className="course-state archived">Archivado</span>}
              </p>
            ) : (
              <p className="manager-note">Elige un curso para editar miembros y actividad.</p>
            )}
          </form>
        </article>

        <article className="manager-card">
          <h3>Miembros del Curso</h3>
          {selectedCourse ? (
            <>
              <ul className="manager-list compact">
                {members.length > 0 ? (
                  members.map((member) => (
                    <li key={member.id} className="manager-item">
                      <div className="manager-user">
                        <span>
                          <strong>{member.fullName}</strong>
                          <small>{member.email}</small>
                        </span>
                      </div>
                      <div className="manager-meta">
                        <span className="manager-role">{member.role}</span>
                        <span>{member.progressPercent}%</span>
                      </div>
                      <button className="ghost-btn small" type="button" onClick={() => onRemoveMember(member.id)} disabled={!canManageSelectedCourse || busyAction === `member-remove-${member.id}` || Number(member.id) === Number(user.id)}>Quitar</button>
                    </li>
                  ))
                ) : (
                  <li className="manager-empty">Aun no hay miembros asignados.</li>
                )}
              </ul>

              <form className="manager-form" onSubmit={onAddMember}>
                <div className="form-grid">
                  <label>
                    Email del usuario
                    <input type="email" name="email" value={memberForm.email} onChange={onMemberChange} required />
                  </label>
                  <label>
                    Rol
                    <select name="role" value={memberForm.role} onChange={onMemberChange}>
                      <option value="student">Estudiante</option>
                      <option value="teacher">Profesor</option>
                      <option value="assistant">Asistente</option>
                    </select>
                  </label>
                  <label>
                    Progreso
                    <input type="number" min="0" max="100" name="progressPercent" value={memberForm.progressPercent} onChange={onMemberChange} />
                  </label>
                </div>
                <div className="manager-actions">
                  <button className="ghost-btn" type="submit" disabled={!canManageSelectedCourse || busyAction === 'member-add'}>
                    {busyAction === 'member-add' ? 'Guardando...' : 'Guardar miembro'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <p className="manager-empty">Selecciona primero un curso.</p>
          )}
        </article>

        <article className="manager-card">
          <h3>Actividad del Curso</h3>
          {selectedCourse ? (
            <>
              <ul className="manager-list compact">
                {activities.length > 0 ? (
                  activities.map((activity) => (
                    <li key={activity.id} className="manager-item">
                      <div>
                        <strong>{activity.title}</strong>
                        <small>{activity.type} - {activity.time}</small>
                      </div>
                      <div className="manager-actions inline">
                        <button className="ghost-btn small" type="button" onClick={() => onRenameActivity(activity.id, activity.title)} disabled={!canManageSelectedCourse || busyAction === `activity-edit-${activity.id}`}>Renombrar</button>
                        <button className="ghost-btn small danger-btn" type="button" onClick={() => onDeleteActivity(activity.id)} disabled={!canManageSelectedCourse || busyAction === `activity-delete-${activity.id}`}>Eliminar</button>
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="manager-empty">No hay actividades registradas para este curso.</li>
                )}
              </ul>

              <form className="manager-form" onSubmit={onCreateActivity}>
                <div className="form-grid">
                  <label>
                    Titulo
                    <input name="title" value={activityForm.title} onChange={onActivityChange} required minLength={3} />
                  </label>
                  <label>
                    Tipo
                    <select name="eventType" value={activityForm.eventType} onChange={onActivityChange}>
                      <option value="task">Tarea</option>
                      <option value="quiz">Cuestionario</option>
                      <option value="discussion">Discusion</option>
                      <option value="file">Archivo</option>
                    </select>
                  </label>
                </div>
                <label>
                  Descripcion
                  <textarea name="description" rows="2" value={activityForm.description} onChange={onActivityChange} />
                </label>
                <div className="manager-actions">
                  <button className="ghost-btn" type="submit" disabled={!canManageSelectedCourse || busyAction === 'activity-add'}>
                    {busyAction === 'activity-add' ? 'Guardando...' : 'Crear actividad'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <p className="manager-empty">Selecciona primero un curso.</p>
          )}
        </article>
      </div>
    </section>
  )
}

function AccessRequired() {
  return (
    <div className="status-shell">
      <section className="status-card shell-box">
        <h2>Sesion requerida</h2>
        <p>Debes iniciar sesion antes de entrar al panel LMS.</p>
        <a className="ghost-btn" href="/acceso.html">Ir al acceso</a>
      </section>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="status-shell">
      <section className="status-card shell-box">
        <h2>Cargando panel</h2>
        <p>Obteniendo cursos, roles y actividad.</p>
      </section>
    </div>
  )
}

function App() {
  const [activeSection, setActiveSection] = useState('dashboard')
  const [leftOpen, setLeftOpen] = useState(false)
  const [courseQuery, setCourseQuery] = useState('')
  const [token, setToken] = useState(() => localStorage.getItem('iqx_auth_token') || '')
  const [user, setUser] = useState(() => parseStoredJson('iqx_auth_user'))
  const [dashboardData, setDashboardData] = useState(null)
  const [courses, setCourses] = useState([])
  const [timelineItems, setTimelineItems] = useState([])
  const [courseMembers, setCourseMembers] = useState([])
  const [courseActivities, setCourseActivities] = useState([])
  const [selectedCourseId, setSelectedCourseId] = useState(null)
  const [courseForm, setCourseForm] = useState(EMPTY_COURSE_FORM)
  const [memberForm, setMemberForm] = useState(EMPTY_MEMBER_FORM)
  const [activityForm, setActivityForm] = useState(EMPTY_ACTIVITY_FORM)
  const [managerMessage, setManagerMessage] = useState(null)
  const [busyAction, setBusyAction] = useState('')
  const [refreshingOverview, setRefreshingOverview] = useState(false)
  const [status, setStatus] = useState(token ? 'loading' : 'unauthorized')

  const selectedCourse = useMemo(() => {
    if (!selectedCourseId) return null
    return courses.find((course) => Number(course.id) === Number(selectedCourseId)) || null
  }, [courses, selectedCourseId])

  const primaryNav = useMemo(() => {
    const base = dashboardData?.primaryNav || DEFAULT_PRIMARY_NAV
    return base.map((item) => {
      if (item.key !== 'content-bank') return item
      return {
        ...item,
        badge: courses.length > 0 ? String(courses.length) : null,
      }
    })
  }, [dashboardData, courses.length])

  const recentCourses = useMemo(() => {
    if (courses.length === 0) {
      return dashboardData?.recentCourses || []
    }

    return courses.slice(0, 8).map((course) => ({
      id: course.id,
      title: course.title,
      level: course.level,
      tone: course.theme,
      category: course.category,
      progress: typeof course.progressPercent === 'number' ? course.progressPercent : null,
    }))
  }, [courses, dashboardData])

  useEffect(() => {
    if (courses.length === 0) {
      setSelectedCourseId(null)
      return
    }

    const exists = courses.some((course) => Number(course.id) === Number(selectedCourseId))
    if (!exists) {
      setSelectedCourseId(courses[0].id)
    }
  }, [courses, selectedCourseId])

  useEffect(() => {
    if (!selectedCourse) {
      setCourseForm(EMPTY_COURSE_FORM)
      return
    }

    setCourseForm({
      code: selectedCourse.code || '',
      title: selectedCourse.title || '',
      category: selectedCourse.category || 'General',
      level: selectedCourse.level || 'Beginner',
      theme: selectedCourse.theme || 'vivid',
      isPublished: selectedCourse.isPublished !== false,
    })
  }, [selectedCourse])

  useEffect(() => {
    if (!managerMessage) return
    const timeoutId = setTimeout(() => setManagerMessage(null), 3500)
    return () => clearTimeout(timeoutId)
  }, [managerMessage])

  async function refreshOverview(authToken) {
    const overview = await apiRequest('/api/dashboard/overview', authToken, { method: 'GET' })
    setDashboardData(overview.data || null)
  }

  async function refreshCourses(authToken, role) {
    const scope = getCourseScope(role)
    const response = await apiRequest(`/api/courses?scope=${scope}&includeUnpublished=true`, authToken, { method: 'GET' })
    setCourses(response.courses || [])
    return response.courses || []
  }

  async function refreshTimeline(authToken) {
    const response = await apiRequest('/api/activities?limit=40', authToken, { method: 'GET' })
    setTimelineItems((response.activities || []).map(mapActivityRow))
  }

  async function refreshCourseDetails(authToken, courseId) {
    if (!courseId) {
      setCourseMembers([])
      setCourseActivities([])
      return
    }

    const [members, activities] = await Promise.all([
      apiRequest(`/api/courses/${courseId}/members`, authToken, { method: 'GET' }),
      apiRequest(`/api/activities?courseId=${courseId}&limit=60`, authToken, { method: 'GET' }),
    ])

    setCourseMembers(members.members || [])
    setCourseActivities((activities.activities || []).map(mapActivityRow))
  }

  async function refreshWorkspace(authToken, role, courseId) {
    setRefreshingOverview(true)
    try {
      await Promise.all([
        refreshOverview(authToken),
        refreshCourses(authToken, role),
        refreshTimeline(authToken),
      ])
      if (courseId) {
        await refreshCourseDetails(authToken, courseId)
      }
    } finally {
      setRefreshingOverview(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      if (!token) {
        setStatus('unauthorized')
        setUser(null)
        setDashboardData(null)
        setCourses([])
        setTimelineItems([])
        return
      }

      try {
        setStatus('loading')

        const me = await apiRequest('/api/auth/me', token, { method: 'GET' })
        if (cancelled) return

        setUser(me.user)
        localStorage.setItem('iqx_auth_user', JSON.stringify(me.user))

        await refreshWorkspace(token, me.user.role, selectedCourseId)

        if (cancelled) return
        setStatus('ready')
      } catch (_) {
        if (cancelled) return

        localStorage.removeItem('iqx_auth_token')
        localStorage.removeItem('iqx_auth_user')
        setToken('')
        setUser(null)
        setDashboardData(null)
        setCourses([])
        setTimelineItems([])
        setCourseMembers([])
        setCourseActivities([])
        setStatus('unauthorized')
      }
    }

    bootstrap()

    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    let cancelled = false

    async function loadSelectedCourseData() {
      if (status !== 'ready' || !token || !selectedCourseId) {
        setCourseMembers([])
        setCourseActivities([])
        return
      }

      try {
        await refreshCourseDetails(token, selectedCourseId)
      } catch (error) {
        if (cancelled) return

        if (error.status === 403 || error.status === 404) {
          setCourseMembers([])
          setCourseActivities([])
          return
        }

        setManagerMessage({ type: 'error', text: error.message || 'No se pudo cargar el detalle del curso' })
      }
    }

    loadSelectedCourseData()

    return () => {
      cancelled = true
    }
  }, [status, token, selectedCourseId])

  async function handleLogout() {
    try {
      if (token) {
        await apiRequest('/api/auth/logout', token, { method: 'POST', body: JSON.stringify({}) })
      }
    } catch (_) {
    } finally {
      localStorage.removeItem('iqx_auth_token')
      localStorage.removeItem('iqx_auth_user')
      setToken('')
      setUser(null)
      setDashboardData(null)
      setCourses([])
      setTimelineItems([])
      setCourseMembers([])
      setCourseActivities([])
      setStatus('unauthorized')
      window.location.href = '/acceso.html'
    }
  }

  function onCourseFieldChange(event) {
    const { name, value, type, checked } = event.target
    setCourseForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function onMemberFieldChange(event) {
    const { name, value } = event.target
    setMemberForm((prev) => ({
      ...prev,
      [name]: name === 'progressPercent' ? Number(value) : value,
    }))
  }

  function onActivityFieldChange(event) {
    const { name, value } = event.target
    setActivityForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  async function onCreateCourse(event) {
    event.preventDefault()
    if (!token || !user) return

    setBusyAction('create-course')
    setManagerMessage(null)

    try {
      const result = await apiRequest('/api/courses', token, {
        method: 'POST',
        body: JSON.stringify({
          code: courseForm.code,
          title: courseForm.title,
          category: courseForm.category,
          level: courseForm.level,
          theme: courseForm.theme,
          isPublished: Boolean(courseForm.isPublished),
        }),
      })

      await refreshWorkspace(token, user.role, result.course?.id || selectedCourseId)

      if (result.course?.id) {
        setSelectedCourseId(result.course.id)
      }

      setManagerMessage({ type: 'success', text: `Curso creado: ${result.course?.title || 'ok'}` })
    } catch (error) {
      setManagerMessage({ type: 'error', text: error.message || 'No se pudo crear el curso' })
    } finally {
      setBusyAction('')
    }
  }

  async function onUpdateCourse() {
    if (!token || !selectedCourse) return

    setBusyAction('update-course')
    setManagerMessage(null)

    try {
      await apiRequest(`/api/courses/${selectedCourse.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({
          title: courseForm.title,
          category: courseForm.category,
          level: courseForm.level,
          theme: courseForm.theme,
          isPublished: Boolean(courseForm.isPublished),
        }),
      })

      await refreshWorkspace(token, user.role, selectedCourse.id)

      setManagerMessage({ type: 'success', text: 'Curso actualizado' })
    } catch (error) {
      setManagerMessage({ type: 'error', text: error.message || 'No se pudo actualizar el curso' })
    } finally {
      setBusyAction('')
    }
  }

  async function onArchiveCourse() {
    if (!token || !selectedCourse) return
    if (!window.confirm(`¿Archivar el curso "${selectedCourse.title}"?`)) return

    setBusyAction('archive-course')
    setManagerMessage(null)

    try {
      await apiRequest(`/api/courses/${selectedCourse.id}`, token, {
        method: 'DELETE',
      })

      await refreshWorkspace(token, user.role, null)

      setManagerMessage({ type: 'success', text: 'Curso archivado' })
    } catch (error) {
      setManagerMessage({ type: 'error', text: error.message || 'No se pudo archivar el curso' })
    } finally {
      setBusyAction('')
    }
  }

  async function onAddMember(event) {
    event.preventDefault()
    if (!token || !selectedCourse) return

    setBusyAction('member-add')
    setManagerMessage(null)

    try {
      await apiRequest(`/api/courses/${selectedCourse.id}/members`, token, {
        method: 'POST',
        body: JSON.stringify({
          email: memberForm.email,
          role: memberForm.role,
          progressPercent: Number(memberForm.progressPercent),
        }),
      })

      await refreshWorkspace(token, user.role, selectedCourse.id)

      setMemberForm(EMPTY_MEMBER_FORM)
      setManagerMessage({ type: 'success', text: 'Miembro guardado' })
    } catch (error) {
      setManagerMessage({ type: 'error', text: error.message || 'No se pudo guardar el miembro' })
    } finally {
      setBusyAction('')
    }
  }

  async function onRemoveMember(memberUserId) {
    if (!token || !selectedCourse) return
    if (!window.confirm('¿Quitar este miembro del curso?')) return

    const actionId = `member-remove-${memberUserId}`
    setBusyAction(actionId)
    setManagerMessage(null)

    try {
      await apiRequest(`/api/courses/${selectedCourse.id}/members/${memberUserId}`, token, {
        method: 'DELETE',
      })

      await refreshWorkspace(token, user.role, selectedCourse.id)

      setManagerMessage({ type: 'success', text: 'Miembro removido' })
    } catch (error) {
      setManagerMessage({ type: 'error', text: error.message || 'No se pudo quitar el miembro' })
    } finally {
      setBusyAction('')
    }
  }

  async function onCreateActivity(event) {
    event.preventDefault()
    if (!token || !selectedCourse) return

    setBusyAction('activity-add')
    setManagerMessage(null)

    try {
      await apiRequest('/api/activities', token, {
        method: 'POST',
        body: JSON.stringify({
          courseId: selectedCourse.id,
          title: activityForm.title,
          description: activityForm.description,
          eventType: activityForm.eventType,
        }),
      })

      await refreshWorkspace(token, user.role, selectedCourse.id)

      setActivityForm(EMPTY_ACTIVITY_FORM)
      setManagerMessage({ type: 'success', text: 'Actividad creada' })
    } catch (error) {
      setManagerMessage({ type: 'error', text: error.message || 'No se pudo crear la actividad' })
    } finally {
      setBusyAction('')
    }
  }

  async function onRenameActivity(activityId, currentTitle) {
    if (!token || !selectedCourse) return

    const nextTitle = window.prompt('Nuevo titulo de actividad', currentTitle)
    if (nextTitle === null) return

    const normalized = nextTitle.trim()
    if (normalized.length < 3) {
      setManagerMessage({ type: 'error', text: 'El titulo debe tener al menos 3 caracteres' })
      return
    }

    const actionId = `activity-edit-${activityId}`
    setBusyAction(actionId)
    setManagerMessage(null)

    try {
      await apiRequest(`/api/activities/${activityId}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ title: normalized }),
      })

      await refreshWorkspace(token, user.role, selectedCourse.id)

      setManagerMessage({ type: 'success', text: 'Actividad actualizada' })
    } catch (error) {
      setManagerMessage({ type: 'error', text: error.message || 'No se pudo actualizar la actividad' })
    } finally {
      setBusyAction('')
    }
  }

  async function onDeleteActivity(activityId) {
    if (!token || !selectedCourse) return
    if (!window.confirm('¿Eliminar este evento de actividad?')) return

    const actionId = `activity-delete-${activityId}`
    setBusyAction(actionId)
    setManagerMessage(null)

    try {
      await apiRequest(`/api/activities/${activityId}`, token, {
        method: 'DELETE',
      })

      await refreshWorkspace(token, user.role, selectedCourse.id)

      setManagerMessage({ type: 'success', text: 'Actividad eliminada' })
    } catch (error) {
      setManagerMessage({ type: 'error', text: error.message || 'No se pudo eliminar la actividad' })
    } finally {
      setBusyAction('')
    }
  }

  async function onRefreshOverview() {
    if (!token || !user) return
    setManagerMessage(null)
    try {
      await refreshWorkspace(token, user.role, selectedCourseId)
      setManagerMessage({ type: 'success', text: 'Datos actualizados' })
    } catch (error) {
      setManagerMessage({ type: 'error', text: error.message || 'No se pudo actualizar la informacion' })
    }
  }

  if (status === 'unauthorized') {
    return <AccessRequired />
  }

  if (status === 'loading' || !user) {
    return <LoadingState />
  }

  return (
    <div className="lms-page">
      <div className="lms-shell">
        <div className={`side-layer left ${leftOpen ? 'open' : ''}`}>
          <Sidebar
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            primaryNav={primaryNav}
            courses={courses}
            selectedCourseId={selectedCourseId}
            onSelectCourse={setSelectedCourseId}
            courseQuery={courseQuery}
            onCourseQueryChange={setCourseQuery}
          />
        </div>

        <section className="center-area">
          <Topbar
            onToggleLeft={() => setLeftOpen((prev) => !prev)}
            onLogout={handleLogout}
            user={user}
            selectedCourse={selectedCourse}
            totalCourses={courses.length}
          />

          <main className="center-content">
            {activeSection === 'dashboard' ? (
              <>
                <OverviewSection
                  user={user}
                  courses={courses}
                  selectedCourse={selectedCourse}
                  timelineItems={timelineItems}
                  onGoToManagement={() => setActiveSection('content-bank')}
                  onRefresh={onRefreshOverview}
                  refreshing={refreshingOverview}
                />
                <CoursesSection recentCourses={recentCourses} />
                <TimelineSection timelineItems={timelineItems} />
              </>
            ) : null}

            {activeSection === 'content-bank' ? (
              <ContentBankSection
                user={user}
                courses={courses}
                selectedCourse={selectedCourse}
                selectedCourseId={selectedCourseId}
                onSelectCourse={setSelectedCourseId}
                members={courseMembers}
                activities={courseActivities}
                courseForm={courseForm}
                onCourseChange={onCourseFieldChange}
                onCreateCourse={onCreateCourse}
                onUpdateCourse={onUpdateCourse}
                onArchiveCourse={onArchiveCourse}
                memberForm={memberForm}
                onMemberChange={onMemberFieldChange}
                onAddMember={onAddMember}
                onRemoveMember={onRemoveMember}
                activityForm={activityForm}
                onActivityChange={onActivityFieldChange}
                onCreateActivity={onCreateActivity}
                onRenameActivity={onRenameActivity}
                onDeleteActivity={onDeleteActivity}
                busyAction={busyAction}
                managerMessage={managerMessage}
              />
            ) : null}
          </main>
        </section>
      </div>

      {leftOpen ? (
        <button
          aria-label="Close overlays"
          className="backdrop"
          type="button"
          onClick={() => {
            setLeftOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}

export default App
