import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { patientsApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { PatientDto } from '../api/types'
import PatientForm, { type PatientFormValues } from '../components/PatientForm'
import AuthImage from '../components/AuthImage'

export default function Patients() {
  const navigate = useNavigate()
  const [patients, setPatients] = useState<PatientDto[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const loadPatients = async (p = page, s = appliedSearch) => {
    setLoading(true)
    setMessage(null)
    try {
      const data = await patientsApi.list({ search: s || undefined, page: p, pageSize })
      setPatients(data.items)
      setTotal(data.total)
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPatients()
  }, [])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setAppliedSearch(search)
    loadPatients(1, search)
  }

  const handleCreate = async (values: PatientFormValues) => {
    try {
      await patientsApi.create({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone || undefined,
        dateOfBirth: values.dateOfBirth || undefined,
        profilePhotoUrl: values.profilePhotoUrl || undefined,
        notes: values.notes || undefined,
      })
      setShowCreate(false)
      setMessage({ type: 'ok', text: 'Paciente creado correctamente.' })
      loadPatients(1, appliedSearch)
    } catch (err) {
      setMessage({
        type: 'err',
        text: getErrorMessage(err),
      })
      throw err
    }
  }

  return (
    <div className="page">
      {message && <div className={`alert ${message.type}`}>{message.text}</div>}

      <section className="card">
        <form onSubmit={handleSearch} className="search-bar">
          <input
            placeholder="Buscar por nombre, apellido, teléfono o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn-primary">
            Buscar
          </button>
        </form>
        {appliedSearch && (
          <p className="text-muted" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            Resultados de "{appliedSearch}" · {total} paciente(s)
          </p>
        )}
      </section>

      <section className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Pacientes ({total})</h2>
          <button type="button" className="btn-primary" style={{ width: 'auto' }} onClick={() => setShowCreate(true)}>
            + Crear paciente
          </button>
        </div>

        {loading ? (
          <p>Cargando...</p>
        ) : patients.length === 0 ? (
          <div className="empty-state">No se encontraron pacientes.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="patient-name">
                      {p.profilePhotoUrl ? (
                        <AuthImage
                          fileName={p.profilePhotoUrl}
                          alt={p.fullName}
                          className="table-avatar"
                          fallbackText={p.firstName[0]}
                        />
                      ) : (
                        <span className="table-avatar empty">{p.firstName[0]}</span>
                      )}
                      <a className="row-link" onClick={() => navigate(`/pacientes/${p.id}`)}>
                        {p.fullName}
                      </a>
                    </div>
                  </td>
                  <td>{p.email}</td>
                  <td>{p.phone ?? '—'}</td>
                  <td>
                    <span className="badge">{p.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="pagination">
            <button
              type="button"
              className="btn-ghost"
              disabled={page <= 1}
              onClick={() => {
                setPage(page - 1)
                loadPatients(page - 1)
              }}
            >
              Anterior
            </button>
            <span>
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              className="btn-ghost"
              disabled={page >= totalPages}
              onClick={() => {
                setPage(page + 1)
                loadPatients(page + 1)
              }}
            >
              Siguiente
            </button>
          </div>
        )}
      </section>

      {showCreate && (
        <PatientForm
          title="Crear paciente"
          submitLabel="Crear paciente"
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}