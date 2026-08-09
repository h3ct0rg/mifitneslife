import { useEffect, useState } from 'react'
import { adminApi } from '../api'
import { getErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import type { AdminDashboardDto, TenantActivityDto } from '../api/types'

export default function AdminDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState<AdminDashboardDto | null>(null)
  const [activity, setActivity] = useState<TenantActivityDto[]>([])
  const [newTenant, setNewTenant] = useState('')
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const load = async () => {
    try {
      const d = await adminApi.dashboard()
      setData(d)
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (!user) return null

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    try {
      await adminApi.createTenant(newTenant)
      setNewTenant('')
      setMessage({ type: 'ok', text: 'Tenant creado.' })
      load()
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

  const handleViewActivity = async (tenantId: string) => {
    setMessage(null)
    try {
      const a = await adminApi.tenantActivity(tenantId)
      setActivity(a)
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

  return (
    <div className="page">
      <section className="card">
        <h2>Super Admin — Actividad de tenants</h2>
      </section>

      {message && <div className={`alert ${message.type}`}>{message.text}</div>}

      {data && (
        <>
          <section className="stats">
            <div className="stat-card">
              <strong>{data.totalTenants}</strong>
              <span>Tenants totales</span>
            </div>
            <div className="stat-card">
              <strong>{data.activeTenants}</strong>
              <span>Tenants activos</span>
            </div>
            <div className="stat-card">
              <strong>{data.totalUsers}</strong>
              <span>Usuarios totales</span>
            </div>
            <div className="stat-card">
              <strong>{data.activeUsers}</strong>
              <span>Usuarios activos</span>
            </div>
          </section>

          <section className="card">
            <h2>Crear tenant</h2>
            <form onSubmit={handleCreateTenant} className="invite-form">
              <input
                placeholder="Nombre del tenant"
                value={newTenant}
                onChange={(e) => setNewTenant(e.target.value)}
                required
              />
              <button type="submit" className="btn-primary">
                Crear
              </button>
            </form>
          </section>

          <section className="card">
            <h2>Tenants</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Slug</th>
                  <th>Estado</th>
                  <th>Usuarios</th>
                  <th>Activos 30d</th>
                  <th>Actividad</th>
                </tr>
              </thead>
              <tbody>
                {data.tenants.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{t.slug}</td>
                    <td>{t.isActive ? 'Activo' : 'Inactivo'}</td>
                    <td>{t.userCount}</td>
                    <td>{t.activeUsersLast30Days}</td>
                    <td>
                      <button
                        className="btn-ghost"
                        onClick={() => handleViewActivity(t.id)}
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {activity.length > 0 && (
            <section className="card">
              <h2>Actividad reciente del tenant</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Acción</th>
                    <th>Entidad</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((a, i) => (
                    <tr key={i}>
                      <td>{new Date(a.timestamp).toLocaleString()}</td>
                      <td>{a.action}</td>
                      <td>{a.entity}</td>
                      <td>{a.userEmail || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </div>
  )
}