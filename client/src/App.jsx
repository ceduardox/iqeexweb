import { useEffect, useMemo, useState } from 'react'
import './App.css'

const DEFAULT_PRIMARY_NAV = [
  { key: 'dashboard', label: 'Dashboard', badge: null },
  { key: 'calendar', label: 'Calendar', badge: null },
  { key: 'private-files', label: 'Private files', badge: null },
  { key: 'content-bank', label: 'Content bank', badge: null },
]

const DEFAULT_SUPPORT_NAV = [
  { key: 'learn-theme', label: 'Learn this theme' },
  { key: 'docs', label: 'Documentation' },
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
    return 'Administrator'
  }

  if (normalized === 'teacher') {
    return 'Teacher'
  }

  return 'Student'
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
    const error = new Error(data.message || 'Request failed')
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

function Sidebar({ activeSection, onSectionChange, primaryNav, supportNav, courses, user, selectedCourseId, onSelectCourse }) {
  const activeCourses = courses.slice(0, 4)

  return (
    <aside className="left-sidebar">
      <div className="search-box shell-box">
        <Icon name="search" />
        <input type="text" placeholder="Search" />
      </div>

      <section className="nav-group shell-box">
        <header className="group-header">
          <span>My Courses</span>
          <span className="counter-pill">{courses.length}</span>
        </header>

        <div className="mini-search">
          <Icon name="search" />
          <input type="text" placeholder="Search" />
        </div>

        <label className="toggle-row">
          <input type="checkbox" defaultChecked />
          <span>Only courses in progress</span>
        </label>

        <ul className="course-links">
          {activeCourses.length > 0 ? (
            activeCourses.map((course) => {
              const selected = Number(course.id) === Number(selectedCourseId)
              return (
                <li key={course.id} className={selected ? 'active' : ''}>
                  <button type="button" onClick={() => onSelectCourse(course.id)}>
                    <span>{course.title}</span>
                    {course.isPublished === false ? <small>Archived</small> : null}
                  </button>
                </li>
              )
            })
          ) : (
            <li className="active">
              <button type="button">No courses assigned yet</button>
            </li>
          )}
        </ul>
      </section>

      <section className="nav-group shell-box">
        <header className="group-header muted">Course overview</header>
        <ul className="menu-list">
          {primaryNav.map((item) => (
            <li key={item.key} className={item.key === activeSection ? 'active' : ''}>
              <button type="button" onClick={() => onSectionChange(item.key)}>
                <Icon
                  name={
                    item.key === 'dashboard'
                      ? 'dashboard'
                      : item.key === 'calendar'
                        ? 'calendar'
                        : item.key === 'private-files'
                          ? 'files'
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

      <section className="nav-group shell-box slim">
        <ul className="menu-list">
          {supportNav.map((item) => (
            <li key={item.key}>
              <button type="button">
                <Icon name={item.key === 'learn-theme' ? 'help' : 'doc'} />
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <footer className="sidebar-footer shell-box">
        <button type="button">
          <Icon name="dashboard" />
          <span>{user.role === 'admin' ? 'Site administration' : 'My workspace'}</span>
        </button>
      </footer>
    </aside>
  )
}

function Topbar({ onToggleLeft, onToggleRight, user, onLogout }) {
  const initials = initialsFromName(user.fullName)

  return (
    <header className="topbar shell-box">
      <div className="topbar-left">
        <button className="icon-btn mobile-only" type="button" onClick={onToggleLeft}>
          <Icon name="menu" />
        </button>

        <div className="brand-mark" aria-hidden="true">IQ</div>

        <button className="ghost-btn" type="button">
          <Icon name="courses" />
          <span>Courses</span>
        </button>

        <button className="ghost-btn" type="button">
          <span>Doc</span>
        </button>

        <button className="ghost-btn" type="button">
          <span>Server</span>
        </button>
      </div>

      <div className="topbar-right">
        <div className="user-meta">
          <strong>{user.fullName}</strong>
          <span>{roleLabel(user.role)}</span>
        </div>

        <button className="icon-btn" type="button"><Icon name="globe" /></button>
        <button className="icon-btn" type="button"><Icon name="bell" /></button>
        <button className="icon-btn" type="button"><Icon name="chat" /></button>
        <button className="icon-btn mobile-only" type="button" onClick={onToggleRight}><Icon name="panel" /></button>

        <div className="avatar-block">
          <div className="avatar-dot">3</div>
          <div className="avatar">{initials}</div>
        </div>

        <button className="ghost-btn" type="button" onClick={onLogout}>
          <Icon name="logout" />
          <span>Logout</span>
        </button>
      </div>
    </header>
  )
}

function CoursesSection({ recentCourses }) {
  return (
    <section className="block shell-box">
      <header className="block-header">
        <h2>Recently Accessed Courses</h2>
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
              <h3>No Courses</h3>
              <p>Request course assignment from an administrator.</p>
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
        <h2>Timeline</h2>
        <button className="icon-btn" type="button"><Icon name="panel" /></button>
      </header>

      <div className="timeline-tools">
        <button className="chip-btn" type="button">All</button>
        <div className="mini-search grow">
          <Icon name="search" />
          <input
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
            type="text"
            placeholder="Search activity"
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
                <button className="ghost-btn small" type="button">View</button>
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
                <p>Activity timeline will appear here.</p>
              </div>
            </div>
          </li>
        )}
      </ul>
    </section>
  )
}

function RightPanel({ tags, recentItems, privateFiles, categories }) {
  return (
    <aside className="right-sidebar shell-box">
      <section className="panel-block">
        <h3>Tags</h3>
        <div className="tag-list">
          {tags.map((tag) => (
            <button key={tag} type="button" className="tag">{tag}</button>
          ))}
        </div>
      </section>

      <section className="panel-block">
        <h3>Recently Accessed Items</h3>
        <ul className="panel-list">
          {recentItems.length > 0 ? recentItems.map((item) => <li key={item}>{item}</li>) : <li>No recent items</li>}
        </ul>
      </section>

      <section className="panel-block">
        <h3>Private Files</h3>
        <ul className="panel-list compact">
          {privateFiles.length > 0 ? privateFiles.map((file) => <li key={file}>{file}</li>) : <li>No private files</li>}
        </ul>
      </section>

      <section className="panel-block">
        <h3>Global Search</h3>
        <div className="mini-search">
          <Icon name="search" />
          <input type="text" placeholder="Search" />
        </div>
      </section>

      <section className="panel-block">
        <h3>Course Categories</h3>
        <ul className="panel-list compact">
          {categories.length > 0 ? categories.map((category) => <li key={category}>{category}</li>) : <li>No categories</li>}
        </ul>
      </section>
    </aside>
  )
}

function CalendarSection({ timelineItems }) {
  return (
    <section className="block shell-box">
      <header className="block-header">
        <h2>Calendar</h2>
      </header>
      <ul className="panel-list">
        {timelineItems.length > 0 ? (
          timelineItems.slice(0, 8).map((item) => (
            <li key={item.id}>{item.time} - {item.title}</li>
          ))
        ) : (
          <li>No upcoming calendar events</li>
        )}
      </ul>
    </section>
  )
}

function PrivateFilesSection({ privateFiles }) {
  return (
    <section className="block shell-box">
      <header className="block-header">
        <h2>Private Files</h2>
      </header>
      <ul className="panel-list">
        {privateFiles.length > 0 ? privateFiles.map((item) => <li key={item}>{item}</li>) : <li>No private files available</li>}
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
        <h2>Content Bank And Management</h2>
      </header>

      {managerMessage ? (
        <p className={`manager-message ${managerMessage.type === 'error' ? 'error' : 'success'}`}>
          {managerMessage.text}
        </p>
      ) : null}

      <div className="manager-grid">
        <article className="manager-card">
          <h3>Course Catalog</h3>
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
              <li className="manager-empty">No courses available.</li>
            )}
          </ul>
        </article>

        <article className="manager-card">
          <h3>Course Settings</h3>
          <form className="manager-form" onSubmit={onCreateCourse}>
            <div className="form-grid">
              <label>
                Code
                <input name="code" value={courseForm.code} onChange={onCourseChange} placeholder="BIO-101" />
              </label>
              <label>
                Title
                <input name="title" value={courseForm.title} onChange={onCourseChange} required minLength={3} />
              </label>
              <label>
                Category
                <input name="category" value={courseForm.category} onChange={onCourseChange} />
              </label>
              <label>
                Level
                <input name="level" value={courseForm.level} onChange={onCourseChange} />
              </label>
              <label>
                Theme
                <select name="theme" value={courseForm.theme} onChange={onCourseChange}>
                  <option value="vivid">Vivid</option>
                  <option value="earth">Earth</option>
                </select>
              </label>
              <label className="checkbox-row">
                <input type="checkbox" name="isPublished" checked={Boolean(courseForm.isPublished)} onChange={onCourseChange} />
                <span>Published</span>
              </label>
            </div>

            <div className="manager-actions">
              <button className="ghost-btn" type="submit" disabled={!canCreateCourse || busyAction === 'create-course'}>Create course</button>
              <button className="ghost-btn" type="button" onClick={onUpdateCourse} disabled={!canManageSelectedCourse || busyAction === 'update-course'}>Update selected</button>
              <button className="ghost-btn danger-btn" type="button" onClick={onArchiveCourse} disabled={!canManageSelectedCourse || busyAction === 'archive-course'}>Archive selected</button>
            </div>

            {selectedCourse ? (
              <p className="manager-note">
                Active: <strong>{selectedCourse.title}</strong>{' '}
                {selectedCourse.isPublished ? <span className="course-state online">Published</span> : <span className="course-state archived">Archived</span>}
              </p>
            ) : (
              <p className="manager-note">Pick a course to edit membership and activity.</p>
            )}
          </form>
        </article>

        <article className="manager-card">
          <h3>Course Members</h3>
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
                      <button className="ghost-btn small" type="button" onClick={() => onRemoveMember(member.id)} disabled={!canManageSelectedCourse || busyAction === `member-remove-${member.id}` || Number(member.id) === Number(user.id)}>Remove</button>
                    </li>
                  ))
                ) : (
                  <li className="manager-empty">No members assigned yet.</li>
                )}
              </ul>

              <form className="manager-form" onSubmit={onAddMember}>
                <div className="form-grid">
                  <label>
                    User email
                    <input type="email" name="email" value={memberForm.email} onChange={onMemberChange} required />
                  </label>
                  <label>
                    Role
                    <select name="role" value={memberForm.role} onChange={onMemberChange}>
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="assistant">Assistant</option>
                    </select>
                  </label>
                  <label>
                    Progress
                    <input type="number" min="0" max="100" name="progressPercent" value={memberForm.progressPercent} onChange={onMemberChange} />
                  </label>
                </div>
                <div className="manager-actions">
                  <button className="ghost-btn" type="submit" disabled={!canManageSelectedCourse || busyAction === 'member-add'}>Save member</button>
                </div>
              </form>
            </>
          ) : (
            <p className="manager-empty">Select a course first.</p>
          )}
        </article>

        <article className="manager-card">
          <h3>Course Activity</h3>
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
                        <button className="ghost-btn small" type="button" onClick={() => onRenameActivity(activity.id, activity.title)} disabled={!canManageSelectedCourse || busyAction === `activity-edit-${activity.id}`}>Rename</button>
                        <button className="ghost-btn small danger-btn" type="button" onClick={() => onDeleteActivity(activity.id)} disabled={!canManageSelectedCourse || busyAction === `activity-delete-${activity.id}`}>Delete</button>
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="manager-empty">No activity events for this course.</li>
                )}
              </ul>

              <form className="manager-form" onSubmit={onCreateActivity}>
                <div className="form-grid">
                  <label>
                    Title
                    <input name="title" value={activityForm.title} onChange={onActivityChange} required minLength={3} />
                  </label>
                  <label>
                    Type
                    <select name="eventType" value={activityForm.eventType} onChange={onActivityChange}>
                      <option value="task">Task</option>
                      <option value="quiz">Quiz</option>
                      <option value="discussion">Discussion</option>
                      <option value="file">File</option>
                    </select>
                  </label>
                </div>
                <label>
                  Description
                  <textarea name="description" rows="2" value={activityForm.description} onChange={onActivityChange} />
                </label>
                <div className="manager-actions">
                  <button className="ghost-btn" type="submit" disabled={!canManageSelectedCourse || busyAction === 'activity-add'}>Create activity</button>
                </div>
              </form>
            </>
          ) : (
            <p className="manager-empty">Select a course first.</p>
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
        <h2>Session Required</h2>
        <p>You need to sign in before entering the LMS dashboard.</p>
        <a className="ghost-btn" href="/acceso.html">Go to Access Panel</a>
      </section>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="status-shell">
      <section className="status-card shell-box">
        <h2>Loading dashboard</h2>
        <p>Fetching your role, courses, and timeline data.</p>
      </section>
    </div>
  )
}

