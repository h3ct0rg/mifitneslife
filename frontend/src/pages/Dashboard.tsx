import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <div className="page">
      <div className="welcome banner">
        <h2>Bienvenido, {user.fullName}</h2>
        <p>Resumen de actividad de tu tenant.</p>
      </div>

      <section className="stats">
        <div className="stat-card">
          <strong>0</strong>
          <span>Pacientes</span>
        </div>
        <div className="stat-card">
          <strong>0</strong>
          <span>Dietas activas</span>
        </div>
        <div className="stat-card">
          <strong>0</strong>
          <span>Planes de entrenamiento</span>
        </div>
        <div className="stat-card">
          <strong>0</strong>
          <span>Próximas citas</span>
        </div>
      </section>

      <section className="card">
        <h2>Accesos rápidos</h2>
        <p>
          Usa el menú lateral para navegar entre pacientes, agenda, dietas, planes de
          entrenamiento y configuración.
        </p>
      </section>
    </div>
  )
}