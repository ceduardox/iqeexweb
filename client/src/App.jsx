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
  }

  const d = pathByName[name] || pathByName.dashboard

  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Sidebar({ activeSection, onSectionChange, primaryNav, supportNav, courses, user }) {
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
            activeCourses.map((course, index) => (
              <li key={course.id || `${course.title}-${index}`} className={index === 0 ? 'active' : ''}>{course.title}</li>
            ))
          ) : (
            <li className="active">No courses assigned yet</li>
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

function ContentBankSection({ tags, categories }) {
  return (
    <section className="block shell-box">
      <header className="block-header">
        <h2>Content Bank</h2>
      </header>
      <div className="tag-list">
        {tags.map((tag) => <button key={tag} type="button" className="tag">{tag}</button>)}
      </div>
      <ul className="panel-list">
        {categories.length > 0 ? categories.map((category) => <li key={category}>Category: {category}</li>) : <li>No content categories</li>}
      </ul>
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
  const [status, setStatus] = useState(token ? 'loading' : 'unauthorized')

  useEffect(() => {
    let cancelled = false

    async function loadDashboard() {
      if (!token) {
        setStatus('unauthorized')
        setDashboardData(null)
        return
      }

      try {
        setStatus('loading')

        const me = await apiRequest('/api/auth/me', token, { method: 'GET' })
        const overview = await apiRequest('/api/dashboard/overview', token, { method: 'GET' })

        if (cancelled) {
          return
        }

        setUser(me.user)
        localStorage.setItem('iqx_auth_user', JSON.stringify(me.user))
        setDashboardData(overview.data)
        setStatus('ready')
      } catch (_) {
        if (cancelled) {
          return
        }

        localStorage.removeItem('iqx_auth_token')
        localStorage.removeItem('iqx_auth_user')
        setToken('')
        setUser(null)
        setDashboardData(null)
        setStatus('unauthorized')
      }
    }

    loadDashboard()

    return () => {
      cancelled = true
    }
  }, [token])

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
      setStatus('unauthorized')
      window.location.href = '/acceso.html'
    }
  }

  if (status === 'unauthorized') {
    return <AccessRequired />
  }

  if (status === 'loading' || !dashboardData || !user) {
    return <LoadingState />
  }

  const primaryNav = dashboardData.primaryNav || DEFAULT_PRIMARY_NAV
  const supportNav = dashboardData.supportNav || DEFAULT_SUPPORT_NAV
  const recentCourses = dashboardData.recentCourses || []
  const timelineItems = dashboardData.timelineItems || []
  const tags = dashboardData.tags || []
  const recentItems = dashboardData.recentItems || []
  const privateFiles = dashboardData.privateFiles || []
  const categories = dashboardData.categories || []

  return (
    <div className="lms-page">
      <div className="lms-shell">
        <div className={`side-layer left ${leftOpen ? 'open' : ''}`}>
          <Sidebar
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            primaryNav={primaryNav}
            supportNav={supportNav}
            courses={recentCourses}
            user={user}
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
            {activeSection === 'content-bank' ? <ContentBankSection tags={tags} categories={categories} /> : null}
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
