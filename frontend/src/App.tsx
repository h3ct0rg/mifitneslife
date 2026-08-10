import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { patientsApi } from './api'
import Layout from './components/Layout'
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading">Cargando...</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
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

// Rutas solo para personal (no pacientes).
function StaffOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (user?.role === 'Patient') return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
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
          <Route index element={<PatientHomeRedirect />} />
          <Route path="pacientes" element={<StaffOnly><Patients /></StaffOnly>} />
          <Route path="pacientes/:id" element={<PatientProfile />} />
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
          <Route path="admin" element={<StaffOnly><AdminDashboard /></StaffOnly>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}