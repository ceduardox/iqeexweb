import { useMemo, useState } from 'react'
import './App.css'

const primaryNav = [
  { key: 'dashboard', label: 'Dashboard', badge: null },
  { key: 'calendar', label: 'Calendar', badge: null },
  { key: 'private-files', label: 'Private files', badge: null },
  { key: 'content-bank', label: 'Content bank', badge: null },
]

const supportNav = [
  { key: 'learn-theme', label: 'Learn this theme' },
  { key: 'docs', label: 'Documentation' },
]

const recentCourses = [
  {
    id: 'bio',
    title: 'In-build Moodle Activities',
    level: 'Intermediate',
    tone: 'vivid',
  },
  {
    id: 'water',
    title: 'World of Water',
    level: 'Beginner',
    tone: 'earth',
  },
]

const timelineItems = [
  {
    id: 1,
    time: '17:52',
    title: 'What do you think about course completion',
    course: 'Your Road to Better Photography',
    type: 'task',
  },
  {
    id: 2,
    time: '17:52',
    title: 'Chemistry assignment submitted',
    course: 'In-build Moodle Activities',
    type: 'file',
  },
  {
    id: 3,
    time: '17:52',
    title: 'Course discussion updated',
    course: 'Gods and Kings',
    type: 'discussion',
  },
  {
    id: 4,
    time: '17:52',
    title: 'Biology quiz review pending',
    course: 'Biology Foundation Course',
    type: 'quiz',
  },
]

const tags = ['accessibility', 'assets', 'demo', 'doc', 'moodle', 'post', 'survey', 'theme', 'ui-kit']

const recentItems = [
  'Chemical Nomenclature List 1B',
  'End of unit assessment',
  'Waterbase assets',
  'Lecture transcript upload',
]

const privateFiles = ['2560px-moodle-logo.svg', '6874747073a2f2f696d...']

const categories = ['Beginner', 'Intermediate', 'Advanced']

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
  }

  const d = pathByName[name] || pathByName.dashboard

  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Sidebar({ activeSection }) {
  return (
    <aside className="left-sidebar">
      <div className="search-box shell-box">
        <Icon name="search" />
        <input type="text" placeholder="Search" />
      </div>

      <section className="nav-group shell-box">
        <header className="group-header">
          <span>My Courses</span>
          <span className="counter-pill">4</span>
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
          <li className="active">Basics on Cell Biology</li>
          <li>Gods and Kings: The Art History of Mesopotamia</li>
          <li>In-build Moodle Activities</li>
          <li>Your Road to Better Photography</li>
        </ul>
      </section>

      <section className="nav-group shell-box">
        <header className="group-header muted">Course overview</header>
        <ul className="menu-list">
          {primaryNav.map((item) => (
            <li key={item.key} className={item.key === activeSection ? 'active' : ''}>
              <button type="button">
                <Icon name={item.key === 'dashboard' ? 'dashboard' : item.key === 'calendar' ? 'calendar' : item.key === 'private-files' ? 'files' : 'content'} />
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
          <span>Site administration</span>
        </button>
      </footer>
    </aside>
  )
}

function Topbar({ onToggleLeft, onToggleRight }) {
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
        <button className="icon-btn" type="button"><Icon name="globe" /></button>
        <button className="icon-btn" type="button"><Icon name="bell" /></button>
        <button className="icon-btn" type="button"><Icon name="chat" /></button>
        <button className="icon-btn mobile-only" type="button" onClick={onToggleRight}><Icon name="panel" /></button>

        <div className="avatar-block">
          <div className="avatar-dot">3</div>
          <div className="avatar">JC</div>
        </div>
      </div>
    </header>
  )
}

function CoursesSection() {
  return (
    <section className="block shell-box">
      <header className="block-header">
        <h2>Recently Accessed Courses</h2>
      </header>

      <div className="course-grid">
        {recentCourses.map((course) => (
          <article key={course.id} className={`course-card ${course.tone}`}>
            <div className="overlay" />
            <div className="content">
              <h3>{course.title}</h3>
              <p>{course.level}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function TimelineSection() {
  const [filterText, setFilterText] = useState('')

  const rows = useMemo(() => {
    const needle = filterText.trim().toLowerCase()
    if (!needle) return timelineItems
    return timelineItems.filter((item) => {
      return item.title.toLowerCase().includes(needle) || item.course.toLowerCase().includes(needle)
    })
  }, [filterText])

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
        {rows.map((item) => (
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
        ))}
      </ul>
    </section>
  )
}

function RightPanel() {
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
          {recentItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="panel-block">
        <h3>Private Files</h3>
        <ul className="panel-list compact">
          {privateFiles.map((file) => (
            <li key={file}>{file}</li>
          ))}
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
          {categories.map((category) => (
            <li key={category}>{category}</li>
          ))}
        </ul>
      </section>
    </aside>
  )
}

function App() {
  const [activeSection] = useState('dashboard')
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)

  return (
    <div className="lms-page">
      <div className="lms-shell">
        <div className={`side-layer left ${leftOpen ? 'open' : ''}`}>
          <Sidebar activeSection={activeSection} />
        </div>

        <section className="center-area">
          <Topbar
            onToggleLeft={() => setLeftOpen((prev) => !prev)}
            onToggleRight={() => setRightOpen((prev) => !prev)}
          />

          <main className="center-content">
            <CoursesSection />
            <TimelineSection />
          </main>
        </section>

        <div className={`side-layer right ${rightOpen ? 'open' : ''}`}>
          <RightPanel />
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
