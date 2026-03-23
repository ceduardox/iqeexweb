import { useMemo, useState } from 'react'
import './App.css'

const initialRegister = {
  fullName: '',
  email: '',
  role: 'student',
  password: '',
}

const initialLogin = {
  email: '',
  password: '',
}

function App() {
  const [mode, setMode] = useState('login')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' })
  const [registerForm, setRegisterForm] = useState(initialRegister)
  const [loginForm, setLoginForm] = useState(initialLogin)
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('iqx_auth_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const roleLabel = useMemo(() => {
    if (!user) return ''
    const labels = {
      student: 'Alumno',
      teacher: 'Profesor',
      admin: 'Administrador',
    }
    return labels[user.role] || user.role
  }, [user])

  function setStatus(text, type = '') {
    setMessage({ text, type })
  }

  async function requestJson(url, payload) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.message || 'Error de conexion')
    }

    return data
  }

  async function handleRegister(event) {
    event.preventDefault()
    setLoading(true)
    setStatus('Creando cuenta...')

    try {
      await requestJson('/api/auth/register', registerForm)
      setRegisterForm(initialRegister)
      setMode('login')
      setStatus('Cuenta creada. Ahora inicia sesion.', 'ok')
    } catch (error) {
      setStatus(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin(event) {
    event.preventDefault()
    setLoading(true)
    setStatus('Validando acceso...')

    try {
      const result = await requestJson('/api/auth/login', loginForm)
      setUser(result.user)
      localStorage.setItem('iqx_auth_user', JSON.stringify(result.user))
      setStatus('Acceso concedido', 'ok')
      setLoginForm(initialLogin)
    } catch (error) {
      setStatus(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem('iqx_auth_user')
    setUser(null)
    setStatus('Sesion cerrada')
  }

  if (user) {
    return (
      <main className="layout dashboard">
        <section className="dash-card">
          <p className="dash-kicker">Panel IQeX LMS</p>
          <h1>Bienvenido, {user.fullName}</h1>
          <p className="dash-role">Rol: {roleLabel}</p>
          <div className="dash-grid">
            <article>
              <h3>Cursos</h3>
              <p>Crear y organizar modulos.</p>
            </article>
            <article>
              <h3>Evaluaciones</h3>
              <p>Quizzes, notas y reportes.</p>
            </article>
            <article>
              <h3>Usuarios</h3>
              <p>Gestion de alumnos y profesores.</p>
            </article>
          </div>
          <button className="btn ghost" onClick={handleLogout} type="button">Cerrar sesion</button>
        </section>
      </main>
    )
  }

  return (
    <main className="layout">
      <section className="hero">
        <p className="hero-kicker">Node + Vite + PostgreSQL</p>
        <h1>Acceso LMS moderno</h1>
        <p>
          Base inicial tipo Moodle con roles de <strong>alumno</strong>,
          <strong> profesor</strong> y <strong>administrador</strong>.
        </p>
      </section>

      <section className="card">
        <div className="tabs">
          <button
            className={mode === 'login' ? 'tab active' : 'tab'}
            onClick={() => setMode('login')}
            type="button"
          >
            Iniciar sesion
          </button>
          <button
            className={mode === 'register' ? 'tab active' : 'tab'}
            onClick={() => setMode('register')}
            type="button"
          >
            Registrarme
          </button>
        </div>

        <p className={`message ${message.type}`.trim()}>{message.text}</p>

        {mode === 'login' ? (
          <form className="form" onSubmit={handleLogin}>
            <label>
              Correo
              <input
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))}
                required
              />
            </label>
            <label>
              Contrasena
              <input
                type="password"
                minLength={8}
                value={loginForm.password}
                onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                required
              />
            </label>
            <button className="btn" type="submit" disabled={loading}>Entrar</button>
          </form>
        ) : (
          <form className="form" onSubmit={handleRegister}>
            <label>
              Nombre completo
              <input
                type="text"
                minLength={3}
                value={registerForm.fullName}
                onChange={(e) => setRegisterForm((prev) => ({ ...prev, fullName: e.target.value }))}
                required
              />
            </label>
            <label>
              Correo
              <input
                type="email"
                value={registerForm.email}
                onChange={(e) => setRegisterForm((prev) => ({ ...prev, email: e.target.value }))}
                required
              />
            </label>
            <label>
              Rol
              <select
                value={registerForm.role}
                onChange={(e) => setRegisterForm((prev) => ({ ...prev, role: e.target.value }))}
              >
                <option value="student">Alumno</option>
                <option value="teacher">Profesor</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
            <label>
              Contrasena
              <input
                type="password"
                minLength={8}
                value={registerForm.password}
                onChange={(e) => setRegisterForm((prev) => ({ ...prev, password: e.target.value }))}
                required
              />
            </label>
            <button className="btn" type="submit" disabled={loading}>Crear cuenta</button>
          </form>
        )}
      </section>
    </main>
  )
}

export default App
