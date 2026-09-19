import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useSettings } from '@/context/SettingsContext'

const NAV = [
  { to: '/', icon: 'speedometer2', label: 'Dashboard', end: true },
  { to: '/finance', icon: 'wallet2', label: 'Finanzas' },
  { to: '/portfolios', icon: 'briefcase', label: 'Portafolios' },
  { to: '/investments', icon: 'arrow-left-right', label: 'Inversiones' },
  { to: '/brokers', icon: 'building', label: 'Brokers' },
  { to: '/market', icon: 'graph-up', label: 'Mercado' },
  { to: '/analysis', icon: 'clipboard-data', label: 'Análisis' },
  { to: '/recommend', icon: 'stars', label: 'Recomendación' },
  { to: '/backtesting', icon: 'clock-history', label: 'Backtesting' },
  { to: '/settings', icon: 'gear', label: 'Configuración' },
]

export default function AppLayout() {
  const { user, signOut } = useAuth()
  const { aiEnabled } = useSettings()
  const [open, setOpen] = useState(false)
  const nav = useNavigate()

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <i className="bi bi-bar-chart-line-fill me-2" /> <span>Investment IQ</span>
        </div>
        <nav className="nav flex-column">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setOpen(false)}>
              <i className={`bi bi-${n.icon}`} /> <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer small">
          <span className={`badge ${aiEnabled ? 'text-bg-success' : 'text-bg-secondary'}`}>IA {aiEnabled ? 'ON' : 'OFF'}</span>
        </div>
      </aside>
      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <button className="btn btn-light d-lg-none" onClick={() => setOpen(true)}><i className="bi bi-list" /></button>
          <div className="flex-grow-1" />
          <div className="dropdown">
            <button className="btn btn-light dropdown-toggle d-flex align-items-center gap-2" data-bs-toggle="dropdown">
              <i className="bi bi-person-circle" /> <span className="d-none d-md-inline small">{user?.email}</span>
            </button>
            <ul className="dropdown-menu dropdown-menu-end">
              <li><button className="dropdown-item" onClick={() => nav('/settings')}><i className="bi bi-gear me-2" />Configuración</button></li>
              <li><hr className="dropdown-divider" /></li>
              <li><button className="dropdown-item text-danger" onClick={() => signOut()}><i className="bi bi-box-arrow-right me-2" />Cerrar sesión</button></li>
            </ul>
          </div>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  )
}
