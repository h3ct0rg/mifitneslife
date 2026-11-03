import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import ProfileSwitcher from './ProfileSwitcher'
import BottomNav, { type BottomNavItem } from './BottomNav'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { roleLabel, type UserDto } from '../api/types'
import { patientsApi } from '../api'
import { membershipTenant } from './membershipUtils'

/** Contexto que Layout pasa a las rutas hijas. `undefined` = cargando, `null` = sin ficha. */
export type ShellOutletContext = { myPatientId: string | null | undefined }

interface NavItem {
  to: string
  label: string
  icon: string
  end?: boolean
}

interface NavSection {
  title?: string
  items: NavItem[]
}

const HOME_ITEM: NavItem = { to: '/', label: 'Inicio', icon: 'home', end: true }
const PATIENTS_ITEM: NavItem = { to: '/pacientes', label: 'Pacientes', icon: 'group' }
const AGENDA_ITEM: NavItem = { to: '/agenda', label: 'Agenda', icon: 'calendar_month' }

const DIET_NAV: NavItem[] = [
  { to: '/dieta/catalogo', label: 'Catálogo alimenticio', icon: 'restaurant_menu' },
  { to: '/dieta/planes', label: 'Planes de dieta', icon: 'assignment' },
]

const TRAINING_NAV: NavItem[] = [
  { to: '/entrenamiento/ejercicios', label: 'Ejercicios', icon: 'sports_gymnastics' },
  { to: '/entrenamiento/planes', label: 'Planes de entrenamiento', icon: 'article' },
]

const CONFIG_ITEM: NavItem = { to: '/configuracion', label: 'Configuración', icon: 'settings', end: true }
const USERS_ITEM: NavItem = { to: '/configuracion/usuarios', label: 'Usuarios', icon: 'manage_accounts' }

// Plataforma (solo SuperAdmin; no ve la UI clínica).
const SUPER_ADMIN_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'monitoring', end: true },
  { to: '/admin/tenants', label: 'Tenants', icon: 'domain' },
  { to: '/admin/usuarios', label: 'Usuarios', icon: 'manage_accounts' },
]

// Claves `?tab=` de PatientProfile; en móvil el paciente navega su ficha con la bottom-nav.
const PATIENT_TABS = [
  { key: 'evolucion', label: 'Progreso', icon: 'monitoring' },
  { key: 'dieta', label: 'Dieta', icon: 'restaurant_menu' },
  { key: 'entrenamiento', label: 'Entreno', icon: 'fitness_center' },
  { key: 'fotos', label: 'Fotos', icon: 'photo_library' },
  { key: 'info', label: 'Perfil', icon: 'person' },
] as const

const PATIENT_DEFAULT_TAB = 'evolucion'

const ROUTE_TITLES: [RegExp, string][] = [
  [/^\/pacientes\/[^/]+\/historial$/, 'Historial de mediciones'],
  [/^\/pacientes\/[^/]+$/, 'Ficha del paciente'],
  [/^\/pacientes$/, 'Pacientes'],
  [/^\/agenda$/, 'Agenda'],
  [/^\/dieta\/catalogo$/, 'Catálogo alimenticio'],
  [/^\/dieta\/planes$/, 'Planes de dieta'],
  [/^\/entrenamiento\/ejercicios$/, 'Ejercicios'],
  [/^\/entrenamiento\/planes$/, 'Planes de entrenamiento'],
  [/^\/configuracion$/, 'Configuración'],
  [/^\/configuracion\/usuarios$/, 'Usuarios'],
  [/^\/configuracion\/whatsapp$/, 'WhatsApp'],
  [/^\/admin\/tenants$/, 'Tenants'],
  [/^\/admin\/usuarios$/, 'Usuarios'],
]

function initialsOf(user: UserDto): string {
  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
  return initials || (user.fullName?.[0] ?? '?').toUpperCase()
}

