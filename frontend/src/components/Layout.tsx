import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const MAIN_NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/pacientes', label: 'Pacientes' },
  { to: '/agenda', label: 'Agenda' },
  { to: '/citas', label: 'Citas' },
  { to: '/dietas', label: 'Dietas' },
  { to: '/planes-entrenamiento', label: 'Planes de entrenamiento' },
]

const CONFIG_NAV = [
  { to: '/configuracion/usuarios', label: 'Usuarios' },
  { to: '/configuracion/roles', label: 'Roles' },
  { to: '/configuracion/whatsapp', label: 'WhatsApp' },
]

const SUPER_ADMIN_NAV = [{ to: '/admin', label: 'Super Admin' }]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [configOpen, setConfigOpen] = useState(false)

  if (!user) return null

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-dot" />
          MyFitnessLife
        </div>

        <nav className="sidebar-nav">
          {MAIN_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}

          <div className="nav-group">
            <button
              type="button"
              className={`nav-link nav-sub-toggle ${configOpen ? 'open' : ''}`}
              onClick={() => setConfigOpen((o) => !o)}
            >
              Configuración
              <span className="nav-chevron">▾</span>
            </button>
            {configOpen && (
              <div className="nav-submenu">
                {CONFIG_NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      isActive ? 'nav-link sub active' : 'nav-link sub'
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          {user.role === 'SuperAdmin' && (
            <div className="nav-segment">
              {SUPER_ADMIN_NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    isActive ? 'nav-link active' : 'nav-link'
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}
        </nav>
      </aside>

      <div className="app-main">
        <header className="app-header">
          <div className="header-title">
            <NavLink to="/" className="header-link">
              <h1>MyFitnessLife</h1>
            </NavLink>
            <span className="badge">{user.role}</span>
          </div>
          <div className="header-user">
            <span className="header-name">
              {user.fullName} ({user.email})
            </span>
            <button className="btn-ghost" onClick={handleLogout}>
              Cerrar sesión
            </button>
          </div>
        </header>

        <main className="app-content">
          <Outlet />
        </main>

        <footer className="app-footer">
          © {new Date().getFullYear()} MyFitnessLife · Plataforma de Fitness & Nutrición
        </footer>
      </div>
    </div>
  )
}