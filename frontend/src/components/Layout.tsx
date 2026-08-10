import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { roleLabel } from '../api/types'
import { patientsApi } from '../api'

const MAIN_NAV = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/pacientes', label: 'Pacientes', icon: 'group' },
  { to: '/agenda', label: 'Agenda', icon: 'calendar_month' },
  { to: '/citas', label: 'Citas', icon: 'event_available' },
]

const TRAINING_NAV = [
  { to: '/entrenamiento/ejercicios', label: 'Ejercicios', icon: 'sports_gymnastics' },
  { to: '/entrenamiento/planes', label: 'Planes de entrenamiento', icon: 'article' },
]

const DIET_NAV = [
  { to: '/dieta/catalogo', label: 'Catálogo alimenticio', icon: 'restaurant_menu' },
  { to: '/dieta/planes', label: 'Planes de dieta', icon: 'assignment' },
]

const CONFIG_NAV = [
  { to: '/configuracion', label: 'Apariencia', icon: 'palette' },
  { to: '/configuracion/usuarios', label: 'Usuarios', icon: 'manage_accounts' },
  { to: '/configuracion/whatsapp', label: 'WhatsApp', icon: 'chat' },
]

const SUPER_ADMIN_NAV = [{ to: '/admin', label: 'Super Admin', icon: 'admin_panel_settings' }]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [configOpen, setConfigOpen] = useState(false)
  const [dietOpen, setDietOpen] = useState(false)
  const [trainingOpen, setTrainingOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [myPatientId, setMyPatientId] = useState<string | null>(null)

  const isPatient = user?.role === 'Patient'

  useEffect(() => {
    if (isPatient) {
      patientsApi
        .me()
        .then((p) => setMyPatientId(p.id))
        .catch(() => setMyPatientId(null))
    }
  }, [isPatient])

  if (!user) return null

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const myProfileTo = myPatientId ? `/pacientes/${myPatientId}` : '/'

  const closeMobile = () => setMobileOpen(false)

  return (
    <div className="app-shell">
      {mobileOpen && <div className="mobile-overlay" onClick={closeMobile} />}

      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-dot" />
          <span>MyFitnessLife</span>
        </div>

        <nav className="sidebar-nav">
          {isPatient ? (
            <NavLink
              to={myProfileTo}
              onClick={closeMobile}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <div className="nav-link-content">
                <span className="material-symbols-outlined">person</span>
                <span>Mi perfil</span>
              </div>
            </NavLink>
          ) : (
            <>
              {MAIN_NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={closeMobile}
                  className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                >
                  <div className="nav-link-content">
                    <span className="material-symbols-outlined">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                </NavLink>
              ))}

              <div className="nav-group">
                <button
                  type="button"
                  className={`nav-link nav-sub-toggle ${trainingOpen ? 'open' : ''}`}
                  onClick={() => setTrainingOpen((o) => !o)}
                >
                  <div className="nav-link-content">
                    <span className="material-symbols-outlined">fitness_center</span>
                    <span>Entrenamiento</span>
                  </div>
                  <span className="nav-chevron">▾</span>
                </button>
                {trainingOpen && (
                  <div className="nav-submenu">
                    {TRAINING_NAV.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={closeMobile}
                        className={({ isActive }) =>
                          isActive ? 'nav-link sub active' : 'nav-link sub'
                        }
                      >
                        <div className="nav-link-content">
                          <span className="material-symbols-outlined">{item.icon}</span>
                          <span>{item.label}</span>
                        </div>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>

              <div className="nav-group">
                <button
                  type="button"
                  className={`nav-link nav-sub-toggle ${dietOpen ? 'open' : ''}`}
                  onClick={() => setDietOpen((o) => !o)}
                >
                  <div className="nav-link-content">
                    <span className="material-symbols-outlined">restaurant</span>
                    <span>Dieta</span>
                  </div>
                  <span className="nav-chevron">▾</span>
                </button>
                {dietOpen && (
                  <div className="nav-submenu">
                    {DIET_NAV.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={closeMobile}
                        className={({ isActive }) =>
                          isActive ? 'nav-link sub active' : 'nav-link sub'
                        }
                      >
                        <div className="nav-link-content">
                          <span className="material-symbols-outlined">{item.icon}</span>
                          <span>{item.label}</span>
                        </div>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>

              <div className="nav-group">
                <button
                  type="button"
                  className={`nav-link nav-sub-toggle ${configOpen ? 'open' : ''}`}
                  onClick={() => setConfigOpen((o) => !o)}
                >
                  <div className="nav-link-content">
                    <span className="material-symbols-outlined">settings</span>
                    <span>Configuración</span>
                  </div>
                  <span className="nav-chevron">▾</span>
                </button>
                {configOpen && (
                  <div className="nav-submenu">
                    {CONFIG_NAV.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/configuracion'}
                        onClick={closeMobile}
                        className={({ isActive }) =>
                          isActive ? 'nav-link sub active' : 'nav-link sub'
                        }
                      >
                        <div className="nav-link-content">
                          <span className="material-symbols-outlined">{item.icon}</span>
                          <span>{item.label}</span>
                        </div>
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
                      onClick={closeMobile}
                      className={({ isActive }) =>
                        isActive ? 'nav-link active' : 'nav-link'
                      }
                    >
                      <div className="nav-link-content">
                        <span className="material-symbols-outlined">{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                    </NavLink>
                  ))}
                </div>
              )}
            </>
          )}
        </nav>
      </aside>

      <div className="app-main">
        <header className="app-header">
          <div className="header-title">
            <button
              type="button"
              className="mobile-toggle"
              onClick={() => setMobileOpen((o) => !o)}
              title="Abrir menú"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <NavLink to="/" className="header-link">
              <h1>MyFitnessLife</h1>
            </NavLink>
            <span className="badge">{roleLabel(user.role)}</span>
          </div>
          <div className="header-user">
            <span className="header-name">
              {user.fullName} ({user.email})
            </span>
            <button className="btn-ghost" onClick={handleLogout}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
              <span>Cerrar sesión</span>
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