/** Selector de tema (override de acento, U2). Botones con aria-pressed. */
function AppearancePicker() {
  const labelId = useId()
  const { theme, setTheme, themes } = useTheme()
  return (
    <div className="menu-section">
      <span className="menu-section-label" id={labelId}>
        Apariencia
      </span>
      <div className="appearance-picker" role="group" aria-labelledby={labelId}>
        {themes.map((t) => {
          const selected = t.id === theme
          return (
            <button
              key={t.id}
              type="button"
              className="menu-action appearance-option"
              aria-pressed={selected}
              onClick={() => setTheme(t.id)}
            >
              {/* data-theme: la muestra toma el primario/acento de ese tema. */}
              <span className="appearance-swatch" data-theme={t.id} aria-hidden="true" />
              <span className="menu-action-label">{t.label}</span>
              {selected && (
                <span className="material-symbols-outlined menu-action-end" aria-hidden="true">
                  check
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function AccountSummary({ user }: { user: UserDto }) {
  return (
    <div className="account-summary">
      <span className="user-avatar user-avatar--lg" aria-hidden="true">
        {initialsOf(user)}
      </span>
      <div className="account-summary-text">
        <strong>{user.fullName}</strong>
        <span>{roleLabel(user.role)}</span>
        <span className="account-summary-email">{user.email}</span>
      </div>
    </div>
  )
}

function LogoutButton({ onLogout }: { onLogout: () => void }) {
  return (
    <button type="button" className="menu-action" onClick={onLogout}>
      <span className="material-symbols-outlined" aria-hidden="true">
        logout
      </span>
      <span className="menu-action-label">Cerrar sesión</span>
    </button>
  )
}

/** Menú de usuario de la cabecera: avatar → nombre, rol, Apariencia, Cerrar sesión. */
function UserMenu({ user, onLogout }: { user: UserDto; onLogout: () => void }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="user-menu-btn"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`Cuenta de ${user.fullName}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="user-avatar" aria-hidden="true">
          {initialsOf(user)}
        </span>
      </button>
      {open && (
        <div id={panelId} className="user-menu-panel">
          <AccountSummary user={user} />
          <AppearancePicker />
          <hr className="menu-divider" />
          <LogoutButton onLogout={onLogout} />
        </div>
      )}
    </div>
  )
}

function SheetLinks({ title, items, onNavigate }: { title?: string; items: NavItem[]; onNavigate: () => void }) {
  return (
    <div className="menu-section">
      {title && <span className="menu-section-label">{title}</span>}
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className="sheet-link" onClick={onNavigate}>
          <span className="material-symbols-outlined sheet-link-icon" aria-hidden="true">
            {item.icon}
          </span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </div>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const [railExpanded, setRailExpanded] = useState(false)
  // Se guarda con la membresía para no usar el id de otro tenant tras cambiar de perfil.
  const [myPatient, setMyPatient] = useState<{ membershipId: string; id: string | null } | null>(null)

  const isPatient = user?.role === 'Patient'
  const isSuperAdmin = user?.role === 'SuperAdmin'
  const isAdmin = user?.role === 'Admin'
  // Clave de la membresía actual; '' si el UserDto no trae membershipId (el me() se pide igual).
  const membershipId = user?.membershipId ?? ''

  // Única llamada a patients.me(); HomeRoute la consume vía Outlet context.
  useEffect(() => {
    if (!isPatient) return
    let cancelled = false
    patientsApi
      .me()
      .then((p) => {
        if (!cancelled) setMyPatient({ membershipId, id: p.id })
      })
      .catch(() => {
        if (!cancelled) setMyPatient({ membershipId, id: null })
      })
    return () => {
      cancelled = true
    }
  }, [isPatient, membershipId])

  if (!user) return null

  const myPatientId: string | null | undefined = !isPatient
    ? null
    : myPatient && myPatient.membershipId === membershipId
      ? myPatient.id
      : undefined

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const sections: NavSection[] = isSuperAdmin
    ? [{ items: SUPER_ADMIN_NAV }]
    : [
        { title: 'Clínica', items: [HOME_ITEM, PATIENTS_ITEM, AGENDA_ITEM] },
        { title: 'Dieta', items: DIET_NAV },
        { title: 'Entrenamiento', items: TRAINING_NAV },
        { title: 'Centro', items: isAdmin ? [CONFIG_ITEM, USERS_ITEM] : [CONFIG_ITEM] },
      ]

  // Pestaña activa del paciente (misma regla que PatientProfile: clave inválida → evolución).
  const ownProfilePath = myPatientId ? `/pacientes/${myPatientId}` : null
  const rawTab = searchParams.get('tab')
  const currentTab = PATIENT_TABS.find((t) => t.key === rawTab)?.key ?? PATIENT_DEFAULT_TAB
  const onOwnProfile = ownProfilePath !== null && pathname === ownProfilePath

  let pageTitle = ROUTE_TITLES.find(([re]) => re.test(pathname))?.[1] ?? ''
  if (isPatient) {
    pageTitle = onOwnProfile
      ? (PATIENT_TABS.find((t) => t.key === currentTab)?.label ?? 'Mi perfil')
      : 'Mi perfil'
  } else if (pathname === '/') {
    pageTitle = isSuperAdmin ? 'Dashboard' : 'Inicio'
  }

  let bottomItems: BottomNavItem[]
  if (isPatient) {
    bottomItems = PATIENT_TABS.map((t) => ({
      kind: 'link' as const,
      key: t.key,
      to: ownProfilePath ? `${ownProfilePath}?tab=${t.key}` : '/',
      label: t.label,
      icon: t.icon,
      active: onOwnProfile && currentTab === t.key,
    }))
  } else if (isSuperAdmin) {
    bottomItems = [
      { kind: 'link', key: 'home', to: '/', end: true, label: 'Inicio', icon: 'monitoring' },
      { kind: 'link', key: 'tenants', to: '/admin/tenants', label: 'Tenants', icon: 'domain' },
      { kind: 'link', key: 'users', to: '/admin/usuarios', label: 'Usuarios', icon: 'manage_accounts' },
      {
        kind: 'sheet',
        key: 'account',
        label: 'Cuenta',
        icon: 'account_circle',
        title: 'Cuenta',
        render: () => (
          <>
            <AccountSummary user={user} />
            <AppearancePicker />
            <hr className="menu-divider" />
            <LogoutButton onLogout={handleLogout} />
          </>
        ),
      },
    ]
  } else {
    bottomItems = [
      { kind: 'link', key: 'home', ...HOME_ITEM },
      { kind: 'link', key: 'patients', ...PATIENTS_ITEM },
      { kind: 'link', key: 'agenda', ...AGENDA_ITEM },
      {
        kind: 'sheet',
        key: 'plans',
        label: 'Planes',
        icon: 'assignment',
        title: 'Planes',
        active: pathname.startsWith('/dieta') || pathname.startsWith('/entrenamiento'),
        render: (close) => (
          <>
            <SheetLinks title="Dieta" items={DIET_NAV} onNavigate={close} />
            <SheetLinks title="Entrenamiento" items={TRAINING_NAV} onNavigate={close} />
          </>
        ),
      },
      {
        kind: 'sheet',
        key: 'more',
        label: 'Más',
        icon: 'more_horiz',
        title: 'Más',
        active: pathname.startsWith('/configuracion'),
        render: (close) => (
          <>
            <SheetLinks items={isAdmin ? [CONFIG_ITEM, USERS_ITEM] : [CONFIG_ITEM]} onNavigate={close} />
            <AppearancePicker />
            <hr className="menu-divider" />
            <LogoutButton onLogout={handleLogout} />
          </>
        ),
      },
    ]
  }

  const outletContext: ShellOutletContext = { myPatientId }
  const currentMembership = user.memberships?.find((m) => m.id === user.membershipId)

  return (
    <div className={`app-shell${isPatient ? ' app-shell--patient' : ''}`}>
      {!isPatient && (
        <aside
          id="app-sidebar"
          className={`sidebar${railExpanded ? ' is-expanded' : ''}`}
          aria-label="Menú lateral"
        >
          <div className="sidebar-brand">
            <span className="brand-mark" aria-hidden="true">
              <span className="material-symbols-outlined is-filled">favorite</span>
            </span>
            <span className="sidebar-brand-name">MyFitnessLife</span>
          </div>
          <nav className="sidebar-nav" aria-label="Navegación principal">
            {sections.map((section, i) => {
              const titleId = section.title ? `nav-section-${i}` : undefined
              return (
                <div key={section.title ?? i} className="nav-section" role="group" aria-labelledby={titleId}>
                  {section.title && (
                    <span className="nav-section-title" id={titleId}>
                      {section.title}
                    </span>
                  )}
                  {section.items.map((item) => (
                    <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">
                      <span className="material-symbols-outlined nav-icon" aria-hidden="true">
                        {item.icon}
                      </span>
                      <span className="nav-label">{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              )
            })}
          </nav>
          {/* Tarjeta de contexto (centro + rol actual), solo presentacional. */}
          <div className="sidebar-card">
            <strong>{currentMembership ? membershipTenant(currentMembership) : 'MyFitnessLife'}</strong>
            <span>{roleLabel(user.role)}</span>
          </div>
        </aside>
      )}

      <div className="app-main">
        <header className="app-header">
          <div className="header-start">
            {!isPatient && (
              <button
                type="button"
                className="header-icon-btn rail-toggle"
                aria-controls="app-sidebar"
                aria-expanded={railExpanded}
                aria-label={railExpanded ? 'Contraer menú' : 'Expandir menú'}
                onClick={() => setRailExpanded((o) => !o)}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  {railExpanded ? 'menu_open' : 'menu'}
                </span>
              </button>
            )}
            <span className="header-page-title">{pageTitle}</span>
          </div>
          <div className="header-end">
            <ProfileSwitcher />
            <UserMenu user={user} onLogout={handleLogout} />
          </div>
        </header>

        <main className="app-content">
          {/* key: al cambiar de membresía se remonta la página para no mostrar datos de otro tenant/rol. */}
          <Fragment key={user.membershipId ?? 'default'}>
            <Outlet context={outletContext} />
          </Fragment>
        </main>
      </div>

      <BottomNav items={bottomItems} label={isPatient ? 'Secciones de mi perfil' : 'Navegación principal'} />
    </div>
  )
}
