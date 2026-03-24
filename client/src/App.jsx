/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react'
import {
  App as AntApp,
  Avatar,
  Button,
  Card,
  Checkbox,
  Col,
  ConfigProvider,
  Empty,
  Input,
  InputNumber,
  Layout,
  List,
  Menu,
  Progress,
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
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
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

const EMPTY_ADMIN_USER_FORM = {
  fullName: '',
  email: '',
  password: '',
  primaryRole: 'student',
  roles: ['student'],
  active: true,
}

const EMPTY_EDIT_USER_FORM = {
  fullName: '',
  primaryRole: 'student',
  roles: ['student'],
  active: true,
}

const EMPTY_MODULE_FORM = {
  title: '',
  description: '',
  sortOrder: 1,
  isPublished: true,
}

const EMPTY_LESSON_FORM = {
  title: '',
  description: '',
  contentType: 'text',
  contentText: '',
  videoUrl: '',
  resourceUrl: '',
  durationMinutes: 10,
  sortOrder: 1,
  isFreePreview: false,
  isPublished: true,
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

function formatMinutes(value) {
  const minutes = Number(value || 0)
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '0 min'
  }

  const wholeMinutes = Math.round(minutes)
  const hours = Math.floor(wholeMinutes / 60)
  const rest = wholeMinutes % 60

  if (hours === 0) {
    return `${rest} min`
  }

  if (rest === 0) {
    return `${hours} h`
  }

  return `${hours} h ${rest} min`
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
  const [moduleForm, setModuleForm] = useState(EMPTY_MODULE_FORM)
  const [lessonForm, setLessonForm] = useState(EMPTY_LESSON_FORM)
  const [courseModules, setCourseModules] = useState([])
  const [selectedModuleId, setSelectedModuleId] = useState(null)
  const [myCourseProgress, setMyCourseProgress] = useState(null)
  const [lessonProgressMap, setLessonProgressMap] = useState({})
  const [courseProgressRows, setCourseProgressRows] = useState([])
  const [progressLoading, setProgressLoading] = useState(false)
  const [adminUserForm, setAdminUserForm] = useState(EMPTY_ADMIN_USER_FORM)
  const [editUserForm, setEditUserForm] = useState(EMPTY_EDIT_USER_FORM)
  const [systemUsers, setSystemUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('all')
  const [userActiveFilter, setUserActiveFilter] = useState('all')
  const [rolesCatalog, setRolesCatalog] = useState([])
  const [permissionsCatalog, setPermissionsCatalog] = useState([])
  const [rolePermissionsMap, setRolePermissionsMap] = useState({})
  const [selectedRoleCode, setSelectedRoleCode] = useState('admin')
  const [rolePermissionDraft, setRolePermissionDraft] = useState([])
  const [adminLoading, setAdminLoading] = useState(false)
  const [permissionsLoading, setPermissionsLoading] = useState(false)
  const [busyAction, setBusyAction] = useState('')
  const [refreshingOverview, setRefreshingOverview] = useState(false)
  const [status, setStatus] = useState(token ? 'loading' : 'unauthorized')

  const selectedCourse = useMemo(() => {
    if (!selectedCourseId) return null
    return courses.find((course) => Number(course.id) === Number(selectedCourseId)) || null
  }, [courses, selectedCourseId])

  const selectedUser = useMemo(() => {
    if (!selectedUserId) return null
    return systemUsers.find((row) => Number(row.id) === Number(selectedUserId)) || null
  }, [systemUsers, selectedUserId])

  const selectedModule = useMemo(() => {
    if (!selectedModuleId) return null
    return courseModules.find((module) => Number(module.id) === Number(selectedModuleId)) || null
  }, [courseModules, selectedModuleId])

  const hasPermission = (permissionCode) => {
    if (!user) return false
    if (String(user.role || '').toLowerCase() === 'admin') return true
    const list = Array.isArray(user.permissions) ? user.permissions : []
    return list.includes(permissionCode)
  }

  const canReadUsers = hasPermission('users.read')
  const canCreateUsers = hasPermission('users.create')
  const canUpdateUsers = hasPermission('users.update')
  const canDisableUsers = hasPermission('users.disable')
  const canReadRoles = hasPermission('roles.read')
  const canManageRoles = hasPermission('roles.manage')
  const canReadReports = hasPermission('reports.read')
  const canManageSelectedCourse = Boolean(selectedCourse && selectedCourse.canManage)

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

  useEffect(() => {
    if (courseModules.length === 0) {
      setSelectedModuleId(null)
      setModuleForm(EMPTY_MODULE_FORM)
      return
    }

    const exists = courseModules.some((module) => Number(module.id) === Number(selectedModuleId))
    if (!exists) {
      setSelectedModuleId(courseModules[0].id)
      return
    }

    if (selectedModule) {
      setModuleForm({
        title: selectedModule.title || '',
        description: selectedModule.description || '',
        sortOrder: Number(selectedModule.sortOrder) || 1,
        isPublished: selectedModule.isPublished !== false,
      })
    }
  }, [courseModules, selectedModuleId, selectedModule])

  useEffect(() => {
    if (!selectedUser) {
      setEditUserForm(EMPTY_EDIT_USER_FORM)
      return
    }

    const roles = Array.isArray(selectedUser.roles) && selectedUser.roles.length > 0 ? selectedUser.roles : [selectedUser.primaryRole || selectedUser.role || 'student']
    const primaryRole = selectedUser.primaryRole || selectedUser.role || roles[0]
    const normalizedRoles = roles.includes(primaryRole) ? roles : [primaryRole, ...roles]

    setEditUserForm({
      fullName: selectedUser.fullName || '',
      primaryRole,
      roles: normalizedRoles,
      active: Boolean(selectedUser.active),
    })
  }, [selectedUser])

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

  async function refreshCourseModules(authToken, courseId) {
    if (!courseId) {
      setCourseModules([])
      setSelectedModuleId(null)
      setMyCourseProgress(null)
      setLessonProgressMap({})
      setCourseProgressRows([])
      return
    }

    const response = await apiRequest(`/api/courses/${courseId}/modules?includeLessons=true`, authToken, { method: 'GET' })
    const modules = response.modules || []
    setCourseModules(modules)

    if (modules.length === 0) {
      setSelectedModuleId(null)
      return
    }

    if (!modules.some((module) => Number(module.id) === Number(selectedModuleId))) {
      setSelectedModuleId(modules[0].id)
    }
  }

  async function loadMyCourseProgress(authToken, courseId) {
    if (!courseId) {
      setMyCourseProgress(null)
      setLessonProgressMap({})
      return
    }

    setProgressLoading(true)
    try {
      const response = await apiRequest(`/api/courses/${courseId}/progress/me`, authToken, { method: 'GET' })
      const progress = response.progress || null
      const lessons = Array.isArray(response.lessons) ? response.lessons : []
      const map = {}
      for (const lesson of lessons) {
        map[lesson.lessonId] = lesson
      }
      setMyCourseProgress(progress)
      setLessonProgressMap(map)
    } finally {
      setProgressLoading(false)
    }
  }

  async function loadCourseProgressOverview(authToken, courseId) {
    if (!courseId || !canReadReports || !canManageSelectedCourse) {
      setCourseProgressRows([])
      return
    }

    const response = await apiRequest(`/api/courses/${courseId}/progress/overview`, authToken, { method: 'GET' })
    setCourseProgressRows(Array.isArray(response.rows) ? response.rows : [])
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

  async function loadAdminUsers(authToken, options = {}) {
    if (!canReadUsers) return
    setAdminLoading(true)
    try {
      const search = options.search ?? userSearch
      const role = options.role ?? userRoleFilter
      const active = options.active ?? userActiveFilter

      const query = new URLSearchParams()
      if (search) query.set('search', search)
      if (role && role !== 'all') query.set('role', role)
      if (active === 'active') query.set('active', 'true')
      if (active === 'inactive') query.set('active', 'false')

      const response = await apiRequest(`/api/admin/users${query.toString() ? `?${query.toString()}` : ''}`, authToken, { method: 'GET' })
      const nextUsers = response.users || []
      setSystemUsers(nextUsers)

      if (nextUsers.length === 0) {
        setSelectedUserId(null)
      } else if (!nextUsers.some((row) => Number(row.id) === Number(selectedUserId))) {
        setSelectedUserId(nextUsers[0].id)
      }
    } finally {
      setAdminLoading(false)
    }
  }

  async function loadRolePermissions(authToken) {
    if (!canReadRoles) return
    setPermissionsLoading(true)
    try {
      const response = await apiRequest('/api/admin/permissions', authToken, { method: 'GET' })
      const roles = response.roles || []
      const permissions = response.permissions || []
      const map = response.rolePermissions || {}

      setRolesCatalog(roles)
      setPermissionsCatalog(permissions)
      setRolePermissionsMap(map)

      const defaultRole = roles.some((row) => row.code === selectedRoleCode) ? selectedRoleCode : roles[0]?.code || 'admin'
      setSelectedRoleCode(defaultRole)
      setRolePermissionDraft(Array.isArray(map[defaultRole]) ? map[defaultRole] : [])
    } finally {
      setPermissionsLoading(false)
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

  useEffect(() => {
    let cancelled = false

    async function loadAdminModules() {
      if (status !== 'ready' || !token || activeSection !== 'content-bank') {
        return
      }

      try {
        if (managerTab === 'modules') {
          await refreshCourseModules(token, selectedCourseId)
          await loadMyCourseProgress(token, selectedCourseId)
          await loadCourseProgressOverview(token, selectedCourseId)
        }

        if (managerTab === 'progress') {
          await loadMyCourseProgress(token, selectedCourseId)
          await loadCourseProgressOverview(token, selectedCourseId)
        }

        if (managerTab === 'users' && canReadUsers) {
          await loadAdminUsers(token)
        }

        if (managerTab === 'roles' && canReadRoles) {
          await loadRolePermissions(token)
        }
      } catch (error) {
        if (cancelled) return
        messageApi.error(error.message || 'No se pudo cargar el modulo administrativo')
      }
    }

    loadAdminModules()
    return () => {
      cancelled = true
    }
  }, [status, token, activeSection, managerTab, canReadUsers, canReadRoles, selectedCourseId, canReadReports, canManageSelectedCourse])

  useEffect(() => {
    const current = rolePermissionsMap[selectedRoleCode]
    if (!Array.isArray(current)) return
    setRolePermissionDraft(current)
  }, [selectedRoleCode, rolePermissionsMap])

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

  function onModuleFieldChange(field, value) {
    setModuleForm((prev) => ({ ...prev, [field]: value }))
  }

  function onLessonFieldChange(field, value) {
    setLessonForm((prev) => ({ ...prev, [field]: value }))
  }

  async function onCreateModule() {
    if (!token || !selectedCourse || !canManageSelectedCourse) return
    setBusyAction('module-create')
    try {
      const result = await apiRequest(`/api/courses/${selectedCourse.id}/modules`, token, {
        method: 'POST',
        body: JSON.stringify({
          title: moduleForm.title,
          description: moduleForm.description,
          sortOrder: Number(moduleForm.sortOrder),
          isPublished: Boolean(moduleForm.isPublished),
        }),
      })

      await refreshCourseModules(token, selectedCourse.id)
      if (result.module?.id) {
        setSelectedModuleId(result.module.id)
      }
      setModuleForm(EMPTY_MODULE_FORM)
      messageApi.success('Modulo creado')
    } catch (error) {
      messageApi.error(error.message || 'No se pudo crear el modulo')
    } finally {
      setBusyAction('')
    }
  }

  async function onUpdateModule() {
    if (!token || !selectedModule || !canManageSelectedCourse) return
    setBusyAction('module-update')
    try {
      await apiRequest(`/api/modules/${selectedModule.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({
          title: moduleForm.title,
          description: moduleForm.description,
          sortOrder: Number(moduleForm.sortOrder),
          isPublished: Boolean(moduleForm.isPublished),
        }),
      })
      await refreshCourseModules(token, selectedCourse.id)
      messageApi.success('Modulo actualizado')
    } catch (error) {
      messageApi.error(error.message || 'No se pudo actualizar el modulo')
    } finally {
      setBusyAction('')
    }
  }

  async function onDeleteModule() {
    if (!token || !selectedModule || !canManageSelectedCourse) return
    if (!window.confirm(`Eliminar modulo "${selectedModule.title}"?`)) return

    setBusyAction('module-delete')
    try {
      await apiRequest(`/api/modules/${selectedModule.id}`, token, { method: 'DELETE' })
      await refreshCourseModules(token, selectedCourse.id)
      messageApi.success('Modulo eliminado')
    } catch (error) {
      messageApi.error(error.message || 'No se pudo eliminar el modulo')
    } finally {
      setBusyAction('')
    }
  }

  async function onCreateLesson() {
    if (!token || !selectedModule || !canManageSelectedCourse) return
    setBusyAction('lesson-create')
    try {
      await apiRequest(`/api/modules/${selectedModule.id}/lessons`, token, {
        method: 'POST',
        body: JSON.stringify({
          title: lessonForm.title,
          description: lessonForm.description,
          contentType: lessonForm.contentType,
          contentText: lessonForm.contentText,
          videoUrl: lessonForm.videoUrl,
          resourceUrl: lessonForm.resourceUrl,
          durationMinutes: Number(lessonForm.durationMinutes),
          sortOrder: Number(lessonForm.sortOrder),
          isFreePreview: Boolean(lessonForm.isFreePreview),
          isPublished: Boolean(lessonForm.isPublished),
        }),
      })
      await refreshCourseModules(token, selectedCourse.id)
      setLessonForm(EMPTY_LESSON_FORM)
      messageApi.success('Leccion creada')
    } catch (error) {
      messageApi.error(error.message || 'No se pudo crear la leccion')
    } finally {
      setBusyAction('')
    }
  }

  async function onRenameLesson(lesson) {
    if (!token || !selectedCourse || !lesson || !canManageSelectedCourse) return
    const nextTitle = window.prompt('Nuevo titulo de leccion', lesson.title)
    if (nextTitle === null) return
    const normalized = String(nextTitle || '').trim()
    if (normalized.length < 3) {
      messageApi.error('El titulo debe tener al menos 3 caracteres')
      return
    }

    setBusyAction(`lesson-update-${lesson.id}`)
    try {
      await apiRequest(`/api/lessons/${lesson.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ title: normalized }),
      })
      await refreshCourseModules(token, selectedCourse.id)
      messageApi.success('Leccion actualizada')
    } catch (error) {
      messageApi.error(error.message || 'No se pudo actualizar la leccion')
    } finally {
      setBusyAction('')
    }
  }

  async function onDeleteLesson(lesson) {
    if (!token || !selectedCourse || !lesson || !canManageSelectedCourse) return
    if (!window.confirm(`Eliminar leccion "${lesson.title}"?`)) return

    setBusyAction(`lesson-delete-${lesson.id}`)
    try {
      await apiRequest(`/api/lessons/${lesson.id}`, token, { method: 'DELETE' })
      await refreshCourseModules(token, selectedCourse.id)
      messageApi.success('Leccion eliminada')
    } catch (error) {
      messageApi.error(error.message || 'No se pudo eliminar la leccion')
    } finally {
      setBusyAction('')
    }
  }

  async function onToggleLessonCompletion(lesson, isCompleted) {
    if (!token || !selectedCourse || !lesson || !user) return

    const actionId = `lesson-progress-${lesson.id}`
    setBusyAction(actionId)
    try {
      await apiRequest(`/api/lessons/${lesson.id}/progress`, token, {
        method: 'POST',
        body: JSON.stringify({
          isCompleted: Boolean(isCompleted),
          timeSpentMinutes: isCompleted ? Number(lesson.durationMinutes) || 0 : 0,
        }),
      })

      await loadMyCourseProgress(token, selectedCourse.id)
      await loadCourseProgressOverview(token, selectedCourse.id)
      await refreshCourses(token, user.role)
      messageApi.success(isCompleted ? 'Leccion completada' : 'Leccion marcada como pendiente')
    } catch (error) {
      messageApi.error(error.message || 'No se pudo actualizar el progreso de la leccion')
    } finally {
      setBusyAction('')
    }
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

  function onAdminUserFormChange(field, value) {
    setAdminUserForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'primaryRole' && Array.isArray(next.roles) && !next.roles.includes(value)) {
        next.roles = [value, ...next.roles]
      }
      return next
    })
  }

  function onEditUserFormChange(field, value) {
    setEditUserForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'primaryRole' && Array.isArray(next.roles) && !next.roles.includes(value)) {
        next.roles = [value, ...next.roles]
      }
      return next
    })
  }

  async function onCreateAdminUser() {
    if (!token || !canCreateUsers) return
    setBusyAction('create-admin-user')
    try {
      const roles = Array.isArray(adminUserForm.roles) ? adminUserForm.roles : [adminUserForm.primaryRole]
      const nextRoles = roles.includes(adminUserForm.primaryRole) ? roles : [adminUserForm.primaryRole, ...roles]
      await apiRequest('/api/admin/users', token, {
        method: 'POST',
        body: JSON.stringify({
          fullName: adminUserForm.fullName,
          email: adminUserForm.email,
          password: adminUserForm.password,
          primaryRole: adminUserForm.primaryRole,
          roles: nextRoles,
          active: Boolean(adminUserForm.active),
        }),
      })

      setAdminUserForm(EMPTY_ADMIN_USER_FORM)
      await loadAdminUsers(token)
      messageApi.success('Usuario creado')
    } catch (error) {
      messageApi.error(error.message || 'No se pudo crear el usuario')
    } finally {
      setBusyAction('')
    }
  }

  async function onUpdateSelectedUser() {
    if (!token || !selectedUser || !canUpdateUsers) return
    setBusyAction('update-admin-user')
    try {
      const roles = Array.isArray(editUserForm.roles) ? editUserForm.roles : [editUserForm.primaryRole]
      const nextRoles = roles.includes(editUserForm.primaryRole) ? roles : [editUserForm.primaryRole, ...roles]
      await apiRequest(`/api/admin/users/${selectedUser.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: editUserForm.fullName,
          primaryRole: editUserForm.primaryRole,
          roles: nextRoles,
          active: Boolean(editUserForm.active),
        }),
      })

      await loadAdminUsers(token)
      messageApi.success('Usuario actualizado')
    } catch (error) {
      messageApi.error(error.message || 'No se pudo actualizar el usuario')
    } finally {
      setBusyAction('')
    }
  }

  async function onToggleUserActive(targetUser) {
    if (!token || !canDisableUsers || !targetUser) return
    setBusyAction(`toggle-user-${targetUser.id}`)
    try {
      await apiRequest(`/api/admin/users/${targetUser.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({
          active: !targetUser.active,
        }),
      })
      await loadAdminUsers(token)
      messageApi.success(targetUser.active ? 'Usuario desactivado' : 'Usuario activado')
    } catch (error) {
      messageApi.error(error.message || 'No se pudo actualizar el estado')
    } finally {
      setBusyAction('')
    }
  }

  async function onSaveRolePermissions() {
    if (!token || !selectedRoleCode || !canManageRoles) return
    setBusyAction('save-role-permissions')
    try {
      await apiRequest(`/api/admin/roles/${selectedRoleCode}/permissions`, token, {
        method: 'PATCH',
        body: JSON.stringify({
          permissions: rolePermissionDraft,
        }),
      })
      await loadRolePermissions(token)
      messageApi.success('Permisos de rol actualizados')
    } catch (error) {
      messageApi.error(error.message || 'No se pudo guardar permisos')
    } finally {
      setBusyAction('')
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

  const moduleColumns = [
    {
      title: 'Modulo',
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
      title: 'Orden',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 100,
    },
    {
      title: 'Lecciones',
      key: 'lessons',
      width: 120,
      render: (_, row) => (Array.isArray(row.lessons) ? row.lessons.length : 0),
    },
    {
      title: 'Estado',
      dataIndex: 'isPublished',
      key: 'isPublished',
      width: 120,
      render: (value) => (value ? <Tag color="green">Publicado</Tag> : <Tag color="orange">Borrador</Tag>),
    },
    {
      title: 'Accion',
      key: 'action',
      width: 140,
      render: (_, row) => (
        <Button size="small" icon={<BookOutlined />} onClick={() => setSelectedModuleId(row.id)}>
          Seleccionar
        </Button>
      ),
    },
  ]

  const lessonColumns = [
    {
      title: 'Leccion',
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
      dataIndex: 'contentType',
      key: 'contentType',
      width: 110,
      render: (value) => <Tag>{value}</Tag>,
    },
    {
      title: 'Duracion',
      dataIndex: 'durationMinutes',
      key: 'durationMinutes',
      width: 120,
      render: (value) => `${value} min`,
    },
    {
      title: 'Orden',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 90,
    },
    {
      title: 'Mi avance',
      key: 'myProgress',
      width: 270,
      render: (_, row) => {
        const progressRow = lessonProgressMap[row.id]
        const isCompleted = Boolean(progressRow?.isCompleted)
        return (
          <Space>
            <Tag color={isCompleted ? 'green' : 'default'}>{isCompleted ? 'Completada' : 'Pendiente'}</Tag>
            <Button
              size="small"
              type={isCompleted ? 'default' : 'primary'}
              loading={busyAction === `lesson-progress-${row.id}`}
              onClick={() => onToggleLessonCompletion(row, !isCompleted)}
            >
              {isCompleted ? 'Marcar pendiente' : 'Completar'}
            </Button>
          </Space>
        )
      },
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
            disabled={!canManageSelectedCourse || busyAction === `lesson-update-${row.id}`}
            onClick={() => onRenameLesson(row)}
          >
            Editar
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            disabled={!canManageSelectedCourse || busyAction === `lesson-delete-${row.id}`}
            onClick={() => onDeleteLesson(row)}
          >
            Eliminar
          </Button>
        </Space>
      ),
    },
  ]

  const progressOverviewColumns = [
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
      dataIndex: 'memberRole',
      key: 'memberRole',
      width: 130,
      render: (value) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: 'Lecciones',
      key: 'lessons',
      width: 150,
      render: (_, row) => `${row.completedLessons}/${row.totalLessons}`,
    },
    {
      title: 'Avance',
      dataIndex: 'progressPercent',
      key: 'progressPercent',
      width: 260,
      render: (value) => <Progress percent={Number(value || 0)} size="small" />,
    },
    {
      title: 'Ultima actualizacion',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 220,
      render: (value) => formatDateTime(value),
    },
  ]

  const userColumns = [
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
      title: 'Rol Primario',
      dataIndex: 'primaryRole',
      key: 'primaryRole',
      width: 140,
      render: (value) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: 'Roles',
      dataIndex: 'roles',
      key: 'roles',
      width: 220,
      render: (roles) => (
        <Space wrap>
          {(Array.isArray(roles) ? roles : []).map((roleCode) => (
            <Tag key={roleCode}>{roleCode}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'active',
      key: 'active',
      width: 120,
      render: (value) => (value ? <Tag color="green">Activo</Tag> : <Tag color="red">Inactivo</Tag>),
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 220,
      render: (_, row) => (
        <Space>
          <Button size="small" icon={<UserOutlined />} onClick={() => setSelectedUserId(row.id)}>
            Seleccionar
          </Button>
          <Button
            size="small"
            danger={Boolean(row.active)}
            disabled={!canDisableUsers || Number(row.id) === Number(user?.id) || busyAction === `toggle-user-${row.id}`}
            onClick={() => onToggleUserActive(row)}
          >
            {row.active ? 'Desactivar' : 'Activar'}
          </Button>
        </Space>
      ),
    },
  ]

  const roleOptions = rolesCatalog.map((role) => ({
    label: `${role.name} (${role.code})`,
    value: role.code,
  }))

  const permissionsCheckboxOptions = permissionsCatalog.map((permission) => ({
    label: `${permission.code} - ${permission.name}`,
    value: permission.code,
  }))

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
                      { label: 'Modulos', value: 'modules' },
                      { label: 'Progreso', value: 'progress' },
                      { label: 'Usuarios', value: 'users' },
                      { label: 'Roles y Permisos', value: 'roles' },
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

                {managerTab === 'modules' ? (
                  selectedCourse ? (
                    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
                      <Row gutter={[16, 16]}>
                        <Col xs={24} xl={14}>
                          <Card
                            title={`Modulos de ${selectedCourse.title}`}
                            extra={(
                              <Button icon={<ReloadOutlined />} onClick={() => refreshCourseModules(token, selectedCourse.id)}>
                                Recargar
                              </Button>
                            )}
                          >
                            <Table
                              rowKey="id"
                              dataSource={courseModules}
                              pagination={{ pageSize: 8, hideOnSinglePage: true }}
                              onRow={(record) => ({
                                onClick: () => setSelectedModuleId(record.id),
                              })}
                              rowClassName={(record) => (Number(record.id) === Number(selectedModuleId) ? 'selected-row' : '')}
                              columns={moduleColumns}
                            />
                          </Card>
                        </Col>
                        <Col xs={24} xl={10}>
                          <Card title="Crear/editar modulo">
                            <Space direction="vertical" size={12} style={{ display: 'flex' }}>
                              <Input
                                placeholder="Titulo del modulo"
                                value={moduleForm.title}
                                onChange={(event) => onModuleFieldChange('title', event.target.value)}
                              />
                              <Input.TextArea
                                rows={3}
                                placeholder="Descripcion"
                                value={moduleForm.description}
                                onChange={(event) => onModuleFieldChange('description', event.target.value)}
                              />
                              <InputNumber
                                style={{ width: '100%' }}
                                min={1}
                                value={moduleForm.sortOrder}
                                onChange={(value) => onModuleFieldChange('sortOrder', value ?? 1)}
                                addonBefore="Orden"
                              />
                              <Space>
                                <Text>Publicado</Text>
                                <Switch checked={Boolean(moduleForm.isPublished)} onChange={(checked) => onModuleFieldChange('isPublished', checked)} />
                              </Space>
                              <Space wrap>
                                <Button
                                  type="primary"
                                  icon={<PlusOutlined />}
                                  loading={busyAction === 'module-create'}
                                  disabled={!canManageSelectedCourse}
                                  onClick={onCreateModule}
                                >
                                  Crear modulo
                                </Button>
                                <Button
                                  icon={<EditOutlined />}
                                  loading={busyAction === 'module-update'}
                                  disabled={!canManageSelectedCourse || !selectedModule}
                                  onClick={onUpdateModule}
                                >
                                  Actualizar
                                </Button>
                                <Button
                                  danger
                                  icon={<DeleteOutlined />}
                                  loading={busyAction === 'module-delete'}
                                  disabled={!canManageSelectedCourse || !selectedModule}
                                  onClick={onDeleteModule}
                                >
                                  Eliminar
                                </Button>
                              </Space>
                            </Space>
                          </Card>
                        </Col>
                      </Row>

                      <Row gutter={[16, 16]}>
                        <Col xs={24} xl={15}>
                          <Card title={selectedModule ? `Lecciones de ${selectedModule.title}` : 'Lecciones del modulo'}>
                            {selectedModule ? (
                              <Table
                                rowKey="id"
                                dataSource={Array.isArray(selectedModule.lessons) ? selectedModule.lessons : []}
                                pagination={{ pageSize: 8, hideOnSinglePage: true }}
                                columns={lessonColumns}
                              />
                            ) : (
                              <Empty description="Selecciona un modulo para ver lecciones" />
                            )}
                          </Card>
                        </Col>
                        <Col xs={24} xl={9}>
                          <Card title="Crear leccion">
                            {selectedModule ? (
                              <Space direction="vertical" size={12} style={{ display: 'flex' }}>
                                <Input
                                  placeholder="Titulo de leccion"
                                  value={lessonForm.title}
                                  onChange={(event) => onLessonFieldChange('title', event.target.value)}
                                />
                                <Input.TextArea
                                  rows={3}
                                  placeholder="Descripcion"
                                  value={lessonForm.description}
                                  onChange={(event) => onLessonFieldChange('description', event.target.value)}
                                />
                                <Select
                                  value={lessonForm.contentType}
                                  onChange={(value) => onLessonFieldChange('contentType', value)}
                                  options={[
                                    { label: 'Texto', value: 'text' },
                                    { label: 'Video', value: 'video' },
                                    { label: 'Archivo', value: 'file' },
                                    { label: 'Mixto', value: 'mixed' },
                                  ]}
                                />
                                <Input.TextArea
                                  rows={3}
                                  placeholder="Contenido principal"
                                  value={lessonForm.contentText}
                                  onChange={(event) => onLessonFieldChange('contentText', event.target.value)}
                                />
                                <Input
                                  placeholder="URL video (opcional)"
                                  value={lessonForm.videoUrl}
                                  onChange={(event) => onLessonFieldChange('videoUrl', event.target.value)}
                                />
                                <Input
                                  placeholder="URL recurso (opcional)"
                                  value={lessonForm.resourceUrl}
                                  onChange={(event) => onLessonFieldChange('resourceUrl', event.target.value)}
                                />
                                <InputNumber
                                  style={{ width: '100%' }}
                                  min={0}
                                  value={lessonForm.durationMinutes}
                                  onChange={(value) => onLessonFieldChange('durationMinutes', value ?? 0)}
                                  addonBefore="Duracion"
                                  addonAfter="min"
                                />
                                <InputNumber
                                  style={{ width: '100%' }}
                                  min={1}
                                  value={lessonForm.sortOrder}
                                  onChange={(value) => onLessonFieldChange('sortOrder', value ?? 1)}
                                  addonBefore="Orden"
                                />
                                <Space>
                                  <Text>Preview gratis</Text>
                                  <Switch checked={Boolean(lessonForm.isFreePreview)} onChange={(checked) => onLessonFieldChange('isFreePreview', checked)} />
                                </Space>
                                <Space>
                                  <Text>Publicado</Text>
                                  <Switch checked={Boolean(lessonForm.isPublished)} onChange={(checked) => onLessonFieldChange('isPublished', checked)} />
                                </Space>
                                <Button
                                  type="primary"
                                  icon={<PlusOutlined />}
                                  loading={busyAction === 'lesson-create'}
                                  disabled={!canManageSelectedCourse}
                                  onClick={onCreateLesson}
                                >
                                  Crear leccion
                                </Button>
                              </Space>
                            ) : (
                              <Empty description="Selecciona un modulo primero" />
                            )}
                          </Card>
                        </Col>
                      </Row>
                    </Space>
                  ) : (
                    <Card>
                      <Empty description="Selecciona un curso para gestionar modulos y lecciones" />
                    </Card>
                  )
                ) : null}

                {managerTab === 'progress' ? (
                  selectedCourse ? (
                    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
                      <Card
                        title={`Mi progreso en ${selectedCourse.title}`}
                        extra={(
                          <Button
                            icon={<ReloadOutlined />}
                            loading={progressLoading}
                            onClick={async () => {
                              await loadMyCourseProgress(token, selectedCourse.id)
                              await loadCourseProgressOverview(token, selectedCourse.id)
                            }}
                          >
                            Recargar
                          </Button>
                        )}
                      >
                        <Row gutter={[16, 16]}>
                          <Col xs={24} md={8}>
                            <Statistic
                              title="Porcentaje"
                              value={Number(myCourseProgress?.progressPercent || 0)}
                              suffix="%"
                            />
                          </Col>
                          <Col xs={24} md={8}>
                            <Statistic
                              title="Lecciones completadas"
                              value={`${Number(myCourseProgress?.completedLessons || 0)}/${Number(myCourseProgress?.totalLessons || 0)}`}
                            />
                          </Col>
                          <Col xs={24} md={8}>
                            <Statistic
                              title="Tiempo invertido"
                              value={formatMinutes(
                                Object.values(lessonProgressMap).reduce((sum, row) => sum + Number(row?.timeSpentMinutes || 0), 0)
                              )}
                            />
                          </Col>
                        </Row>
                        <Progress
                          style={{ marginTop: 16 }}
                          percent={Number(myCourseProgress?.progressPercent || 0)}
                          status={Number(myCourseProgress?.progressPercent || 0) >= 100 ? 'success' : 'active'}
                        />
                        <Space size={18} style={{ marginTop: 12 }}>
                          <Text type="secondary">Inicio: {formatDateTime(myCourseProgress?.startedAt)}</Text>
                          <Text type="secondary">Completado: {formatDateTime(myCourseProgress?.completedAt)}</Text>
                          <Text type="secondary">Actualizado: {formatDateTime(myCourseProgress?.updatedAt)}</Text>
                        </Space>
                      </Card>

                      {canReadReports && canManageSelectedCourse ? (
                        <Card
                          title="Progreso del curso por alumno"
                          extra={(
                            <Button icon={<ReloadOutlined />} onClick={() => loadCourseProgressOverview(token, selectedCourse.id)}>
                              Actualizar reporte
                            </Button>
                          )}
                        >
                          <Table
                            rowKey="userId"
                            dataSource={courseProgressRows}
                            pagination={{ pageSize: 8, hideOnSinglePage: true }}
                            columns={progressOverviewColumns}
                            locale={{ emptyText: 'Sin datos de progreso todavia' }}
                          />
                        </Card>
                      ) : (
                        <Card>
                          <Empty description="No tienes permiso para ver el reporte global del curso" />
                        </Card>
                      )}
                    </Space>
                  ) : (
                    <Card>
                      <Empty description="Selecciona un curso para ver progreso" />
                    </Card>
                  )
                ) : null}

                {managerTab === 'users' ? (
                  canReadUsers ? (
                    <Row gutter={[16, 16]}>
                      <Col xs={24} xl={15}>
                        <Card
                          title="Usuarios del sistema"
                          extra={(
                            <Button icon={<ReloadOutlined />} loading={adminLoading} onClick={() => loadAdminUsers(token)}>
                              Recargar
                            </Button>
                          )}
                        >
                          <Space direction="vertical" size={12} style={{ display: 'flex' }}>
                            <Row gutter={[8, 8]}>
                              <Col xs={24} md={10}>
                                <Input
                                  allowClear
                                  placeholder="Buscar por nombre o email"
                                  value={userSearch}
                                  onChange={(event) => setUserSearch(event.target.value)}
                                />
                              </Col>
                              <Col xs={24} md={7}>
                                <Select
                                  style={{ width: '100%' }}
                                  value={userRoleFilter}
                                  onChange={setUserRoleFilter}
                                  options={[
                                    { label: 'Todos los roles', value: 'all' },
                                    { label: 'Admin', value: 'admin' },
                                    { label: 'Profesor', value: 'teacher' },
                                    { label: 'Estudiante', value: 'student' },
                                  ]}
                                />
                              </Col>
                              <Col xs={24} md={7}>
                                <Select
                                  style={{ width: '100%' }}
                                  value={userActiveFilter}
                                  onChange={setUserActiveFilter}
                                  options={[
                                    { label: 'Todos', value: 'all' },
                                    { label: 'Activos', value: 'active' },
                                    { label: 'Inactivos', value: 'inactive' },
                                  ]}
                                />
                              </Col>
                            </Row>

                            <Button
                              onClick={() => loadAdminUsers(token, { search: userSearch, role: userRoleFilter, active: userActiveFilter })}
                              icon={<UserOutlined />}
                            >
                              Aplicar filtros
                            </Button>

                            <Table
                              rowKey="id"
                              loading={adminLoading}
                              dataSource={systemUsers}
                              pagination={{ pageSize: 8, hideOnSinglePage: true }}
                              columns={userColumns}
                            />
                          </Space>
                        </Card>
                      </Col>
                      <Col xs={24} xl={9}>
                        <Card title="Crear usuario">
                          <Space direction="vertical" size={10} style={{ display: 'flex' }}>
                            <Input
                              placeholder="Nombre completo"
                              value={adminUserForm.fullName}
                              onChange={(event) => onAdminUserFormChange('fullName', event.target.value)}
                            />
                            <Input
                              type="email"
                              placeholder="correo@dominio.com"
                              value={adminUserForm.email}
                              onChange={(event) => onAdminUserFormChange('email', event.target.value)}
                            />
                            <Input.Password
                              placeholder="Contrasena inicial"
                              value={adminUserForm.password}
                              onChange={(event) => onAdminUserFormChange('password', event.target.value)}
                            />
                            <Select
                              value={adminUserForm.primaryRole}
                              onChange={(value) => onAdminUserFormChange('primaryRole', value)}
                              options={[
                                { label: 'Administrador', value: 'admin' },
                                { label: 'Profesor', value: 'teacher' },
                                { label: 'Estudiante', value: 'student' },
                              ]}
                            />
                            <Checkbox.Group
                              value={adminUserForm.roles}
                              options={[
                                { label: 'Admin', value: 'admin' },
                                { label: 'Profesor', value: 'teacher' },
                                { label: 'Estudiante', value: 'student' },
                              ]}
                              onChange={(value) => onAdminUserFormChange('roles', value)}
                            />
                            <Space>
                              <Text>Activo</Text>
                              <Switch checked={Boolean(adminUserForm.active)} onChange={(checked) => onAdminUserFormChange('active', checked)} />
                            </Space>
                            <Button
                              type="primary"
                              icon={<PlusOutlined />}
                              loading={busyAction === 'create-admin-user'}
                              disabled={!canCreateUsers}
                              onClick={onCreateAdminUser}
                            >
                              Crear usuario
                            </Button>
                          </Space>
                        </Card>

                        <Card title="Editar usuario seleccionado" style={{ marginTop: 16 }}>
                          {selectedUser ? (
                            <Space direction="vertical" size={10} style={{ display: 'flex' }}>
                              <Text type="secondary">{selectedUser.email}</Text>
                              <Input
                                placeholder="Nombre completo"
                                value={editUserForm.fullName}
                                onChange={(event) => onEditUserFormChange('fullName', event.target.value)}
                              />
                              <Select
                                value={editUserForm.primaryRole}
                                onChange={(value) => onEditUserFormChange('primaryRole', value)}
                                options={[
                                  { label: 'Administrador', value: 'admin' },
                                  { label: 'Profesor', value: 'teacher' },
                                  { label: 'Estudiante', value: 'student' },
                                ]}
                              />
                              <Checkbox.Group
                                value={editUserForm.roles}
                                options={[
                                  { label: 'Admin', value: 'admin' },
                                  { label: 'Profesor', value: 'teacher' },
                                  { label: 'Estudiante', value: 'student' },
                                ]}
                                onChange={(value) => onEditUserFormChange('roles', value)}
                              />
                              <Space>
                                <Text>Activo</Text>
                                <Switch checked={Boolean(editUserForm.active)} onChange={(checked) => onEditUserFormChange('active', checked)} />
                              </Space>
                              <Button
                                type="primary"
                                icon={<EditOutlined />}
                                loading={busyAction === 'update-admin-user'}
                                disabled={!canUpdateUsers}
                                onClick={onUpdateSelectedUser}
                              >
                                Guardar cambios
                              </Button>
                            </Space>
                          ) : (
                            <Empty description="Selecciona un usuario para editar" />
                          )}
                        </Card>
                      </Col>
                    </Row>
                  ) : (
                    <Card>
                      <Empty description="No tienes permiso para ver usuarios" />
                    </Card>
                  )
                ) : null}

                {managerTab === 'roles' ? (
                  canReadRoles ? (
                    <Row gutter={[16, 16]}>
                      <Col xs={24} xl={16}>
                        <Card
                          title="Permisos por rol"
                          extra={(
                            <Button icon={<ReloadOutlined />} loading={permissionsLoading} onClick={() => loadRolePermissions(token)}>
                              Recargar
                            </Button>
                          )}
                        >
                          <Space direction="vertical" size={12} style={{ display: 'flex' }}>
                            <Select
                              value={selectedRoleCode}
                              onChange={setSelectedRoleCode}
                              options={roleOptions}
                            />
                            <Checkbox.Group
                              value={rolePermissionDraft}
                              options={permissionsCheckboxOptions}
                              onChange={(value) => setRolePermissionDraft(value)}
                              style={{ display: 'grid', gap: 8 }}
                            />
                            <Button
                              type="primary"
                              icon={<SafetyCertificateOutlined />}
                              loading={busyAction === 'save-role-permissions'}
                              disabled={!canManageRoles}
                              onClick={onSaveRolePermissions}
                            >
                              Guardar permisos del rol
                            </Button>
                          </Space>
                        </Card>
                      </Col>
                      <Col xs={24} xl={8}>
                        <Card title="Roles disponibles">
                          <List
                            dataSource={rolesCatalog}
                            locale={{ emptyText: 'Sin roles' }}
                            renderItem={(role) => (
                              <List.Item>
                                <Space direction="vertical" size={0}>
                                  <Text strong>{role.name}</Text>
                                  <Text type="secondary">{role.code}</Text>
                                  <Text type="secondary">{role.description}</Text>
                                </Space>
                              </List.Item>
                            )}
                          />
                        </Card>
                      </Col>
                    </Row>
                  ) : (
                    <Card>
                      <Empty description="No tienes permiso para roles y permisos" />
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
