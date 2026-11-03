import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { patientsApi } from './api'
import Layout from './components/Layout'
import ToastProvider from './components/ToastProvider'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Patients from './pages/Patients'
import PatientProfile from './pages/PatientProfile'
import MeasurementHistory from './pages/MeasurementHistory'
import Agenda from './pages/Agenda'
import Citas from './pages/Citas'
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading">Cargando...</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

const isSuperAdmin = (role?: string) => role === 'SuperAdmin'

// Índice: SuperAdmin → dashboard de plataforma; paciente → su perfil; resto → dashboard clínico.
function HomeRoute() {
  const { user } = useAuth()
  if (isSuperAdmin(user?.role)) return <AdminDashboard />
  return <PatientHomeRedirect />
}

// El home del paciente es su perfil.
function PatientHomeRedirect() {
  const { user } = useAuth()
  const [myPatientId, setMyPatientId] = useState<string | null>(null)

  useEffect(() => {
    if (user?.role === 'Patient') {
      patientsApi.me().then((p) => setMyPatientId(p.id)).catch(() => setMyPatientId(null))
    }
  }, [user])

  if (user?.role === 'Patient') {
    if (!myPatientId) return <div className="loading">Cargando perfil...</div>
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
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<HomeRoute />} />
          <Route path="pacientes" element={<StaffOnly><Patients /></StaffOnly>} />
          <Route path="pacientes/:id" element={<ClinicalOnly><PatientProfile /></ClinicalOnly>} />
          <Route path="pacientes/:id/historial" element={<StaffOnly><MeasurementHistory /></StaffOnly>} />
          <Route path="agenda" element={<StaffOnly><Agenda /></StaffOnly>} />
          <Route path="citas" element={<StaffOnly><Citas /></StaffOnly>} />
          <Route path="dieta/catalogo" element={<StaffOnly><FoodCatalog /></StaffOnly>} />
          <Route path="dieta/planes" element={<StaffOnly><DietPlans /></StaffOnly>} />
          <Route path="entrenamiento/ejercicios" element={<StaffOnly><Exercises /></StaffOnly>} />
          <Route path="entrenamiento/planes" element={<StaffOnly><WorkoutPlans /></StaffOnly>} />
          <Route path="configuracion" element={<StaffOnly><Settings /></StaffOnly>} />
          <Route path="configuracion/usuarios" element={<StaffOnly><Users /></StaffOnly>} />
          <Route path="configuracion/whatsapp" element={<StaffOnly><WhatsApp /></StaffOnly>} />
          <Route path="admin" element={<Navigate to="/" replace />} />
          <Route path="admin/tenants" element={<SuperAdminOnly><AdminTenants /></SuperAdminOnly>} />
          <Route path="admin/usuarios" element={<SuperAdminOnly><AdminUsers /></SuperAdminOnly>} />
          <Route path="admin/*" element={<Navigate to="/" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}