function App() {
  const [activeSection, setActiveSection] = useState('dashboard')
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)
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

  const supportNav = dashboardData?.supportNav || DEFAULT_SUPPORT_NAV

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

  const tags = useMemo(() => {
    const values = new Set(dashboardData?.tags || [])
    if (selectedCourse?.category) values.add(String(selectedCourse.category).toLowerCase())
    return Array.from(values)
  }, [dashboardData, selectedCourse])

  const categories = useMemo(() => {
    if (courses.length === 0) return dashboardData?.categories || []
    return Array.from(new Set(courses.map((course) => course.category).filter(Boolean)))
  }, [courses, dashboardData])

  const recentItems = useMemo(() => {
    if (timelineItems.length === 0) return dashboardData?.recentItems || []
    return timelineItems.slice(0, 5).map((item) => item.title)
  }, [timelineItems, dashboardData])

  const privateFiles = dashboardData?.privateFiles || []

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

        await Promise.all([
          refreshOverview(token),
          refreshCourses(token, me.user.role),
          refreshTimeline(token),
        ])

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

        setManagerMessage({ type: 'error', text: error.message || 'Cannot load course details' })
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

      await Promise.all([
        refreshCourses(token, user.role),
        refreshTimeline(token),
        refreshOverview(token),
      ])

      if (result.course?.id) {
        setSelectedCourseId(result.course.id)
      }

      setManagerMessage({ type: 'success', text: `Course created: ${result.course?.title || 'ok'}` })
    } catch (error) {
      setManagerMessage({ type: 'error', text: error.message || 'Cannot create course' })
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

      await Promise.all([
        refreshCourses(token, user.role),
        refreshOverview(token),
      ])

      setManagerMessage({ type: 'success', text: 'Course updated' })
    } catch (error) {
      setManagerMessage({ type: 'error', text: error.message || 'Cannot update course' })
    } finally {
      setBusyAction('')
    }
  }

  async function onArchiveCourse() {
    if (!token || !selectedCourse) return
    if (!window.confirm(`Archive course "${selectedCourse.title}"?`)) return

    setBusyAction('archive-course')
    setManagerMessage(null)

    try {
      await apiRequest(`/api/courses/${selectedCourse.id}`, token, {
        method: 'DELETE',
      })

      await Promise.all([
        refreshCourses(token, user.role),
        refreshOverview(token),
      ])

      setManagerMessage({ type: 'success', text: 'Course archived' })
    } catch (error) {
      setManagerMessage({ type: 'error', text: error.message || 'Cannot archive course' })
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

      await Promise.all([
        refreshCourseDetails(token, selectedCourse.id),
        refreshCourses(token, user.role),
      ])

      setMemberForm(EMPTY_MEMBER_FORM)
      setManagerMessage({ type: 'success', text: 'Member saved' })
    } catch (error) {
      setManagerMessage({ type: 'error', text: error.message || 'Cannot save member' })
    } finally {
      setBusyAction('')
    }
  }

  async function onRemoveMember(memberUserId) {
    if (!token || !selectedCourse) return
    if (!window.confirm('Remove this member from the course?')) return

    const actionId = `member-remove-${memberUserId}`
    setBusyAction(actionId)
    setManagerMessage(null)

    try {
      await apiRequest(`/api/courses/${selectedCourse.id}/members/${memberUserId}`, token, {
        method: 'DELETE',
      })

      await Promise.all([
        refreshCourseDetails(token, selectedCourse.id),
        refreshCourses(token, user.role),
      ])

      setManagerMessage({ type: 'success', text: 'Member removed' })
    } catch (error) {
      setManagerMessage({ type: 'error', text: error.message || 'Cannot remove member' })
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

      await Promise.all([
        refreshCourseDetails(token, selectedCourse.id),
        refreshTimeline(token),
        refreshOverview(token),
      ])

      setActivityForm(EMPTY_ACTIVITY_FORM)
      setManagerMessage({ type: 'success', text: 'Activity created' })
    } catch (error) {
      setManagerMessage({ type: 'error', text: error.message || 'Cannot create activity' })
    } finally {
      setBusyAction('')
    }
  }

  async function onRenameActivity(activityId, currentTitle) {
    if (!token || !selectedCourse) return

    const nextTitle = window.prompt('New activity title', currentTitle)
    if (nextTitle === null) return

    const normalized = nextTitle.trim()
    if (normalized.length < 3) {
      setManagerMessage({ type: 'error', text: 'Activity title must contain at least 3 characters' })
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

      await Promise.all([
        refreshCourseDetails(token, selectedCourse.id),
        refreshTimeline(token),
        refreshOverview(token),
      ])

      setManagerMessage({ type: 'success', text: 'Activity updated' })
    } catch (error) {
      setManagerMessage({ type: 'error', text: error.message || 'Cannot update activity' })
    } finally {
      setBusyAction('')
    }
  }

  async function onDeleteActivity(activityId) {
    if (!token || !selectedCourse) return
    if (!window.confirm('Delete this activity event?')) return

    const actionId = `activity-delete-${activityId}`
    setBusyAction(actionId)
    setManagerMessage(null)

    try {
      await apiRequest(`/api/activities/${activityId}`, token, {
        method: 'DELETE',
      })

      await Promise.all([
        refreshCourseDetails(token, selectedCourse.id),
        refreshTimeline(token),
        refreshOverview(token),
      ])

      setManagerMessage({ type: 'success', text: 'Activity deleted' })
    } catch (error) {
      setManagerMessage({ type: 'error', text: error.message || 'Cannot delete activity' })
    } finally {
      setBusyAction('')
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
            supportNav={supportNav}
            courses={courses}
            user={user}
            selectedCourseId={selectedCourseId}
            onSelectCourse={setSelectedCourseId}
          />
        </div>

        <section className="center-area">
          <Topbar
            onToggleLeft={() => setLeftOpen((prev) => !prev)}
            onToggleRight={() => setRightOpen((prev) => !prev)}
            onLogout={handleLogout}
            user={user}
          />

          <main className="center-content">
            {activeSection === 'dashboard' ? (
              <>
                <CoursesSection recentCourses={recentCourses} />
                <TimelineSection timelineItems={timelineItems} />
              </>
            ) : null}

            {activeSection === 'calendar' ? <CalendarSection timelineItems={timelineItems} /> : null}
            {activeSection === 'private-files' ? <PrivateFilesSection privateFiles={privateFiles} /> : null}
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

        <div className={`side-layer right ${rightOpen ? 'open' : ''}`}>
          <RightPanel tags={tags} recentItems={recentItems} privateFiles={privateFiles} categories={categories} />
        </div>
      </div>

      {(leftOpen || rightOpen) ? (
        <button
          aria-label="Close overlays"
          className="backdrop"
          type="button"
          onClick={() => {
            setLeftOpen(false)
            setRightOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}

export default App
