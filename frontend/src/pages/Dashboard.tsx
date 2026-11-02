import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { patientsApi, dietsApi, workoutPlansApi } from '../api'
import TrendChart from '../components/TrendChart'

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    patientsCount: 0,
    dietsCount: 0,
    workoutsCount: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [pRes, dRes, wRes] = await Promise.allSettled([
          patientsApi.list({ pageSize: 1 }),
          dietsApi.list(),
          workoutPlansApi.list(),
        ])

        setStats({
          patientsCount: pRes.status === 'fulfilled' ? pRes.value.total : 0,
          dietsCount: dRes.status === 'fulfilled' ? dRes.value.length : 0,
          workoutsCount: wRes.status === 'fulfilled' ? wRes.value.length : 0,
        })
      } catch {
        // Fallback
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  if (!user) return null

  // Sample trend data for visual richness
  const sampleTrend = [
    { date: '2026-08-01', value: 12 },
    { date: '2026-08-03', value: 18 },
    { date: '2026-08-05', value: 15 },
    { date: '2026-08-07', value: 24 },
    { date: '2026-08-09', value: 22 },
    { date: '2026-08-10', value: 31 },
  ]

  return (
    <div className="page">
      {/* Banner de Bienvenida */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, var(--glass-level-2) 0%, var(--primary-light) 100%)',
          borderLeft: '5px solid var(--primary)',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.35rem 0', fontSize: '1.4rem', fontWeight: 700 }}>
              Bienvenido de nuevo, {user.fullName}
            </h2>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.925rem' }}>
              Resumen ejecutivo y actividad reciente de tu plataforma de nutrición & fitness.
            </p>
          </div>
          <Link to="/pacientes" className="btn-primary" style={{ width: 'auto' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>person_add</span>
            Gestionar Pacientes
          </Link>
        </div>
      </div>

      {/* Tarjetas de Estadísticas */}
      <section className="stats" style={{ marginBottom: '1.75rem' }}>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '1.5rem' }}>group</span>
            <strong>{loading ? '...' : stats.patientsCount}</strong>
          </div>
          <span>Pacientes Registrados</span>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--secondary)', fontSize: '1.5rem' }}>restaurant_menu</span>
            <strong>{loading ? '...' : stats.dietsCount}</strong>
          </div>
          <span>Planes de Dieta</span>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--accent)', fontSize: '1.5rem' }}>fitness_center</span>
            <strong>{loading ? '...' : stats.workoutsCount}</strong>
          </div>
          <span>Planes de Entrenamiento</span>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--success)', fontSize: '1.5rem' }}>event_available</span>
            <strong>3</strong>
          </div>
          <span>Próximas Citas</span>
        </div>
      </section>

      {/* Gráfico de Tendencia de Actividad */}
      <section className="card" style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Tendencia de Consultas y Seguimientos</h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Evolución mensual de pacientes activos</span>
          </div>
          <span className="theme-badge">
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>trending_up</span>
            +18% este mes
          </span>
        </div>

        <TrendChart data={sampleTrend} color="var(--primary)" height={160} />
      </section>

      {/* Accesos Rápides */}
      <section className="card">
        <h2 style={{ marginBottom: '1rem' }}>Accesos Rápida & Acciones Directas</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <Link
            to="/pacientes"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--glass-level-2)',
              border: '1px solid var(--border)',
              textDecoration: 'none',
              color: 'var(--text)',
              fontWeight: 600,
              transition: 'all 0.2s ease',
            }}
          >
            <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '1.6rem' }}>group</span>
            <div>
              <div>Lista de Pacientes</div>
              <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 400 }}>Directorio completo</span>
            </div>
          </Link>

          <Link
            to="/dieta/catalogo"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--glass-level-2)',
              border: '1px solid var(--border)',
              textDecoration: 'none',
              color: 'var(--text)',
              fontWeight: 600,
              transition: 'all 0.2s ease',
            }}
          >
            <span className="material-symbols-outlined" style={{ color: 'var(--secondary)', fontSize: '1.6rem' }}>menu_book</span>
            <div>
              <div>Catálogo Alimenticio</div>
              <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 400 }}>Base de alimentos</span>
            </div>
          </Link>

          <Link
            to="/agenda"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--glass-level-2)',
              border: '1px solid var(--border)',
              textDecoration: 'none',
              color: 'var(--text)',
              fontWeight: 600,
              transition: 'all 0.2s ease',
            }}
          >
            <span className="material-symbols-outlined" style={{ color: 'var(--success)', fontSize: '1.6rem' }}>calendar_month</span>
            <div>
              <div>Agenda de Citas</div>
              <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 400 }}>Calendario de citas</span>
            </div>
          </Link>

          <Link
            to="/configuracion"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--glass-level-2)',
              border: '1px solid var(--border)',
              textDecoration: 'none',
              color: 'var(--text)',
              fontWeight: 600,
              transition: 'all 0.2s ease',
            }}
          >
            <span className="material-symbols-outlined" style={{ color: 'var(--accent)', fontSize: '1.6rem' }}>palette</span>
            <div>
              <div>Apariencia & Temas</div>
              <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 400 }}>Cambiar 3 temas</span>
            </div>
          </Link>
        </div>
      </section>
    </div>
  )
}