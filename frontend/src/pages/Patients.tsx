import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { patientsApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { PatientDto, PatientInvitationStatus } from '../api/types'
import PatientForm, { type PatientFormValues } from '../components/PatientForm'
import AuthImage from '../components/AuthImage'
import { avatarClass, initialsOf } from '../components/avatarIndex'
import PageHeader from '../components/ui/PageHeader'
import StateView from '../components/ui/StateView'
import { useToast } from '../context/toastContext'

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 300

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  Active: { label: 'Activo', cls: 'badge--success' },
  Inactive: { label: 'Inactivo', cls: 'badge--neutral' },
}

function createdMessage(status: PatientInvitationStatus | undefined, email: string): string {
  switch (status) {
    case 'sent':
      return `Paciente creado. Se envió una invitación a ${email}.`
    case 'resent':
      return `Paciente creado. Se reenvió la invitación pendiente a ${email}.`
    case 'already_member':
    case 'existing_user':
      return `Paciente creado. ${email} ya tiene cuenta como paciente en este centro, no se envió invitación.`
    case 'failed':
      return `Paciente creado, pero no se pudo crear la invitación para ${email}. Reintenta desde su perfil con "Enviar invitación".`
    case 'none':
      return 'Paciente creado. No se envió invitación (sin email válido).'
    default:
      return 'Paciente creado correctamente.'
  }
}

function StatusBadge({ status }: { status: string }) {
  const b = STATUS_BADGE[status] ?? { label: status, cls: 'badge--neutral' }
  return <span className={`badge ${b.cls}`}>{b.label}</span>
}

export default function Patients() {
  const navigate = useNavigate()
  const toast = useToast()
  const [patients, setPatients] = useState<PatientDto[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  // Filtro inmediato: la búsqueda se aplica 300 ms después de dejar de escribir.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setQuery(search.trim())
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [search])

  // Solo se aplica la última respuesta (evita que una búsqueda lenta pise a la siguiente).
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const data = await patientsApi.list({ search: query || undefined, page, pageSize: PAGE_SIZE })
      if (id !== requestId.current) return
      setPatients(data.items)
      setTotal(data.total)
    } catch (err) {
      if (id === requestId.current) setError(getErrorMessage(err))
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [query, page])

  useEffect(() => {
    load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleCreate = async (values: PatientFormValues) => {
    try {
      const created = await patientsApi.create({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone || undefined,
        dateOfBirth: values.dateOfBirth || undefined,
        profilePhotoUrl: values.profilePhotoUrl || undefined,
        notes: values.notes || undefined,
      })
      setShowCreate(false)
      const text = createdMessage(created.invitationStatus, created.email)
      // El paciente se creó igual; `failed` se resalta para que el staff reintente la invitación.
      if (created.invitationStatus === 'failed') toast.error(text)
      else toast.success(text)
      if (page === 1) load()
      else setPage(1)
    } catch (err) {
      toast.error(getErrorMessage(err))
      throw err
    }
  }

  const openCreate = () => setShowCreate(true)

  return (
    <div className="page">
      <PageHeader
        title="Pacientes"
        subtitle={loading && total === 0 ? undefined : `${total} paciente${total === 1 ? '' : 's'}${query ? ` para "${query}"` : ''}`}
        actions={
          <button type="button" className="btn btn--primary clin-desktop-action" onClick={openCreate}>
            <span className="material-symbols-outlined" aria-hidden="true">
              person_add
            </span>
            Crear paciente
          </button>
        }
      />

      <section className="card patients-card">
        <div className="clin-search">
          <span className="material-symbols-outlined clin-search-icon" aria-hidden="true">
            search
          </span>
          <label htmlFor="patients-search" className="sr-only">
            Buscar pacientes
          </label>
          <input
            id="patients-search"
            type="search"
            placeholder="Buscar por nombre, teléfono o email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </div>

        {loading && patients.length === 0 ? (
          <StateView state="loading" title="Cargando pacientes..." />
        ) : error ? (
          <StateView
            state="error"
            message={error}
            action={
              <button type="button" className="btn btn--ghost" onClick={load}>
                Reintentar
              </button>
            }
          />
        ) : patients.length === 0 ? (
          <StateView
            state="empty"
            icon="group"
            title={query ? 'Sin resultados' : 'Aún no hay pacientes'}
            message={query ? `No hay pacientes que coincidan con "${query}".` : 'Crea el primer paciente para empezar.'}
            action={
              !query && (
                <button type="button" className="btn btn--primary" onClick={openCreate}>
                  Crear paciente
                </button>
              )
            }
          />
        ) : (
          <table className="table table--stack patients-table" aria-busy={loading || undefined}>
            <thead>
              <tr>
                <th scope="col">Paciente</th>
                <th scope="col">Email</th>
                <th scope="col">Teléfono</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                // Toda la fila abre la ficha; el enlace del nombre da acceso por teclado.
                <tr key={p.id} className="clin-row-link" onClick={() => navigate(`/pacientes/${p.id}`)}>
                  <td className="patients-name-cell">
                    <div className="patient-name">
                      {p.profilePhotoUrl ? (
                        <AuthImage
                          fileName={p.profilePhotoUrl}
                          alt=""
                          className="table-avatar"
                          fallbackText={p.firstName[0]}
                        />
                      ) : (
                        <span className={`table-avatar empty ${avatarClass(p.id)}`} aria-hidden="true">
                          {initialsOf(p.fullName)}
                        </span>
                      )}
                      <Link
                        to={`/pacientes/${p.id}`}
                        className="row-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {p.fullName}
                      </Link>
                      <span className="material-symbols-outlined patients-chevron" aria-hidden="true">
                        chevron_right
                      </span>
                    </div>
                  </td>
                  <td data-label="Email" className="clin-break">
                    {p.email}
                  </td>
                  <td data-label="Teléfono">{p.phone ?? '—'}</td>
                  <td data-label="Estado">
                    <StatusBadge status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && !error && (
          <nav className="pagination" aria-label="Paginación">
            <button
              type="button"
              className="btn btn--ghost"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <span>
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </nav>
        )}
      </section>

      <button type="button" className="clin-fab" onClick={openCreate} aria-label="Crear paciente">
        <span className="material-symbols-outlined" aria-hidden="true">
          person_add
        </span>
      </button>

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
