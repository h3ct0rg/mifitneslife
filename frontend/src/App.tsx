import { BrowserRouter, Navigate, Route, Routes, useLocation, useOutletContext } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout, { type ShellOutletContext } from './components/Layout'
import ToastProvider from './components/ToastProvider'
import StateView from './components/ui/StateView'
import Login from './pages/Login'
import Register from './pages/Register'
import CreateAccount from './pages/CreateAccount'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Patients from './pages/Patients'
import PatientProfile from './pages/PatientProfile'
import MeasurementHistory from './pages/MeasurementHistory'
import Agenda from './pages/Agenda'
import FoodCatalog from './pages/FoodCatalog'
import DietPlans from './pages/DietPlans'
import Exercises from './pages/Exercises'
import WorkoutPlans from './pages/WorkoutPlans'
import Settings from './pages/Settings'
import Users from './pages/Users'
import WhatsApp from './pages/WhatsApp'
import AdminDashboard from './pages/AdminDashboard'
import AdminTenants from './pages/AdminTenants'
import AdminUsers from './pages/AdminUsers'
import AdminPlans from './pages/AdminPlans'
import AdminConnections from './pages/AdminConnections'

function hasStoredToken(): boolean {
  try {
    return !!localStorage.getItem('access_token')
  } catch {
    return false
  }
}

/**
 * Raíz de la app (AC-1): sin sesión, `/` es la landing pública y cualquier ruta interna va a /login con `next`;
 * con sesión, el shell (Layout) con el comportamiento de siempre.
 */
function RootGate() {
  const { user, loading } = useAuth()
  const { pathname, search, hash } = useLocation()
  // Con token guardado se espera a `me` (evita mostrar la landing un instante a quien ya tiene sesión).
  if (loading && hasStoredToken()) return <div className="loading">Cargando...</div>
  if (!user) {
    if (pathname === '/') return <Landing />
    return <Navigate to={`/login?next=${encodeURIComponent(pathname + search + hash)}`} replace />
  }
  return <Layout />
}

const isSuperAdmin = (role?: string) => role === 'SuperAdmin'

// Índice: SuperAdmin → dashboard de plataforma; paciente → su perfil; resto → dashboard clínico.
function HomeRoute() {
  const { user } = useAuth()
  if (isSuperAdmin(user?.role)) return <AdminDashboard />
  return <PatientHomeRedirect />
}

// El home del paciente es su perfil. El id lo resuelve Layout (única llamada a patients.me()).
function PatientHomeRedirect() {
  const { user } = useAuth()
  const { myPatientId } = useOutletContext<ShellOutletContext>()

  if (user?.role === 'Patient') {
    if (myPatientId === null)
      return (
        <StateView
          state="error"
          title="No se pudo cargar tu perfil"
          message="Tu cuenta no tiene una ficha de paciente asociada en este centro o hubo un error de conexión."
          action={
            <button type="button" className="btn btn--ghost" onClick={() => window.location.reload()}>
              Reintentar
            </button>
          }
        />
      )
    if (!myPatientId) return <StateView state="loading" title="Cargando perfil..." />
    return <Navigate to={`/pacientes/${myPatientId}`} replace />
  }
  return <Dashboard />
}

// Rutas clínicas: el SuperAdmin no opera la UI clínica.
function ClinicalOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (isSuperAdmin(user?.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

// Rutas solo para personal clínico (no pacientes ni SuperAdmin).
function StaffOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (user?.role === 'Patient' || isSuperAdmin(user?.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

// Rutas de administración del centro: solo Admin.
function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (user?.role !== 'Admin') return <Navigate to="/" replace />
  return <>{children}</>
}

// Rutas de plataforma: solo SuperAdmin.
function SuperAdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!isSuperAdmin(user?.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Register />} />
        <Route path="/crear-cuenta" element={<CreateAccount />} />
        <Route path="/" element={<RootGate />}>
          <Route index element={<HomeRoute />} />
          <Route path="pacientes" element={<StaffOnly><Patients /></StaffOnly>} />
          <Route path="pacientes/:id" element={<ClinicalOnly><PatientProfile /></ClinicalOnly>} />
          <Route path="pacientes/:id/historial" element={<StaffOnly><MeasurementHistory /></StaffOnly>} />
          <Route path="agenda" element={<StaffOnly><Agenda /></StaffOnly>} />
          {/* U3: Citas se fusiona en Agenda. */}
          <Route path="citas" element={<Navigate to="/agenda" replace />} />
          <Route path="dieta/catalogo" element={<StaffOnly><FoodCatalog /></StaffOnly>} />
          <Route path="dieta/planes" element={<StaffOnly><DietPlans /></StaffOnly>} />
          <Route path="entrenamiento/ejercicios" element={<StaffOnly><Exercises /></StaffOnly>} />
          <Route path="entrenamiento/planes" element={<StaffOnly><WorkoutPlans /></StaffOnly>} />
          <Route path="configuracion" element={<StaffOnly><Settings /></StaffOnly>} />
          <Route path="configuracion/usuarios" element={<AdminOnly><Users /></AdminOnly>} />
          <Route path="configuracion/whatsapp" element={<StaffOnly><WhatsApp /></StaffOnly>} />
          <Route path="admin" element={<Navigate to="/" replace />} />
          <Route path="admin/tenants" element={<SuperAdminOnly><AdminTenants /></SuperAdminOnly>} />
          <Route path="admin/usuarios" element={<SuperAdminOnly><AdminUsers /></SuperAdminOnly>} />
          <Route path="admin/planes" element={<SuperAdminOnly><AdminPlans /></SuperAdminOnly>} />
          <Route path="admin/conexiones" element={<SuperAdminOnly><AdminConnections /></SuperAdminOnly>} />
          <Route path="admin/*" element={<Navigate to="/" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}