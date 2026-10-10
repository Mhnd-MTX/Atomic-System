import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, ArrowDownRight, ArrowUpRight, Atom, Bell, Check, CheckCheck,
  ChevronDown, ChevronRight, CircleHelp, Clock3, Command, ExternalLink,
  FilePlus2, Filter, LayoutDashboard, ListTodo, LogOut, Menu, Moon, MoreHorizontal,
  Pencil, Plus, Search, Settings2, ShieldCheck, Sun, Trash2, Users, X, Zap,
} from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { isSupabaseConfigured, supabase } from './lib/supabase.js'
import logo from '../Logo.png'

const initialMembers = [
  { id: 'm1', name: 'Maya Chen', email: 'maya@atomic.dev', role: 'leader', green_points: 18, red_points: 2, avatar: 'MC' },
  { id: 'm2', name: 'Alex Rivera', email: 'alex@atomic.dev', role: 'member', green_points: 14, red_points: 3, avatar: 'AR' },
  { id: 'm3', name: 'Jordan Kim', email: 'jordan@atomic.dev', role: 'member', green_points: 11, red_points: 1, avatar: 'JK' },
  { id: 'm4', name: 'Sam Patel', email: 'sam@atomic.dev', role: 'member', green_points: 9, red_points: 4, avatar: 'SP' },
]

const hoursFromNow = (hours) => new Date(Date.now() + hours * 3600000).toISOString()
const initialTasks = [
  { id: 't1', title: 'Ship the auth flow', description: 'Finish password reset and wire the session refresh state into the client.', assigned_to: 'm2', deadline: hoursFromNow(2.25), status: 'in_progress', submission_link: '', created_at: hoursFromNow(-20), completed_at: null },
  { id: 't2', title: 'Review API contracts', description: 'Check pagination and error shapes with the platform team.', assigned_to: 'm2', deadline: hoursFromNow(9), status: 'pending', submission_link: '', created_at: hoursFromNow(-8), completed_at: null },
  { id: 't3', title: 'Refine dashboard states', description: 'Add empty, loading, and error states to the activity panel.', assigned_to: 'm3', deadline: hoursFromNow(-1), status: 'overdue', submission_link: '', created_at: hoursFromNow(-28), completed_at: null },
  { id: 't4', title: 'Document release process', description: 'Capture the checklist for preview builds and production releases.', assigned_to: 'm4', deadline: hoursFromNow(-10), status: 'submitted', submission_link: 'https://github.com/atomic-coders/docs/pull/24', submitted_at: hoursFromNow(-12), created_at: hoursFromNow(-30), completed_at: null },
  { id: 't5', title: 'Set up component tokens', description: 'Create semantic color and spacing tokens for the shared UI.', assigned_to: 'm1', deadline: hoursFromNow(-50), status: 'completed', submission_link: 'https://github.com/atomic-coders/design/pull/18', created_at: hoursFromNow(-100), completed_at: hoursFromNow(-52) },
]

const chartSeed = [
  { day: 'Mon', green: 2, red: 0 }, { day: 'Tue', green: 4, red: 1 },
  { day: 'Wed', green: 3, red: 0 }, { day: 'Thu', green: 6, red: 1 },
  { day: 'Fri', green: 5, red: 0 }, { day: 'Sat', green: 8, red: 1 },
  { day: 'Sun', green: 7, red: 0 },
]

const statusLabel = { pending: 'To do', in_progress: 'In progress', submitted: 'In review', overdue: 'Overdue', completed: 'Completed' }
const formatDeadline = (value) => new Date(value).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

function countdown(deadline, now = Date.now()) {
  const left = new Date(deadline).getTime() - now
  if (left <= 0) return 'Overdue'
  const hours = Math.floor(left / 3600000)
  const minutes = Math.floor((left % 3600000) / 60000)
  const days = Math.floor(hours / 24)
  return days ? `${days}d ${hours % 24}h left` : `${hours}h ${minutes}m left`
}

function Brand({ compact = false }) {
  return <div className={`brand-lockup ${compact ? 'brand-compact' : ''}`}>
    <span className="brand-symbol"><img src={logo} alt="" /></span>
    <span className="brand-name">Atomic<span>Coders</span></span>
  </div>
}

function Avatar({ member, size = 'normal' }) {
  const initials = member.avatar || member.name?.split(' ').map((part) => part[0]).join('').slice(0, 2)
  return <span className={`avatar avatar-${size}`}>{initials}</span>
}

