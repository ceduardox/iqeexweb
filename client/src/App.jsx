/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react'
import {
  App as AntApp,
  Avatar,
  Button,
  Card,
  Col,
  ConfigProvider,
  Empty,
  Input,
  InputNumber,
  Layout,
  List,
  Menu,
  Result,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
  message,
  theme as antdTheme,
} from 'antd'
import {
  AppstoreOutlined,
  BookOutlined,
  CalendarOutlined,
  DashboardOutlined,
  DeleteOutlined,
  EditOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  ReloadOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import './App.css'

const { Header, Sider, Content } = Layout
const { Title, Text } = Typography

const NAV_ITEMS = [
  { key: 'dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: 'content-bank', icon: <AppstoreOutlined />, label: 'Gestion LMS' },
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
  } catch {
    return null
  }
}

function initialsFromName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return 'IQ'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
}

function roleLabel(role) {
  const normalized = String(role || '').toLowerCase()
  if (normalized === 'admin') return 'Administrador'
  if (normalized === 'teacher') return 'Profesor'
  return 'Estudiante'
}

function activityTime(value) {
  if (!value) return '--:--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'
  return date.toISOString().slice(11, 16)
}

function formatDateTime(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleString()
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

function DashboardWorkspace() {
  const [messageApi, messageContextHolder] = message.useMessage()

  const [activeSection, setActiveSection] = useState('dashboard')
  const [managerTab, setManagerTab] = useState('courses')
  const [collapsed, setCollapsed] = useState(false)
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
  const [busyAction, setBusyAction] = useState('')
  const [refreshingOverview, setRefreshingOverview] = useState(false)
  const [status, setStatus] = useState(token ? 'loading' : 'unauthorized')

  const selectedCourse = useMemo(() => {
    if (!selectedCourseId) return null
    return courses.find((course) => Number(course.id) === Number(selectedCourseId)) || null
  }, [courses, selectedCourseId])

  const filteredCourses = useMemo(() => {
    const needle = String(courseQuery || '').trim().toLowerCase()
    if (!needle) return courses
    return courses.filter((course) => {
      const title = String(course.title || '').toLowerCase()
      const code = String(course.code || '').toLowerCase()
      return title.includes(needle) || code.includes(needle)
    })
  }, [courses, courseQuery])

  const recentCourses = useMemo(() => {
    if (courses.length === 0) {
      return dashboardData?.recentCourses || []
    }

    return courses.slice(0, 6).map((course) => ({
      id: course.id,
      title: course.title,
      level: course.level,
      tone: course.theme,
      category: course.category,
      progress: typeof course.progressPercent === 'number' ? course.progressPercent : null,
    }))
  }, [courses, dashboardData])

  const totalMembers = useMemo(() => {
    return courses.reduce((sum, row) => sum + (Number(row.memberCount) || 0), 0)
  }, [courses])

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
      apiRequest(`/api/activities?courseId=${courseId}&limit=80`, authToken, { method: 'GET' }),
    ])

    setCourseMembers(members.members || [])
    setCourseActivities((activities.activities || []).map(mapActivityRow))
  }

  async function refreshWorkspace(authToken, role, courseId) {
    setRefreshingOverview(true)
    try {
      await Promise.all([refreshOverview(authToken), refreshCourses(authToken, role), refreshTimeline(authToken)])
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
        setCourseMembers([])
        setCourseActivities([])
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
      } catch {
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
        messageApi.error(error.message || 'No se pudo cargar el detalle del curso')
      }
    }

    loadSelectedCourseData()
    return () => {
      cancelled = true
    }
  }, [status, token, selectedCourseId, messageApi])

  async function handleLogout() {
    try {
      if (token) {
        await apiRequest('/api/auth/logout', token, { method: 'POST', body: JSON.stringify({}) })
      }
    } catch (error) {
      void error
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

  function onCourseFieldChange(field, value) {
    setCourseForm((prev) => ({ ...prev, [field]: value }))
  }

  function onMemberFieldChange(field, value) {
    setMemberForm((prev) => ({ ...prev, [field]: field === 'progressPercent' ? Number(value || 0) : value }))
  }

  function onActivityFieldChange(field, value) {
    setActivityForm((prev) => ({ ...prev, [field]: value }))
  }

  async function onCreateCourse() {
    if (!token || !user) return

    setBusyAction('create-course')
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
      messageApi.success(`Curso creado: ${result.course?.title || 'ok'}`)
    } catch (error) {
      messageApi.error(error.message || 'No se pudo crear el curso')
    } finally {
      setBusyAction('')
    }
  }

  async function onUpdateCourse() {
    if (!token || !selectedCourse || !user) return

    setBusyAction('update-course')
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
      messageApi.success('Curso actualizado')
    } catch (error) {
      messageApi.error(error.message || 'No se pudo actualizar el curso')
    } finally {
      setBusyAction('')
    }
  }

  async function onArchiveCourse() {
    if (!token || !selectedCourse || !user) return
    if (!window.confirm(`Archivar curso "${selectedCourse.title}"?`)) return

    setBusyAction('archive-course')
    try {
      await apiRequest(`/api/courses/${selectedCourse.id}`, token, { method: 'DELETE' })
      await refreshWorkspace(token, user.role, null)
      messageApi.success('Curso archivado')
    } catch (error) {
      messageApi.error(error.message || 'No se pudo archivar el curso')
    } finally {
      setBusyAction('')
    }
  }

  async function onAddMember() {
    if (!token || !selectedCourse || !user) return

    setBusyAction('member-add')
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
      messageApi.success('Miembro guardado')
    } catch (error) {
      messageApi.error(error.message || 'No se pudo guardar el miembro')
    } finally {
      setBusyAction('')
    }
  }

  async function onRemoveMember(memberUserId) {
    if (!token || !selectedCourse || !user) return
    if (!window.confirm('Quitar este miembro del curso?')) return

    const actionId = `member-remove-${memberUserId}`
    setBusyAction(actionId)
    try {
      await apiRequest(`/api/courses/${selectedCourse.id}/members/${memberUserId}`, token, {
        method: 'DELETE',
      })

      await refreshWorkspace(token, user.role, selectedCourse.id)
      messageApi.success('Miembro removido')
    } catch (error) {
      messageApi.error(error.message || 'No se pudo quitar el miembro')
    } finally {
      setBusyAction('')
    }
  }

  async function onCreateActivity() {
    if (!token || !selectedCourse || !user) return

    setBusyAction('activity-add')
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
      messageApi.success('Actividad creada')
    } catch (error) {
      messageApi.error(error.message || 'No se pudo crear la actividad')
    } finally {
      setBusyAction('')
    }
  }

  async function onRenameActivity(activityId, currentTitle) {
    if (!token || !selectedCourse || !user) return

    const nextTitle = window.prompt('Nuevo titulo de actividad', currentTitle)
    if (nextTitle === null) return

    const normalized = nextTitle.trim()
    if (normalized.length < 3) {
      messageApi.error('El titulo debe tener al menos 3 caracteres')
      return
    }

    const actionId = `activity-edit-${activityId}`
    setBusyAction(actionId)
    try {
      await apiRequest(`/api/activities/${activityId}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ title: normalized }),
      })

      await refreshWorkspace(token, user.role, selectedCourse.id)
      messageApi.success('Actividad actualizada')
    } catch (error) {
      messageApi.error(error.message || 'No se pudo actualizar la actividad')
    } finally {
      setBusyAction('')
    }
  }

  async function onDeleteActivity(activityId) {
    if (!token || !selectedCourse || !user) return
    if (!window.confirm('Eliminar este evento de actividad?')) return

    const actionId = `activity-delete-${activityId}`
    setBusyAction(actionId)
    try {
      await apiRequest(`/api/activities/${activityId}`, token, { method: 'DELETE' })
      await refreshWorkspace(token, user.role, selectedCourse.id)
      messageApi.success('Actividad eliminada')
    } catch (error) {
      messageApi.error(error.message || 'No se pudo eliminar la actividad')
    } finally {
      setBusyAction('')
    }
  }

  async function onRefreshOverview() {
    if (!token || !user) return
    try {
      await refreshWorkspace(token, user.role, selectedCourseId)
      messageApi.success('Datos actualizados')
    } catch (error) {
      messageApi.error(error.message || 'No se pudo actualizar la informacion')
    }
  }

  const memberColumns = [
    {
      title: 'Usuario',
      dataIndex: 'fullName',
      key: 'fullName',
      render: (value, row) => (
        <Space direction="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary">{row.email}</Text>
        </Space>
      ),
    },
    {
      title: 'Rol',
      dataIndex: 'role',
      key: 'role',
      width: 140,
      render: (role) => <Tag color="blue">{role}</Tag>,
    },
    {
      title: 'Progreso',
      dataIndex: 'progressPercent',
      key: 'progressPercent',
      width: 120,
      render: (value) => `${value}%`,
    },
    {
      title: 'Accion',
      key: 'action',
      width: 120,
      render: (_, row) => (
        <Button
          size="small"
          danger
          icon={<DeleteOutlined />}
          disabled={!selectedCourse?.canManage || Number(row.id) === Number(user?.id) || busyAction === `member-remove-${row.id}`}
          onClick={() => onRemoveMember(row.id)}
        >
          Quitar
        </Button>
      ),
    },
  ]

  const activityColumns = [
    {
      title: 'Titulo',
      dataIndex: 'title',
      key: 'title',
      render: (value, row) => (
        <Space direction="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary">{row.description || 'Sin descripcion'}</Text>
        </Space>
      ),
    },
    {
      title: 'Tipo',
      dataIndex: 'eventType',
      key: 'eventType',
      width: 120,
      render: (value) => <Tag color="purple">{value}</Tag>,
    },
    {
      title: 'Fecha',
      dataIndex: 'happenedAt',
      key: 'happenedAt',
      width: 220,
      render: (value, row) => formatDateTime(value || row.time),
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 190,
      render: (_, row) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            disabled={!selectedCourse?.canManage || busyAction === `activity-edit-${row.id}`}
            onClick={() => onRenameActivity(row.id, row.title)}
          >
            Editar
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            disabled={!selectedCourse?.canManage || busyAction === `activity-delete-${row.id}`}
            onClick={() => onDeleteActivity(row.id)}
          >
            Eliminar
          </Button>
        </Space>
      ),
    },
  ]

  if (status === 'unauthorized') {
    return (
      <div className="status-shell">
        <Result
          status="warning"
          title="Sesion requerida"
          subTitle="Debes iniciar sesion para usar el panel LMS."
          extra={
            <Button type="primary" href="/acceso.html">
              Ir a acceso
            </Button>
          }
        />
      </div>
    )
  }

  if (status === 'loading' || !user) {
    return (
      <div className="status-shell">
        <Space direction="vertical" align="center">
          <Spin size="large" />
          <Text type="secondary">Cargando panel LMS...</Text>
        </Space>
      </div>
    )
  }

  const canCreateCourse = user.role === 'admin' || user.role === 'teacher'
  const canManageSelectedCourse = Boolean(selectedCourse && selectedCourse.canManage)

  return (
    <div className="app-shell">
      {messageContextHolder}
      <Layout className="lms-layout">
        <Sider
          width={320}
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          breakpoint="lg"
          className="lms-sider"
          collapsedWidth={80}
        >
          <div className="sider-brand">
            <div className="brand-logo">IQ</div>
            {!collapsed ? (
              <Space direction="vertical" size={0}>
                <Text className="brand-title">IQ LMS</Text>
                <Text className="brand-subtitle">Plataforma Operativa</Text>
              </Space>
            ) : null}
          </div>

          {!collapsed ? (
            <div className="sider-search">
              <Input
                allowClear
                value={courseQuery}
                placeholder="Buscar curso por titulo o codigo"
                onChange={(event) => setCourseQuery(event.target.value)}
                prefix={<BookOutlined />}
              />
            </div>
          ) : null}

          <div className="sider-section">
            {!collapsed ? <Text className="sider-label">Cursos ({courses.length})</Text> : null}
            <List
              className="course-list"
              dataSource={filteredCourses}
              locale={{ emptyText: collapsed ? '-' : 'No hay cursos' }}
              renderItem={(course) => {
                const selected = Number(course.id) === Number(selectedCourseId)
                return (
                  <List.Item
                    className={`course-item ${selected ? 'active' : ''}`}
                    onClick={() => setSelectedCourseId(course.id)}
                  >
                    {collapsed ? (
                      <Avatar size="small">{String(course.title || 'C').slice(0, 1).toUpperCase()}</Avatar>
                    ) : (
                      <div className="course-item-content">
                        <Space direction="vertical" size={0}>
                          <Text className="course-title">{course.title}</Text>
                          <Text className="course-subtitle">
                            {course.code} - {course.category}
                          </Text>
                        </Space>
                        {course.isPublished === false ? <Tag color="orange">Archivado</Tag> : <Tag color="green">Activo</Tag>}
                      </div>
                    )}
                  </List.Item>
                )
              }}
            />
          </div>

          <Menu
            mode="inline"
            theme="dark"
            selectedKeys={[activeSection]}
            items={NAV_ITEMS}
            onClick={({ key }) => setActiveSection(key)}
          />
        </Sider>

        <Layout>
          <Header className="lms-header">
            <Space>
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed((prev) => !prev)}
              />
              <Space direction="vertical" size={0}>
                <Text strong>{selectedCourse?.title || 'Panel general'}</Text>
                <Text type="secondary">{courses.length} cursos cargados</Text>
              </Space>
            </Space>

            <Space>
              <Button icon={<ReloadOutlined />} loading={refreshingOverview} onClick={onRefreshOverview}>
                Actualizar
              </Button>
              <Avatar className="user-avatar">{initialsFromName(user.fullName)}</Avatar>
              <Space direction="vertical" size={0}>
                <Text strong>{user.fullName}</Text>
                <Text type="secondary">{roleLabel(user.role)}</Text>
              </Space>
              <Button danger icon={<LogoutOutlined />} onClick={handleLogout}>
                Cerrar sesion
              </Button>
            </Space>
          </Header>

          <Content className="lms-content">
            {activeSection === 'dashboard' ? (
              <Space direction="vertical" size={16} style={{ display: 'flex' }}>
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={12} lg={6}>
                    <Card>
                      <Statistic title="Cursos" value={courses.length} prefix={<BookOutlined />} />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card>
                      <Statistic title="Usuarios en cursos" value={totalMembers} prefix={<TeamOutlined />} />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card>
                      <Statistic title="Eventos actividad" value={timelineItems.length} prefix={<CalendarOutlined />} />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card>
                      <Statistic title="Rol actual" value={roleLabel(user.role)} />
                    </Card>
                  </Col>
                </Row>

                <Card
                  title="Cursos recientes"
                  extra={
                    <Button type="link" onClick={() => setActiveSection('content-bank')}>
                      Ir a gestion
                    </Button>
                  }
                >
                  {recentCourses.length > 0 ? (
                    <Row gutter={[16, 16]}>
                      {recentCourses.map((course) => (
                        <Col xs={24} md={12} xl={8} key={course.id}>
                          <Card
                            className="mini-course-card"
                            hoverable
                            onClick={() => {
                              setSelectedCourseId(course.id)
                              setActiveSection('content-bank')
                            }}
                          >
                            <Space direction="vertical" size={6}>
                              <Text strong>{course.title}</Text>
                              <Text type="secondary">
                                {course.level} - {course.category}
                              </Text>
                              {typeof course.progress === 'number' ? <Tag color="blue">Progreso {course.progress}%</Tag> : null}
                            </Space>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  ) : (
                    <Empty description="No hay cursos para mostrar" />
                  )}
                </Card>

                <Card title="Actividad reciente">
                  <Table
                    rowKey="id"
                    pagination={{ pageSize: 8, hideOnSinglePage: true }}
                    dataSource={timelineItems}
                    columns={[
                      { title: 'Hora', dataIndex: 'time', key: 'time', width: 110 },
                      { title: 'Actividad', dataIndex: 'title', key: 'title' },
                      { title: 'Curso', dataIndex: 'course', key: 'course' },
                      {
                        title: 'Tipo',
                        dataIndex: 'eventType',
                        key: 'eventType',
                        width: 120,
                        render: (value) => <Tag>{value}</Tag>,
                      },
                    ]}
                  />
                </Card>
              </Space>
            ) : null}

            {activeSection === 'content-bank' ? (
              <Space direction="vertical" size={16} style={{ display: 'flex' }}>
                <Card>
                  <Space className="management-header" wrap>
                    <Title level={4} style={{ margin: 0 }}>
                      Gestion de plataforma
                    </Title>
                    <Tag color="blue">{selectedCourse ? `Curso activo: ${selectedCourse.title}` : 'Selecciona un curso'}</Tag>
                  </Space>
                  <Segmented
                    block
                    value={managerTab}
                    onChange={setManagerTab}
                    options={[
                      { label: 'Cursos', value: 'courses' },
                      { label: 'Miembros', value: 'members' },
                      { label: 'Actividades', value: 'activities' },
                    ]}
                  />
                </Card>

                {managerTab === 'courses' ? (
                  <Row gutter={[16, 16]}>
                    <Col xs={24} xl={14}>
                      <Card title="Listado de cursos">
                        <Table
                          rowKey="id"
                          dataSource={courses}
                          pagination={{ pageSize: 8, hideOnSinglePage: true }}
                          onRow={(record) => ({
                            onClick: () => setSelectedCourseId(record.id),
                          })}
                          rowClassName={(record) => (Number(record.id) === Number(selectedCourseId) ? 'selected-row' : '')}
                          columns={[
                            {
                              title: 'Curso',
                              dataIndex: 'title',
                              key: 'title',
                              render: (value, row) => (
                                <Space direction="vertical" size={0}>
                                  <Text strong>{value}</Text>
                                  <Text type="secondary">{row.code}</Text>
                                </Space>
                              ),
                            },
                            { title: 'Categoria', dataIndex: 'category', key: 'category', width: 140 },
                            { title: 'Nivel', dataIndex: 'level', key: 'level', width: 140 },
                            {
                              title: 'Miembros',
                              dataIndex: 'memberCount',
                              key: 'memberCount',
                              width: 120,
                              render: (value) => value || 0,
                            },
                            {
                              title: 'Estado',
                              dataIndex: 'isPublished',
                              key: 'isPublished',
                              width: 120,
                              render: (value) => (value ? <Tag color="green">Publicado</Tag> : <Tag color="orange">Archivado</Tag>),
                            },
                          ]}
                        />
                      </Card>
                    </Col>

                    <Col xs={24} xl={10}>
                      <Card title="Configuracion de curso">
                        <Space direction="vertical" size={12} style={{ display: 'flex' }}>
                          <Input
                            addonBefore="Codigo"
                            placeholder="BIO-101"
                            value={courseForm.code}
                            onChange={(event) => onCourseFieldChange('code', event.target.value)}
                          />
                          <Input
                            addonBefore="Titulo"
                            placeholder="Nombre del curso"
                            value={courseForm.title}
                            onChange={(event) => onCourseFieldChange('title', event.target.value)}
                          />
                          <Input
                            addonBefore="Categoria"
                            value={courseForm.category}
                            onChange={(event) => onCourseFieldChange('category', event.target.value)}
                          />
                          <Input
                            addonBefore="Nivel"
                            value={courseForm.level}
                            onChange={(event) => onCourseFieldChange('level', event.target.value)}
                          />
                          <Select
                            value={courseForm.theme}
                            options={[
                              { label: 'Vivid', value: 'vivid' },
                              { label: 'Earth', value: 'earth' },
                            ]}
                            onChange={(value) => onCourseFieldChange('theme', value)}
                          />
                          <Space>
                            <Text>Publicado</Text>
                            <Switch checked={Boolean(courseForm.isPublished)} onChange={(checked) => onCourseFieldChange('isPublished', checked)} />
                          </Space>

                          <Space wrap>
                            <Button
                              type="primary"
                              icon={<PlusOutlined />}
                              loading={busyAction === 'create-course'}
                              disabled={!canCreateCourse}
                              onClick={onCreateCourse}
                            >
                              Crear
                            </Button>
                            <Button
                              icon={<EditOutlined />}
                              loading={busyAction === 'update-course'}
                              disabled={!canManageSelectedCourse}
                              onClick={onUpdateCourse}
                            >
                              Actualizar
                            </Button>
                            <Button
                              danger
                              icon={<DeleteOutlined />}
                              loading={busyAction === 'archive-course'}
                              disabled={!canManageSelectedCourse}
                              onClick={onArchiveCourse}
                            >
                              Archivar
                            </Button>
                          </Space>
                        </Space>
                      </Card>
                    </Col>
                  </Row>
                ) : null}

                {managerTab === 'members' ? (
                  selectedCourse ? (
                    <Row gutter={[16, 16]}>
                      <Col xs={24} xl={15}>
                        <Card title="Miembros del curso">
                          <Table
                            rowKey="id"
                            dataSource={courseMembers}
                            pagination={{ pageSize: 8, hideOnSinglePage: true }}
                            columns={memberColumns}
                          />
                        </Card>
                      </Col>
                      <Col xs={24} xl={9}>
                        <Card title="Agregar o actualizar miembro">
                          <Space direction="vertical" size={12} style={{ display: 'flex' }}>
                            <Input
                              placeholder="email@dominio.com"
                              value={memberForm.email}
                              onChange={(event) => onMemberFieldChange('email', event.target.value)}
                            />
                            <Select
                              value={memberForm.role}
                              onChange={(value) => onMemberFieldChange('role', value)}
                              options={[
                                { label: 'Estudiante', value: 'student' },
                                { label: 'Profesor', value: 'teacher' },
                                { label: 'Asistente', value: 'assistant' },
                              ]}
                            />
                            <InputNumber
                              style={{ width: '100%' }}
                              min={0}
                              max={100}
                              value={memberForm.progressPercent}
                              onChange={(value) => onMemberFieldChange('progressPercent', value ?? 0)}
                              addonAfter="%"
                            />
                            <Button
                              type="primary"
                              icon={<PlusOutlined />}
                              loading={busyAction === 'member-add'}
                              disabled={!canManageSelectedCourse}
                              onClick={onAddMember}
                            >
                              Guardar miembro
                            </Button>
                          </Space>
                        </Card>
                      </Col>
                    </Row>
                  ) : (
                    <Card>
                      <Empty description="Selecciona un curso para gestionar miembros" />
                    </Card>
                  )
                ) : null}

                {managerTab === 'activities' ? (
                  selectedCourse ? (
                    <Row gutter={[16, 16]}>
                      <Col xs={24} xl={15}>
                        <Card title="Actividades del curso">
                          <Table
                            rowKey="id"
                            dataSource={courseActivities}
                            pagination={{ pageSize: 8, hideOnSinglePage: true }}
                            columns={activityColumns}
                          />
                        </Card>
                      </Col>
                      <Col xs={24} xl={9}>
                        <Card title="Nueva actividad">
                          <Space direction="vertical" size={12} style={{ display: 'flex' }}>
                            <Input
                              placeholder="Titulo actividad"
                              value={activityForm.title}
                              onChange={(event) => onActivityFieldChange('title', event.target.value)}
                            />
                            <Select
                              value={activityForm.eventType}
                              onChange={(value) => onActivityFieldChange('eventType', value)}
                              options={[
                                { label: 'Tarea', value: 'task' },
                                { label: 'Cuestionario', value: 'quiz' },
                                { label: 'Discusion', value: 'discussion' },
                                { label: 'Archivo', value: 'file' },
                              ]}
                            />
                            <Input.TextArea
                              rows={4}
                              placeholder="Descripcion"
                              value={activityForm.description}
                              onChange={(event) => onActivityFieldChange('description', event.target.value)}
                            />
                            <Button
                              type="primary"
                              icon={<PlusOutlined />}
                              loading={busyAction === 'activity-add'}
                              disabled={!canManageSelectedCourse}
                              onClick={onCreateActivity}
                            >
                              Crear actividad
                            </Button>
                          </Space>
                        </Card>
                      </Col>
                    </Row>
                  ) : (
                    <Card>
                      <Empty description="Selecciona un curso para gestionar actividades" />
                    </Card>
                  )
                ) : null}
              </Space>
            ) : null}
          </Content>
        </Layout>
      </Layout>
    </div>
  )
}

function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#4f62ff',
          borderRadius: 12,
          fontFamily: "'Poppins', 'Nunito Sans', 'Segoe UI', sans-serif",
        },
      }}
    >
      <AntApp>
        <DashboardWorkspace />
      </AntApp>
    </ConfigProvider>
  )
}

export default App
