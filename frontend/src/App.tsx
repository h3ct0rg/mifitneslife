import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Patients from './pages/Patients'
import PatientProfile from './pages/PatientProfile'
import Agenda from './pages/Agenda'
import Diets from './pages/Diets'
import TrainingPlans from './pages/TrainingPlans'
import Settings from './pages/Settings'
import Users from './pages/Users'
import Roles from './pages/Roles'
import WhatsApp from './pages/WhatsApp'
import AdminDashboard from './pages/AdminDashboard'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading">Cargando...</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="pacientes" element={<Patients />} />
          <Route path="pacientes/:id" element={<PatientProfile />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="dietas" element={<Diets />} />
          <Route path="planes-entrenamiento" element={<TrainingPlans />} />
          <Route path="configuracion" element={<Settings />} />
          <Route path="configuracion/usuarios" element={<Users />} />
          <Route path="configuracion/roles" element={<Roles />} />
          <Route path="configuracion/whatsapp" element={<WhatsApp />} />
          <Route path="admin" element={<AdminDashboard />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}