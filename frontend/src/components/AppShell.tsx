import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Activity, FileText, History, LayoutDashboard, LogOut, Map, Radio, ScanLine, Settings } from 'lucide-react'
import { Logo, LogoMark } from './Logo'
import { useAuth } from '../context/AuthContext'
import { useHealth } from '../hooks'

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/analysis', label: 'Sonar Analysis', icon: ScanLine },
  { to: '/live', label: 'Live Detection', icon: Radio },
  { to: '/map', label: 'Anomaly Map', icon: Map },
  { to: '/history', label: 'Detection History', icon: History },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/health', label: 'System Health', icon: Activity },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function ModeIndicator() {
  const { health, error, loading } = useHealth()
  if (loading) return <div className="skeleton h-7 w-28" />
  if (error || !health) {
    return <span className="chip border-coral/50 bg-coral/10 text-coral" title={error ?? ''}><span className="h-1.5 w-1.5 rounded-full bg-coral" />BACKEND OFFLINE</span>
  }
  const demo = health.mode === 'DEMO'
  const c = demo ? '#f2b84b' : '#34d8a0'
  return (
    <span className="chip" style={{ color: c, borderColor: `${c}66`, background: `${c}14` }}
      title={demo ? 'Demo mode: classical computer vision, no trained model, synthetic/demo data' : 'Live mode: trained model loaded'}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {demo ? 'DEMO MODE' : 'LIVE MODE'}
    </span>
  )
}

export default function AppShell() {
  const { user, signOut } = useAuth()
  const loc = useLocation()
  const current = NAV.find(n => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to)))
  return (
    <div className="flex h-full">
      <aside className="no-print flex w-16 shrink-0 flex-col border-r border-line bg-trench lg:w-[236px]">
        <div className="flex h-14 items-center border-b border-line px-3.5 lg:px-4">
          <span className="lg:hidden"><LogoMark /></span>
          <span className="hidden lg:block"><Logo /></span>
        </div>
        <nav className="flex-1 space-y-0.5 p-2" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} title={label}
              className={({ isActive }) => `group flex h-10 items-center gap-3 rounded border-l-2 px-3 text-[13px] transition-colors ${isActive ? 'border-sonar bg-shelf text-mist' : 'border-transparent text-haze hover:bg-shelf/60 hover:text-mist'}`}>
              <Icon size={17} className="shrink-0" />
              <span className="hidden lg:inline">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line p-2">
          <button onClick={signOut} title="Sign out" className="flex h-10 w-full items-center gap-3 rounded px-3 text-[13px] text-haze hover:bg-shelf/60 hover:text-mist">
            <LogOut size={17} className="shrink-0" /><span className="hidden lg:inline">Sign out</span>
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex h-14 shrink-0 items-center justify-between border-b border-line bg-trench/70 px-5 backdrop-blur">
          <div className="text-[13px] text-haze">{current?.label ?? 'NEREUS'}</div>
          <div className="flex items-center gap-3">
            <ModeIndicator />
            <span className="hidden text-[12px] text-haze md:inline">{user}</span>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-5"><Outlet /></main>
      </div>
    </div>
  )
}