function App() {
  const [members, setMembers] = useState(initialMembers)
  const [tasks, setTasks] = useState(initialTasks)
  const [activity, setActivity] = useState([])
  const [user, setUser] = useState(null)
  const [view, setView] = useState(window.location.pathname === '/leader' ? 'leader' : window.location.pathname === '/leaderboard' ? 'leaderboard' : window.location.pathname === '/activity' ? 'activity' : 'dashboard')
  const [theme, setTheme] = useState(localStorage.getItem('atomic-theme') || 'dark')
  const [now, setNow] = useState(Date.now())
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loginName, setLoginName] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [leaderOpen, setLeaderOpen] = useState(false)
  const [leaderPassword, setLeaderPassword] = useState('')
  const [leaderError, setLeaderError] = useState('')
  const [toast, setToast] = useState('')
  const [modal, setModal] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', description: '', assigned_to: '', deadline: '' })
  const [editingTask, setEditingTask] = useState(null)
  const [submission, setSubmission] = useState({ task: null, link: '' })
  const [newMember, setNewMember] = useState({ name: '', email: '', password: '' })
  const [memberDraft, setMemberDraft] = useState(null)
  const seenTaskIds = useRef(null)
  const isDemo = !isSupabaseConfigured
  const isLeader = user?.role === 'leader'

  useEffect(() => {
    if (!user) return
    if (view === 'leader' && !isLeader) {
      window.history.replaceState({}, '', '/dashboard')
      setView('dashboard')
    } else if (view === 'leader' && isLeader && !sessionStorage.getItem('atomic-leader-verified')) {
      setLeaderOpen(true)
    }
  }, [user, view, isLeader])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('atomic-theme', theme)
  }, [theme])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!newTask.deadline.endsWith('Z')) return
    const date = new Date(newTask.deadline)
    const localValue = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    setNewTask((current) => ({ ...current, deadline: localValue }))
  }, [newTask.deadline])

  useEffect(() => {
    const onPop = () => setView(window.location.pathname === '/leader' ? 'leader' : window.location.pathname === '/leaderboard' ? 'leaderboard' : window.location.pathname === '/activity' ? 'activity' : 'dashboard')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    if (isDemo) return
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active || !data.session) return
      const { data: profile } = await supabase.from('team_members').select('id,name,email,role,red_points,green_points,avatar').eq('id', data.session.user.id).single()
      if (active && profile) setUser(profile)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) setUser(null)
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [isDemo])

  useEffect(() => {
    if (!user || isDemo) return
    const poll = async () => {
      if (isDemo) return
      await supabase.rpc('check_overdue_tasks')
      const [taskResult, memberResult, activityResult] = await Promise.all([
        supabase.from('tasks').select('*').order('deadline', { ascending: true }),
        supabase.from('team_members').select('id,name,email,role,red_points,green_points,avatar').order('name'),
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(40),
      ])
      if (!taskResult.error) {
        const nextTasks = taskResult.data || []
        if (seenTaskIds.current) {
          const oldIds = new Set(seenTaskIds.current)
          const assigned = nextTasks.find((task) => task.assigned_to === user?.id && !oldIds.has(task.id))
          if (assigned) notifyNewTask(assigned.title)
        }
        seenTaskIds.current = nextTasks.map((task) => task.id)
        setTasks(nextTasks)
      }
      if (!memberResult.error) setMembers(memberResult.data || [])
      if (!activityResult.error) setActivity(activityResult.data || [])
    }
    poll()
    const timer = window.setInterval(poll, 60000)
    return () => window.clearInterval(timer)
  }, [user, isDemo])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const member = (id) => members.find((item) => item.id === id)
  const myTasks = tasks.filter((task) => task.assigned_to === user?.id)
  const doneCount = myTasks.filter((task) => task.status === 'completed').length
  const completionRate = myTasks.length ? Math.round((doneCount / myTasks.length) * 100) : 0
  const sortedMembers = [...members].sort((a, b) => b.green_points - a.green_points || a.red_points - b.red_points)
  const filteredTasks = tasks.filter((task) => {
    const selected = filter === 'all' || task.status === filter
    const query = search.toLowerCase()
    return selected && (!query || `${task.title} ${task.description} ${member(task.assigned_to)?.name}`.toLowerCase().includes(query))
  }).map((task) => task.status === 'overdue' && task.submission_link ? { ...task, status: 'submitted' } : task)
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 7)
  const weeklyTasks = tasks.filter((task) => new Date(task.created_at) >= weekStart)
  const weeklyCompletions = tasks.filter((task) => task.status === 'completed' && new Date(task.completed_at || 0) >= weekStart).length
  const weeklyOverdue = tasks.filter((task) => task.status === 'overdue' && new Date(task.deadline) >= weekStart).length

  function navigate(nextView) {
    if (nextView === 'leader' && !isLeader) {
      setToast('Leader access is limited to team leaders.')
      return
    }
    if (nextView === 'leader' && !sessionStorage.getItem('atomic-leader-verified')) {
      setLeaderOpen(true)
      return
    }
    const paths = { dashboard: '/dashboard', leader: '/leader', leaderboard: '/leaderboard', activity: '/activity' }
    window.history.pushState({}, '', paths[nextView])
    setView(nextView)
    setMobileNav(false)
  }

  async function login(event) {
    event.preventDefault()
    setLoginError('')
    if (isDemo) {
      const found = members.find((item) => item.name.toLowerCase() === loginName.trim().toLowerCase())
      if (!found || loginPassword !== 'atomic2025') {
        setLoginError('Try a team member name and password atomic2025.')
        return
      }
      setUser(found)
      setView(found.role === 'leader' ? 'leader' : 'dashboard')
      window.history.replaceState({}, '', found.role === 'leader' ? '/leader' : '/dashboard')
      if (found.role === 'leader') setLeaderOpen(true)
      return
    }
    const { data, error } = await supabase.functions.invoke('member-login', { body: { name: loginName.trim(), password: loginPassword } })
    if (error || !data?.session || !data?.member) {
      setLoginError(data?.error || (error ? `Sign-in service error: ${error.message}` : 'That name and password did not match.'))
      return
    }
    const { error: sessionError } = await supabase.auth.setSession(data.session)
    if (sessionError) {
      setLoginError('Could not start your session. Please try again.')
      return
    }
    setUser(data.member)
    setView(data.member.role === 'leader' ? 'leader' : 'dashboard')
    window.history.replaceState({}, '', data.member.role === 'leader' ? '/leader' : '/dashboard')
    if (data.member.role === 'leader') setLeaderOpen(true)
  }

  function logout() {
    if (!isDemo) supabase.auth.signOut()
    setUser(null)
    setLeaderOpen(false)
    sessionStorage.removeItem('atomic-leader-verified')
    window.history.replaceState({}, '', '/')
  }

  async function verifyLeader(event) {
    event.preventDefault()
    setLeaderError('')
    if (!isLeader) return setLeaderError('A leader account is required.')
    if (isDemo) {
      if (leaderPassword !== 'atomic2025') return setLeaderError('That password did not match.')
    } else {
      const { data, error } = await supabase.functions.invoke('leader-gate', { body: { password: leaderPassword } })
      if (error || !data?.ok) return setLeaderError(data?.error || 'That password did not match.')
    }
    sessionStorage.setItem('atomic-leader-verified', 'true')
    setLeaderOpen(false)
    setLeaderPassword('')
    navigate('leader')
  }

  async function saveTask(event) {
    event.preventDefault()
    const taskFields = { ...newTask, deadline: new Date(newTask.deadline).toISOString() }
    let activityWarning = ''
    if (editingTask && isDemo) {
      setTasks((current) => current.map((task) => task.id === editingTask.id ? { ...task, ...taskFields } : task))
      setActivity((current) => [{ id: crypto.randomUUID(), description: `Updated “${newTask.title}”.`, created_at: new Date().toISOString() }, ...current])
    } else if (isDemo) {
      const task = { ...taskFields, id: crypto.randomUUID(), status: 'pending', submission_link: '', created_at: new Date().toISOString(), completed_at: null }
      setTasks((current) => [task, ...current])
      setActivity((current) => [{ id: crypto.randomUUID(), description: `Assigned “${task.title}” to ${member(task.assigned_to)?.name}.`, created_at: new Date().toISOString() }, ...current])
    } else if (editingTask) {
      const { error } = await supabase.from('tasks').update(taskFields).eq('id', editingTask.id)
      if (error) return setToast(error.message)
      const { error: activityError } = await supabase.from('activity_logs').insert({
        actor_id: user.id, member_id: newTask.assigned_to, task_id: editingTask.id,
        action: 'task_updated', description: `Updated “${newTask.title}”.`,
      })
      await refreshLiveData()
      if (activityError) setToast(`Task updated, but its activity could not be recorded: ${activityError.message}`)
    } else {
      const { data: createdTask, error } = await supabase.from('tasks').insert(taskFields).select('id').single()
      if (error) return setToast(error.message)
      const { error: activityError } = await supabase.from('activity_logs').insert({ actor_id: user.id, member_id: newTask.assigned_to, task_id: createdTask.id, action: 'task_created', description: `Assigned “${newTask.title}” to ${member(newTask.assigned_to)?.name}.` })
      if (activityError) activityWarning = `Task assigned, but its activity could not be recorded: ${activityError.message}`
      await refreshLiveData()
    }
    setModal('')
    setEditingTask(null)
    setNewTask({ title: '', description: '', assigned_to: '', deadline: '' })
    if (!editingTask) setToast(activityWarning || 'Task assigned. The member will be notified on their next refresh.')
    else if (isDemo) setToast('Task updated.')
  }

  function editTask(task) {
    setEditingTask(task)
    setNewTask({ title: task.title, description: task.description || '', assigned_to: task.assigned_to || '', deadline: task.deadline })
    setModal('edit-task')
  }

  async function deleteTask(task) {
    if (!window.confirm(`Remove “${task.title}” from the task list?`)) return
    if (isDemo) {
      setTasks((current) => current.filter((item) => item.id !== task.id))
      setActivity((current) => [{ id: crypto.randomUUID(), description: `Removed “${task.title}”.`, created_at: new Date().toISOString() }, ...current])
    } else {
      const { error } = await supabase.from('tasks').delete().eq('id', task.id)
      if (error) return setToast(error.message)
      const { error: activityError } = await supabase.from('activity_logs').insert({
        actor_id: user.id, member_id: task.assigned_to, action: 'task_deleted',
        description: `Removed “${task.title}”.`,
      })
      await refreshLiveData()
      if (activityError) return setToast(`Task removed, but its activity could not be recorded: ${activityError.message}`)
    }
    setToast('Task removed.')
  }

  async function reviewTask(task, approve) {
    const nextStatus = approve ? 'completed' : new Date(task.deadline) < new Date() ? 'overdue' : 'pending'
    const awardPoint = approve && task.submitted_at && new Date(task.submitted_at) <= new Date(task.deadline)
    const patch = { status: nextStatus, completed_at: approve ? new Date().toISOString() : null, submission_link: approve ? task.submission_link : null }
    if (isDemo) {
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, ...patch } : item))
      if (awardPoint) setMembers((current) => current.map((person) => person.id === task.assigned_to ? { ...person, green_points: person.green_points + 1 } : person))
      setActivity((current) => [{ id: crypto.randomUUID(), description: `${approve ? 'Approved' : 'Requested changes to'} “${task.title}”.`, created_at: new Date().toISOString() }, ...current])
    } else {
      const { error } = await supabase.rpc('review_task', { task_id: task.id, approve })
      if (error) return setToast(error.message)
      await refreshLiveData()
    }
    setToast(approve ? awardPoint ? 'Approved. One green point awarded.' : 'Approved. No green point was awarded for a late submission.' : 'Submission returned to the task list.')
  }

  async function submitTask(event) {
    event.preventDefault()
    const { task, link } = submission
    if (isDemo) {
      const submittedAt = new Date().toISOString()
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: new Date(item.deadline) < new Date(submittedAt) ? 'overdue' : 'submitted', submitted_at: submittedAt, submission_link: link } : item))
    } else {
      const { error } = await supabase.rpc('submit_task', { task_id: task.id, submission_link: link })
      if (error) return setToast(error.message)
    }
    setModal('')
    setSubmission({ task: null, link: '' })
    setToast('Submission sent for review.')
  }

  async function saveMember(event) {
    event.preventDefault()
    if (isDemo) {
      if (memberDraft) setMembers((current) => current.map((item) => item.id === memberDraft.id ? { ...item, ...memberDraft } : item))
      else setMembers((current) => [...current, { ...newMember, id: crypto.randomUUID(), avatar: newMember.name.split(' ').map((part) => part[0]).join('').slice(0, 2), role: 'member', green_points: 0, red_points: 0 }])
    } else {
      const body = memberDraft ? { action: 'update', member: memberDraft } : { action: 'create', member: newMember }
      const { data, error } = await supabase.functions.invoke('manage-member', { body })
      if (error || data?.error) return setToast(data?.error || error.message)
      await refreshLiveData()
    }
    setModal('')
    setMemberDraft(null)
    setNewMember({ name: '', email: '', password: '' })
    setToast(memberDraft ? 'Member details updated.' : 'Member added to the team.')
  }

  async function deleteMember(person) {
    if (!window.confirm(`Remove ${person.name} from Atomic Coders? Their task history will be kept.`)) return
    if (isDemo) setMembers((current) => current.filter((item) => item.id !== person.id))
    else {
      const { data, error } = await supabase.functions.invoke('manage-member', { body: { action: 'delete', member: { id: person.id } } })
      if (error || data?.error) return setToast(data?.error || error.message)
      await refreshLiveData()
    }
    setToast('Member removed.')
  }

  async function refreshLiveData() {
    if (isDemo) return
    const [taskResult, memberResult, activityResult] = await Promise.all([
      supabase.from('tasks').select('*').order('deadline', { ascending: true }),
      supabase.from('team_members').select('id,name,email,role,red_points,green_points,avatar').order('name'),
      supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(40),
    ])
    if (!taskResult.error) setTasks(taskResult.data || [])
    if (!memberResult.error) setMembers(memberResult.data || [])
    if (!activityResult.error) setActivity(activityResult.data || [])
  }

  function notifyNewTask(title) {
    setToast(`New task assigned: ${title}`)
    try {
      const context = new AudioContext()
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.frequency.value = 740
      gain.gain.setValueAtTime(0.07, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.25)
      oscillator.start()
      oscillator.stop(context.currentTime + 0.25)
    } catch { /* Sound is optional when the browser blocks audio. */ }
    if ('Notification' in window && Notification.permission === 'granted') new Notification('Atomic Coders', { body: title })
  }

  const activityChart = useMemo(() => {
    if (isDemo) return chartSeed
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date()
      date.setHours(0, 0, 0, 0)
      date.setDate(date.getDate() - 6 + index)
      return { key: date.toDateString(), day: date.toLocaleDateString([], { weekday: 'short' }), green: 0, red: 0 }
    })
    activity.filter((entry) => entry.member_id === user?.id).forEach((entry) => {
      const day = days.find((item) => item.key === new Date(entry.created_at).toDateString())
      if (day && entry.action === 'task_approved') day.green += 1
      if (day && entry.action === 'task_overdue') day.red += 1
    })
    return days
  }, [activity, isDemo, user?.id])

  if (!user) return <LoginScreen name={loginName} password={loginPassword} setName={setLoginName} setPassword={setLoginPassword} onSubmit={login} error={loginError} demo={isDemo} />

  const overdueTasks = (isLeader ? tasks : myTasks).filter((task) => task.status === 'overdue')
  const showLeaderView = view === 'leader' && isLeader && sessionStorage.getItem('atomic-leader-verified')

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="sidebar-top"><Brand /><button className="icon-button mobile-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={18} /></button></div>
      <div className="workspace-switch"><span className="workspace-dot"><Atom size={14} /></span><span><strong>Atomic Coders</strong><small>Product team</small></span><ChevronDown size={15} /></div>
      <div className="nav-label">WORKSPACE</div>
      <nav className="side-nav">
        <NavButton active={view === 'dashboard'} icon={<LayoutDashboard size={17} />} label="Overview" onClick={() => navigate('dashboard')} />
        <NavButton active={view === 'leaderboard'} icon={<Users size={17} />} label="Leaderboard" onClick={() => navigate('leaderboard')} />
        <NavButton active={view === 'activity'} icon={<Activity size={17} />} label="Activity log" onClick={() => navigate('activity')} />
        {isLeader && <><div className="nav-label nav-sub-label">MANAGE</div><NavButton active={view === 'leader'} icon={<ShieldCheck size={17} />} label="Leader console" onClick={() => navigate('leader')} /></>}
      </nav>
      <div className="sidebar-bottom">
        <div className="week-card"><div className="week-heading"><span>THIS WEEK</span><Zap size={14} /></div><strong>{weeklyCompletions}<small> / {weeklyTasks.length || 0}</small></strong><div className="week-progress"><i style={{ width: `${weeklyTasks.length ? Math.min(100, (weeklyCompletions / weeklyTasks.length) * 100) : 0}%` }} /></div><span className="week-caption">tasks completed</span></div>
        <button className="profile-row" onClick={logout}><Avatar member={user} /><span className="profile-info"><strong>{user.name}</strong><small>{isLeader ? 'Team leader' : 'Team member'}</small></span><LogOut size={15} /></button>
      </div>
    </aside>
    {mobileNav && <button className="nav-scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
    <main className="main-panel">
      <header className="topbar">
        <button className="icon-button menu-toggle" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={19} /></button>
        <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{showLeaderView ? 'Leader console' : view === 'leaderboard' ? 'Leaderboard' : view === 'activity' ? 'Activity log' : 'Overview'}</strong></div>
        <div className="top-actions"><span className={`sync-status ${isDemo ? 'sync-demo' : ''}`}><i />{isDemo ? 'DEMO MODE' : 'LIVE SYNC'}</span><button className="icon-button theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button><button className="icon-button notification-button" aria-label="Notifications" onClick={() => 'Notification' in window && Notification.requestPermission()}><Bell size={17} /><i /></button><Avatar member={user} size="small" /></div>
      </header>
      <div className="page-content">
        {overdueTasks.length > 0 && <div className="alert-banner"><span className="alert-pulse" /><div><strong>{overdueTasks.length} task{overdueTasks.length > 1 ? 's are' : ' is'} past the deadline</strong><span>{isLeader ? 'Overdue points are recorded automatically.' : 'A red point has been recorded for each overdue task.'}</span></div><button onClick={() => isLeader ? navigate('leader') : setFilter('overdue')}>Review tasks <ChevronRight size={14} /></button></div>}

        {!showLeaderView && view === 'dashboard' && <Dashboard user={user} isLeader={isLeader} tasks={myTasks} members={members} now={now} doneCount={doneCount} completionRate={completionRate} activityChart={activityChart} onSubmit={(task) => { setSubmission({ task, link: task.submission_link || '' }); setModal('submission') }} onNavigate={navigate} />}
        {showLeaderView && <LeaderConsole tasks={tasks} members={members} filteredTasks={filteredTasks} filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} member={member} weeklyTasks={weeklyTasks} weeklyCompletions={weeklyCompletions} weeklyOverdue={weeklyOverdue} onAddTask={() => { setEditingTask(null); setNewTask({ title: '', description: '', assigned_to: '', deadline: '' }); setModal('task') }} onEditTask={editTask} onDeleteTask={deleteTask} onAddMember={() => { setMemberDraft(null); setModal('member') }} onEditMember={(person) => { setMemberDraft({ ...person }); setModal('edit-member') }} onDeleteMember={deleteMember} onReview={reviewTask} onSubmitLink={(task) => window.open(task.submission_link, '_blank', 'noopener,noreferrer')} />}
        {view === 'leaderboard' && <Leaderboard members={sortedMembers} tasks={tasks} member={member} />}
        {view === 'activity' && <ActivityPage activity={activity} tasks={tasks} members={members} isDemo={isDemo} />}
      </div>
    </main>
    {modal && <Modal onClose={() => setModal('')} title={modal === 'edit-task' ? 'Edit task' : modal === 'task' ? 'Create a task' : modal === 'submission' ? 'Submit your work' : modal === 'edit-member' ? 'Edit team member' : 'Add a team member'}>
      {(modal === 'task' || modal === 'edit-task') && <form className="form-stack" onSubmit={saveTask}><label>Task title<input required autoFocus value={newTask.title} onChange={(event) => setNewTask({ ...newTask, title: event.target.value })} placeholder="e.g. Ship the new onboarding flow" /></label><label>Description<textarea rows="3" value={newTask.description} onChange={(event) => setNewTask({ ...newTask, description: event.target.value })} placeholder="What does done look like?" /></label><div className="form-two"><label>Assign to<select required value={newTask.assigned_to} onChange={(event) => setNewTask({ ...newTask, assigned_to: event.target.value })}><option value="">Choose a teammate</option>{members.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label>Deadline<input required type="datetime-local" value={newTask.deadline} onChange={(event) => setNewTask({ ...newTask, deadline: event.target.value ? new Date(event.target.value).toISOString() : '' })} /></label></div><ModalActions onCancel={() => setModal('')} submit={editingTask ? 'Save changes' : 'Assign task'} /></form>}
      {modal === 'submission' && <form className="form-stack" onSubmit={submitTask}><p className="modal-copy">Share a link to your finished work. Your teammate lead will review it.</p><label>Work link<input autoFocus required type="url" value={submission.link} onChange={(event) => setSubmission({ ...submission, link: event.target.value })} placeholder="https://github.com/..." /></label><ModalActions onCancel={() => setModal('')} submit="Send for review" /></form>}
      {(modal === 'member' || modal === 'edit-member') && <form className="form-stack" onSubmit={saveMember}><label>Full name<input required autoFocus value={memberDraft?.name ?? newMember.name} onChange={(event) => memberDraft ? setMemberDraft({ ...memberDraft, name: event.target.value }) : setNewMember({ ...newMember, name: event.target.value })} placeholder="Name" /></label><label>Email<input required type="email" value={memberDraft?.email ?? newMember.email} onChange={(event) => memberDraft ? setMemberDraft({ ...memberDraft, email: event.target.value }) : setNewMember({ ...newMember, email: event.target.value })} placeholder="name@team.com" /></label>{!memberDraft && <label>Temporary password<input required minLength="8" type="password" value={newMember.password} onChange={(event) => setNewMember({ ...newMember, password: event.target.value })} placeholder="At least 8 characters" /></label>}<ModalActions onCancel={() => setModal('')} submit={memberDraft ? 'Save changes' : 'Add member'} /></form>}
    </Modal>}
    {leaderOpen && <Modal onClose={() => { setLeaderOpen(false); if (view === 'leader') navigate('dashboard') }} title="Leader access" eyebrow="RESTRICTED AREA"><form className="form-stack" onSubmit={verifyLeader}><p className="modal-copy">Confirm your leader passphrase to open the private team console.</p><label>Leader password<input autoFocus required type="password" value={leaderPassword} onChange={(event) => setLeaderPassword(event.target.value)} placeholder="Enter passphrase" /></label>{leaderError && <p className="form-error">{leaderError}</p>}<ModalActions onCancel={() => { setLeaderOpen(false); if (view === 'leader') navigate('dashboard') }} submit="Unlock console" /></form></Modal>}
    {toast && <div className="toast"><Check size={16} />{toast}<button onClick={() => setToast('')} aria-label="Dismiss"><X size={15} /></button></div>}
  </div>
}

function NavButton({ active, icon, label, onClick }) {
  return <button className={`nav-item ${active ? 'nav-item-active' : ''}`} onClick={onClick}>{icon}<span>{label}</span>{active && <i />}</button>
}

function LoginScreen({ name, password, setName, setPassword, onSubmit, error, demo }) {
  return <main className="login-screen"><div className="login-left"><div className="login-brand"><Brand /></div><div className="login-art"><div className="orbit orbit-a" /><div className="orbit orbit-b" /><div className="orbit orbit-c" /><span className="atom-core"><Atom size={60} strokeWidth={1.1} /></span><span className="orbit-point point-a" /><span className="orbit-point point-b" /><span className="orbit-point point-c" /><span className="art-coordinate">AC / 01</span></div><div className="login-footer"><span>BUILT TOGETHER, SHIPPED TOGETHER.</span><span>EST. 2025</span></div></div><section className="login-form-panel"><div className="login-form-wrap"><div className="login-mobile-brand"><Brand /></div><span className="eyebrow"><i /> TEAM WORKSPACE</span><h1>Good work<br />starts <em>together.</em></h1><p className="login-intro">Sign in to your Atomic Coders workspace.</p><form className="form-stack login-form" onSubmit={onSubmit}><label>Your name<input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Maya Chen" /></label><label>Password<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" /></label>{error && <p className="form-error">{error}</p>}<button className="primary-button login-submit" type="submit">Enter workspace <ChevronRight size={17} /></button></form>{demo && <div className="demo-hint"><span>DEMO SIGN IN</span><button type="button" onClick={() => { setName('Maya Chen'); setPassword('atomic2025') }}>Leader preview <ArrowUpRight size={14} /></button><button type="button" onClick={() => { setName('Alex Rivera'); setPassword('atomic2025') }}>Member preview <ArrowUpRight size={14} /></button><small>Sample credentials: any team member name + atomic2025</small></div>}<div className="login-safe"><ShieldCheck size={15} /><span>Private team access, just for your crew.</span><CircleHelp size={15} /></div></div><div className="login-bottom">© 2025 ATOMIC CODERS <span>•</span> TEAM OPERATIONS</div></section></main>
}

function Dashboard({ user, isLeader, tasks, members, now, doneCount, completionRate, activityChart, onSubmit, onNavigate }) {
  const assigned = tasks.filter((task) => task.status !== 'completed').sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
  const visibleTasks = assigned.length ? assigned : tasks.filter((task) => task.status === 'completed')
  const redPoints = members.find((item) => item.id === user.id)?.red_points || 0
  const greenPoints = members.find((item) => item.id === user.id)?.green_points || 0
  return <>
    <div className="page-heading"><div><span className="eyebrow">{isLeader ? 'TEAM LEAD' : 'YOUR WORKSPACE'} <span className="heading-date">/ {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</span></span><h1>Hello, {user.name.split(' ')[0]}<span className="heading-period">.</span></h1><p>Let’s make this a good week.</p></div>{isLeader && <button className="primary-button heading-cta" onClick={() => onNavigate('leader')}><Plus size={16} /> Leader console</button>}</div>
    <div className="stats-grid"><StatCard label="MY OPEN TASKS" value={assigned.length.toString().padStart(2, '0')} note={`${tasks.filter((task) => task.status === 'submitted').length} in review`} icon={<ListTodo size={16} />} tone="acid" /><StatCard label="COMPLETION RATE" value={`${completionRate}%`} note={`${doneCount} delivered so far`} icon={<CheckCheck size={16} />} tone="mint" /><StatCard label="GREEN POINTS" value={greenPoints.toString().padStart(2, '0')} note="On-time approvals" icon={<ArrowUpRight size={16} />} tone="mint" /><StatCard label="RED POINTS" value={redPoints.toString().padStart(2, '0')} note="Missed deadlines" icon={<ArrowDownRight size={16} />} tone="coral" /></div>
    <div className="dashboard-grid"><section className="surface task-surface"><div className="section-heading"><div><span className="eyebrow">YOUR QUEUE</span><h2>My tasks <span className="count-badge">{visibleTasks.length}</span></h2></div><button className="text-button" onClick={() => onNavigate('activity')}>Activity <ChevronRight size={14} /></button></div><div className="task-list">{visibleTasks.length ? visibleTasks.map((task) => <TaskRow key={task.id} task={task} now={now} onSubmit={onSubmit} />) : <div className="empty-state"><span className="empty-icon"><CheckCheck size={22} /></span><strong>All clear for now</strong><span>Your next task will show up here.</span></div>}</div><div className="task-list-foot"><span>Updated just now</span><button onClick={() => onNavigate('activity')}>View activity log <ChevronRight size={13} /></button></div></section><div className="right-rail"><section className="surface activity-surface"><div className="section-heading compact-heading"><div><span className="eyebrow">LAST 7 DAYS</span><h2>Point activity</h2></div><button className="icon-button mini" aria-label="Chart options"><MoreHorizontal size={17} /></button></div><div className="chart-legend"><span><i className="legend-green" />Green points</span><span><i className="legend-red" />Red points</span></div><div className="activity-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={activityChart} margin={{ top: 10, right: 6, bottom: 0, left: -22 }}><CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 5" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} /><Tooltip contentStyle={{ background: 'var(--surface-raised)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 12 }} /><Line dataKey="green" name="Green" stroke="#d8ff48" strokeWidth={2.5} dot={{ r: 3, fill: '#d8ff48', strokeWidth: 0 }} activeDot={{ r: 5 }} /><Line dataKey="red" name="Red" stroke="#ff6f64" strokeWidth={2} dot={{ r: 3, fill: '#ff6f64', strokeWidth: 0 }} /></LineChart></ResponsiveContainer></div><div className="chart-foot"><span>TEAM MOMENTUM</span><strong><i /> Trending up</strong></div></section><section className="surface leaderboard-mini"><div className="section-heading compact-heading"><div><span className="eyebrow">THE CREW</span><h2>Leaderboard</h2></div><button className="text-button" onClick={() => onNavigate('leaderboard')}>View all <ChevronRight size={14} /></button></div><div className="mini-rank-list">{[...members].sort((a, b) => b.green_points - a.green_points).slice(0, 3).map((person, index) => <div className="mini-rank" key={person.id}><span className={`rank-number ${index === 0 ? 'rank-top' : ''}`}>{String(index + 1).padStart(2, '0')}</span><Avatar member={person} size="small" /><span className="mini-rank-name">{person.name}{person.id === user.id && <small>YOU</small>}</span><strong>{person.green_points}<span> GP</span></strong></div>)}</div></section></div></div>
  </>
}

function TaskRow({ task, now, onSubmit }) {
  const left = new Date(task.deadline).getTime() - now
  const duration = Math.max(new Date(task.deadline).getTime() - new Date(task.created_at).getTime(), 1)
  const remaining = Math.max(0, Math.min(100, (left / duration) * 100))
  const tone = task.status === 'overdue' || left <= 0 ? 'red' : remaining <= 50 ? 'yellow' : 'green'
  const finished = task.status === 'completed'
  return <article className={`task-row ${finished ? 'task-complete' : ''}`}><div className="task-row-main"><div className="task-title-line"><span className={`task-status-dot status-${task.status}`} /><h3>{task.title}</h3><span className={`status-chip status-chip-${task.status}`}>{statusLabel[task.status] || task.status}</span></div><p>{task.description || 'No description provided.'}</p><div className="task-meta"><span><Clock3 size={13} />{formatDeadline(task.deadline)}</span><span className={`time-remaining time-${tone}`}>{finished ? 'Delivered' : task.status === 'submitted' ? 'Waiting for review' : countdown(task.deadline, now)}</span></div>{!finished && task.status !== 'submitted' && <div className={`deadline-track track-${tone}`}><i style={{ width: `${remaining}%` }} /></div>}</div>{!finished && task.status !== 'submitted' && <button className="submit-button" onClick={() => onSubmit(task)}><ExternalLink size={14} /><span>Submit</span></button>}{task.status === 'submitted' && <span className="waiting-label"><Clock3 size={14} />In review</span>}{finished && <Check size={18} className="task-check" />}</article>
}

function StatCard({ label, value, note, icon, tone }) {
  return <section className={`stat-card stat-${tone}`}><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><strong>{value}</strong><div className="stat-note"><i />{note}</div></section>
}

function LeaderConsole({ tasks, members, filteredTasks, filter, setFilter, search, setSearch, member, weeklyTasks, weeklyCompletions, weeklyOverdue, onAddTask, onEditTask, onDeleteTask, onAddMember, onEditMember, onDeleteMember, onReview, onSubmitLink }) {
  const completed = tasks.filter((task) => task.status === 'completed').length
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0
  const chartSeed = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - 6 + index)
    const sameDay = (value) => value && new Date(value).toDateString() === date.toDateString()
    return {
      day: date.toLocaleDateString([], { weekday: 'short' }),
      green: tasks.filter((task) => task.status === 'completed' && sameDay(task.completed_at)).length,
      red: tasks.filter((task) => task.status === 'overdue' && sameDay(task.deadline)).length,
    }
  })
  return <><div className="page-heading"><div><span className="eyebrow">RESTRICTED / LEADER ACCESS</span><h1>Team console<span className="heading-period">.</span></h1><p>Keep the team moving, one task at a time.</p></div><button className="primary-button heading-cta" onClick={onAddTask}><Plus size={16} /> New task</button></div><div className="leader-stats stats-grid"><StatCard label="ACTIVE TASKS" value={tasks.filter((task) => !['completed', 'overdue'].includes(task.status)).length.toString().padStart(2, '0')} note="Across the team" icon={<ListTodo size={16} />} tone="acid" /><StatCard label="TEAM COMPLETION" value={`${progress}%`} note={`${completed} tasks delivered`} icon={<CheckCheck size={16} />} tone="mint" /><StatCard label="OVERDUE" value={tasks.filter((task) => task.status === 'overdue').length.toString().padStart(2, '0')} note="Red points applied" icon={<Clock3 size={16} />} tone="coral" /><StatCard label="TEAM MEMBERS" value={members.length.toString().padStart(2, '0')} note="In your workspace" icon={<Users size={16} />} tone="mint" /></div><div className="leader-grid"><section className="surface team-analytics"><div className="section-heading"><div><span className="eyebrow">WEEKLY SNAPSHOT</span><h2>Team progress</h2></div><span className="period-chip">LAST 7 DAYS <ChevronDown size={13} /></span></div><div className="analytics-summary"><div><strong>{weeklyCompletions}</strong><span>completed</span></div><div><strong>{weeklyTasks.length}</strong><span>assigned</span></div><div><strong className="coral-text">{weeklyOverdue}</strong><span>overdue</span></div><div className="analytics-trend"><ArrowUpRight size={15} /> Weekly report</div></div><div className="leader-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartSeed} margin={{ top: 10, right: 6, bottom: 0, left: -24 }}><CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 5" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} /><Tooltip contentStyle={{ background: 'var(--surface-raised)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 12 }} /><Bar dataKey="green" name="Completed" fill="var(--acid)" radius={[3, 3, 0, 0]} barSize={14} /><Bar dataKey="red" name="Overdue" fill="#ff6f64" radius={[3, 3, 0, 0]} barSize={14} /></BarChart></ResponsiveContainer></div><p className="report-copy"><Zap size={14} /> This week: <strong>{weeklyCompletions} delivered</strong> from {weeklyTasks.length} assigned, with {weeklyOverdue} overdue.</p></section><section className="surface team-members"><div className="section-heading"><div><span className="eyebrow">THE CREW</span><h2>Team members</h2></div><button className="icon-button add-icon" onClick={onAddMember} aria-label="Add team member"><Plus size={17} /></button></div><div className="member-table-list">{members.map((person) => <div className="member-manage-row" key={person.id}><Avatar member={person} size="small" /><div className="member-manage-name"><strong>{person.name}</strong><span>{person.role === 'leader' ? 'Team leader' : 'Member'}</span></div><div className="member-points"><strong>{person.green_points}<span> GP</span></strong><small><b>{person.red_points}</b> RP</small></div><button className="icon-button member-menu" onClick={() => onEditMember(person)} aria-label={`Edit ${person.name}`}><Settings2 size={15} /></button><button className="icon-button member-menu member-delete" onClick={() => onDeleteMember(person)} aria-label={`Remove ${person.name}`}><Trash2 size={14} /></button></div>)}</div><button className="add-member-button" onClick={onAddMember}><Plus size={15} /> Add a teammate</button></section></div><section className="surface task-table-surface"><div className="section-heading table-heading"><div><span className="eyebrow">WORK TRACKER</span><h2>All tasks <span className="count-badge">{filteredTasks.length}</span></h2></div><button className="primary-button compact-primary" onClick={onAddTask}><Plus size={15} /> Create task</button></div><div className="table-controls"><div className="filter-tabs">{[['all', 'All'], ['pending', 'To do'], ['in_progress', 'In progress'], ['submitted', 'In review'], ['overdue', 'Overdue'], ['completed', 'Completed']].map(([value, label]) => <button key={value} className={filter === value ? 'filter-active' : ''} onClick={() => setFilter(value)}>{label}{value === 'overdue' && <i className="filter-alert" />}</button>)}</div><label className="search-box"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks" /><Filter size={14} /></label></div><div className="task-table-wrap"><table className="task-table"><thead><tr><th>TASK</th><th>ASSIGNED TO</th><th>DEADLINE</th><th>STATUS</th><th>SUBMISSION</th><th /></tr></thead><tbody>{filteredTasks.map((task) => { const assigned = member(task.assigned_to); return <tr key={task.id}><td><strong className="table-task-title">{task.title}</strong><span className="table-task-desc">{task.description}</span></td><td><span className="table-person">{assigned && <Avatar member={assigned} size="tiny" />}{assigned?.name || 'Unassigned'}</span></td><td><span className="table-deadline">{formatDeadline(task.deadline)}</span></td><td><span className={`status-chip status-chip-${task.status}`}>{statusLabel[task.status] || task.status}</span></td><td>{task.submission_link ? <button className="link-button" onClick={() => onSubmitLink(task)}><ExternalLink size={13} /> Open link</button> : <span className="muted-dash">—</span>}</td><td><div className="review-actions">{task.status === 'submitted' && <><button className="approve-button" onClick={() => onReview(task, true)} aria-label="Approve task"><Check size={15} /></button><button className="reject-button" onClick={() => onReview(task, false)} aria-label="Return task"><X size={15} /></button></>}<button className="icon-button task-action" onClick={() => onEditTask(task)} aria-label={`Edit ${task.title}`}><Pencil size={14} /></button><button className="icon-button task-action task-delete" onClick={() => onDeleteTask(task)} aria-label={`Remove ${task.title}`}><Trash2 size={14} /></button></div></td></tr>})}{!filteredTasks.length && <tr><td colSpan="6" className="table-empty">No tasks match these filters.</td></tr>}</tbody></table></div></section></>
}

function Leaderboard({ members, tasks, member }) {
  const finished = tasks.filter((task) => task.status === 'completed').length
  return <><div className="page-heading"><div><span className="eyebrow">A LITTLE FRIENDLY MOMENTUM</span><h1>Leaderboard<span className="heading-period">.</span></h1><p>Good work deserves to be seen.</p></div><span className="period-chip leaderboard-period">ALL TIME <ChevronDown size={13} /></span></div><section className="surface leaderboard-full"><div className="leaderboard-head"><span>RANK / MEMBER</span><span>COMPLETED</span><span>GREEN POINTS</span><span>RED POINTS</span></div>{members.map((person, index) => { const taskCount = tasks.filter((task) => task.assigned_to === person.id && task.status === 'completed').length; return <div className={`leaderboard-row ${index === 0 ? 'leaderboard-first' : ''}`} key={person.id}><span className="rank-number">{String(index + 1).padStart(2, '0')}</span><Avatar member={person} /><div className="leaderboard-name"><strong>{person.name}</strong><span>{person.role === 'leader' ? 'Team leader' : 'Member'}</span></div><span className="leaderboard-completed">{taskCount} <small>tasks</small></span><strong className="leaderboard-green">{person.green_points}<small> GP</small></strong><strong className="leaderboard-red">{person.red_points}<small> RP</small></strong></div>})}<div className="leaderboard-foot"><span>{members.length} teammates</span><span>{finished} completed tasks across the crew</span></div></section><p className="leaderboard-note"><Zap size={14} /> Green points are awarded when a leader approves an on-time submission.</p></>
}

function ActivityPage({ activity, tasks, members, isDemo }) {
  const entries = isDemo ? tasks.slice(0, 5).map((task, index) => ({ id: task.id, description: `${task.status === 'completed' ? 'Completed' : task.status === 'submitted' ? 'Submitted' : task.status === 'overdue' ? 'Marked overdue' : 'Assigned'} “${task.title}”${members.find((person) => person.id === task.assigned_to) ? ` · ${members.find((person) => person.id === task.assigned_to).name}` : ''}.`, created_at: task.completed_at || task.created_at, action: task.status })) : activity
  return <><div className="page-heading"><div><span className="eyebrow">TEAM TIMELINE</span><h1>Activity log<span className="heading-period">.</span></h1><p>A running record of the work getting done.</p></div></div><section className="surface activity-feed"><div className="section-heading"><div><span className="eyebrow">RECENT UPDATES</span><h2>Latest activity <span className="count-badge">{entries.length}</span></h2></div><span className="period-chip">ALL ACTIVITY <Activity size={13} /></span></div>{entries.length ? entries.map((entry) => <div className="feed-item" key={entry.id}><span className={`feed-icon feed-${entry.action}`}><Activity size={15} /></span><div><p>{entry.description}</p><span>{new Date(entry.created_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></div></div>) : <div className="empty-state"><span className="empty-icon"><Activity size={22} /></span><strong>No activity yet</strong><span>Team updates will appear here.</span></div>}</section></>
}

function Modal({ title, eyebrow, onClose, children }) {
  useEffect(() => { const close = (event) => event.key === 'Escape' && onClose(); window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close) }, [onClose])
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header">{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2 id="modal-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close"><X size={17} /></button></div>{children}</section></div>
}

function ModalActions({ onCancel, submit }) {
  return <div className="modal-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button" type="submit">{submit}<ChevronRight size={15} /></button></div>
}

export default App