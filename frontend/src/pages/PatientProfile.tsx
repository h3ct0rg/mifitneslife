import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { dietsApi, patientPhotosApi, patientsApi, workoutPlansApi } from '../api'
import { getErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/toastContext'
import type { PatientDto } from '../api/types'
import PatientForm, { type PatientFormValues } from '../components/PatientForm'
import AuthImage from '../components/AuthImage'
import MeasurementDashboard from '../components/MeasurementDashboard'
import DietDashboard from '../components/DietDashboard'
import DietHistory from '../components/DietHistory'
import PhotoCapture from '../components/PhotoCapture'
import PhotoHistory from '../components/PhotoHistory'
import WorkoutDashboard from '../components/WorkoutDashboard'
import AssignPicker from '../components/AssignPicker'
import Tabs, { type TabItem } from '../components/Tabs'
import { DeleteConfirmModal } from '../components/Modal'
import ProfileSwitcher from '../components/ProfileSwitcher'
import PageHeader from '../components/ui/PageHeader'
import StateView from '../components/ui/StateView'
import { avatarClass, initialsOf } from '../components/avatarIndex'
import { toLocalIso } from '../utils/localDate'

type ProfileTab = 'evolucion' | 'dieta' | 'entrenamiento' | 'fotos' | 'info'

// Mismas claves que la bottom-nav del paciente (K4). "Información" pasa a "Perfil" (E1).
const PROFILE_TABS: TabItem<ProfileTab>[] = [
  { key: 'evolucion', label: 'Progreso', icon: 'monitoring' },
  { key: 'dieta', label: 'Dieta', icon: 'restaurant_menu' },
  { key: 'entrenamiento', label: 'Entrenamiento', icon: 'fitness_center' },
  { key: 'fotos', label: 'Fotos', icon: 'photo_library' },
  { key: 'info', label: 'Perfil', icon: 'person' },
]

const DEFAULT_TAB: ProfileTab = 'evolucion'

function parseTab(value: string | null): ProfileTab {
  return PROFILE_TABS.some((t) => t.key === value) ? (value as ProfileTab) : DEFAULT_TAB
}

const STATUS: Record<string, { text: string; tone: string }> = {
  Active: { text: 'Activo', tone: 'badge--success' },
  Inactive: { text: 'Inactivo', tone: 'badge--neutral' },
}

type PickerPage = { search?: string; page: number; pageSize: number }

/** Menú "⋯" de acciones secundarias (Invitar/Reenviar, Eliminar). */
function ActionsMenu({ items }: { items: { key: string; label: string; icon: string; danger?: boolean; disabled?: boolean; onSelect: () => void }[] }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    if (!open) return
    itemRefs.current.find((el) => el && !el.disabled)?.focus()
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) buttonRef.current?.focus()
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const els = itemRefs.current.filter((el): el is HTMLButtonElement => !!el && !el.disabled)
    const i = els.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      els[(i + 1) % els.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      els[(i - 1 + els.length) % els.length]?.focus()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div className="profile-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="btn btn--ghost btn--icon profile-menu-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Más acciones"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          more_horiz
        </span>
      </button>
      {open && (
        <div className="profile-menu-list" role="menu" aria-label="Más acciones" onKeyDown={onKeyDown}>
          {items.map((it, idx) => (
            <button
              key={it.key}
              ref={(el) => {
                itemRefs.current[idx] = el
              }}
              type="button"
              role="menuitem"
              className={`profile-menu-item${it.danger ? ' danger' : ''}`}
              disabled={it.disabled}
              onClick={() => {
                close(false)
                it.onSelect()
              }}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                {it.icon}
              </span>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PatientProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = parseTab(searchParams.get('tab'))

  const setActiveTab = (tab: ProfileTab) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('tab', tab)
        return next
      },
      { replace: true },
    )
  }

  const isPatient = user?.role === 'Patient'

  const [patient, setPatient] = useState<PatientDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showDiet, setShowDiet] = useState(false)
  const [dietSaving, setDietSaving] = useState(false)
  const [dietVersion, setDietVersion] = useState(0)
  const [showPhoto, setShowPhoto] = useState(false)
  const [photoVersion, setPhotoVersion] = useState(0)
  const [showRoutine, setShowRoutine] = useState(false)
  const [routineSaving, setRoutineSaving] = useState(false)
  const [routineVersion, setRoutineVersion] = useState(0)
  const [inviting, setInviting] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setLoadError(null)
    try {
      setPatient(await patientsApi.getById(id))
    } catch (err) {
      setLoadError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const handleInvite = async () => {
    if (!id || !patient) return
    setInviting(true)
    try {
      const { invitationStatus } = await patientsApi.invite(id)
      switch (invitationStatus) {
        case 'sent':
        case 'resent':
          toast.success(
            invitationStatus === 'resent'
              ? `Invitación reenviada a ${patient.email}.`
              : `Invitación enviada a ${patient.email}.`,
          )
          setPatient((p) => (p ? { ...p, pendingInvitation: true } : p))
          break
        case 'already_member':
        case 'existing_user':
          toast.show(`${patient.email} ya tiene acceso como paciente en este centro; no se envió invitación.`, 'info')
          setPatient((p) => (p ? { ...p, hasAccount: true } : p))
          break
        case 'failed':
          toast.error(`No se pudo crear la invitación para ${patient.email}. Inténtalo de nuevo más tarde.`)
          break
        default:
          toast.error('No se envió la invitación: el paciente no tiene un email válido.')
      }
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setInviting(false)
    }
  }

  const handleUpdate = async (values: PatientFormValues) => {
    if (!id || !patient) return
    try {
      const updated = await patientsApi.update(id, {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone || undefined,
        dateOfBirth: values.dateOfBirth || undefined,
        profilePhotoUrl: values.profilePhotoUrl || undefined,
        notes: values.notes || undefined,
        status: patient.status,
      })
      setPatient(updated)
      setEditing(false)
      toast.success('Paciente actualizado.')
    } catch (err) {
      toast.error(getErrorMessage(err))
      throw err
    }
  }

  const handleDelete = async () => {
    if (!id) return
    try {
      await patientsApi.remove(id)
      toast.success('Paciente eliminado')
      navigate('/pacientes')
    } catch (err) {
      toast.error(getErrorMessage(err))
      setShowDelete(false)
    }
  }

  const loadDiets = async (params: PickerPage) => {
    const data = await dietsApi.getPaged({ ...params })
    return {
      page: data.page,
      pageSize: data.pageSize,
      total: data.total,
      totalPages: data.totalPages,
      items: data.items.map((d) => ({ id: d.id, name: d.name, meta: d.objective ?? 'Sin objetivo' })),
    }
  }

  const handleAssignDiet = async (dietId: string) => {
    if (!id) return
    setDietSaving(true)
    try {
      await dietsApi.assign(id, dietId || undefined)
      setShowDiet(false)
      setDietVersion((v) => v + 1)
      toast.success(dietId ? 'Dieta asignada al paciente.' : 'Se quitó la dieta asignada.')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setDietSaving(false)
    }
  }

  const handleCapturePhoto = async (file: File) => {
    if (!id) return
    try {
      // TakenAt = hora de reloj (sin zona): `YYYY-MM-DDTHH:mm:ss` local, sin `Z` (tarea zona horaria D1/D5).
      const takenAt = toLocalIso(new Date())
      await patientPhotosApi.upload(id, file, takenAt)
      setShowPhoto(false)
      setPhotoVersion((v) => v + 1)
      toast.success('Foto guardada.')
    } catch (err) {
      // PhotoCapture muestra el error inline en la hoja.
      throw new Error(getErrorMessage(err))
    }
  }

  const loadRoutines = async (params: PickerPage) => {
    const data = await workoutPlansApi.getPaged({ ...params })
    return {
      page: data.page,
      pageSize: data.pageSize,
      total: data.total,
      totalPages: data.totalPages,
      items: data.items.map((p) => ({
        id: p.id,
        name: p.name,
        meta: `${p.objective ?? 'Sin objetivo'} · ${p.days.length} días · ${p.totalExercises} ejercicios`,
      })),
    }
  }

  const handleAssignRoutine = async (planId: string) => {
    if (!id) return
    setRoutineSaving(true)
    try {
      await workoutPlansApi.assign(id, planId || undefined)
      setShowRoutine(false)
      setRoutineVersion((v) => v + 1)
      toast.success(planId ? 'Rutina asignada al paciente.' : 'Se quitó la rutina asignada.')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setRoutineSaving(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="page patient-page">
        <StateView state="loading" title="Cargando perfil..." />
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="page patient-page">
        <StateView
          state={loadError ? 'error' : 'empty'}
          icon={loadError ? undefined : 'person_off'}
          title={loadError ? 'No se pudo cargar el paciente' : 'Paciente no encontrado'}
          message={loadError ?? undefined}
          action={
            loadError ? (
              <button type="button" className="btn btn--ghost" onClick={load}>
                Reintentar
              </button>
            ) : !isPatient ? (
              <Link to="/pacientes" className="btn btn--ghost">
                Ir a pacientes
              </Link>
            ) : undefined
          }
        />
      </div>
    )
  }

  const dob = patient.dateOfBirth
    ? new Date(patient.dateOfBirth + 'T00:00:00').toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null
  const status = STATUS[patient.status] ?? { text: patient.status, tone: 'badge--neutral' }
  // Mismas iniciales y mismo gradiente que en la lista/agenda/dashboard (semilla = id del paciente).
  const initials = initialsOf(patient.fullName)
  const avatarCls = avatarClass(patient.id)

  const menuItems = [
    ...(patient.hasAccount === false
      ? [
          {
            key: 'invite',
            label: inviting ? 'Enviando...' : patient.pendingInvitation ? 'Reenviar invitación' : 'Enviar invitación',
            icon: 'forward_to_inbox',
            disabled: inviting,
            onSelect: handleInvite,
          },
        ]
      : []),
    { key: 'delete', label: 'Eliminar paciente', icon: 'delete', danger: true, onSelect: () => setShowDelete(true) },
  ]

  /** Botón primario de un panel (solo staff). */
  const panelAction = (label: string, icon: string, onClick: () => void) =>
    !isPatient && (
      <div className="panel-actions">
        <button type="button" className="btn btn--primary" onClick={onClick}>
          <span className="material-symbols-outlined" aria-hidden="true">
            {icon}
          </span>
          {label}
        </button>
      </div>
    )

  return (
    <div className={`page patient-page${isPatient ? ' patient-page--self' : ''}`}>
      {/* Hero del paciente (MV-4): gradiente de marca, texto blanco, avatar con gradiente por índice. */}
      <section className="profile-hero page-header-hero">
        {patient.profilePhotoUrl ? (
          <AuthImage
            fileName={patient.profilePhotoUrl}
            alt=""
            className={`profile-avatar ${avatarCls}`}
            fallbackText={initials}
          />
        ) : (
          <span className={`profile-avatar empty ${avatarCls}`} aria-hidden="true">
            {initials}
          </span>
        )}
        <PageHeader
          title={patient.fullName}
          back={isPatient ? undefined : { to: '/pacientes', label: 'Pacientes' }}
          subtitle={
            <span className="profile-hero-meta">
              <span className="profile-hero-contact">
                <span className="material-symbols-outlined" aria-hidden="true">
                  mail
                </span>
                {patient.email}
              </span>
              {patient.phone && (
                <span className="profile-hero-contact">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    call
                  </span>
                  {patient.phone}
                </span>
              )}
              <span className={`badge ${status.tone}`}>{status.text}</span>
            </span>
          }
          actions={
            isPatient ? undefined : (
              <>
                <button type="button" className="btn btn--light" onClick={() => setEditing(true)}>
                  <span className="material-symbols-outlined" aria-hidden="true">
                    edit
                  </span>
                  Editar
                </button>
                <ActionsMenu items={menuItems} />
              </>
            )
          }
        />
      </section>

      {/* En móvil el paciente navega con la bottom-nav (K4): las Tabs superiores se ocultan solo para él. */}
      <div className={`profile-tabs${isPatient ? ' profile-tabs--patient' : ''}`}>
        <Tabs
          tabs={PROFILE_TABS}
          active={activeTab}
          onChange={setActiveTab}
          idPrefix="patient-profile"
          ariaLabel="Secciones del perfil del paciente"
        >
          {activeTab === 'evolucion' && (
            <section className="card" aria-labelledby="evolution-title">
              <div className="panel-head">
                <h2 id="evolution-title">Evolución antropométrica</h2>
                {!isPatient && (
                  <Link to={`/pacientes/${patient.id}/historial`} className="panel-link">
                    Ver todas las visitas
                    <span className="material-symbols-outlined" aria-hidden="true">
                      chevron_right
                    </span>
                  </Link>
                )}
              </div>
              <MeasurementDashboard patientId={patient.id} />
            </section>
          )}

          {activeTab === 'dieta' && (
            <>
              {panelAction('Asignar dieta', 'restaurant_menu', () => setShowDiet(true))}
              {/* Si ambos hijos no renderizan nada, el CSS :empty muestra el texto vacío. */}
              <div className="tab-empty-aware" data-empty-text="No hay una dieta asignada ni historial de dietas.">
                <DietDashboard key={dietVersion} patientId={patient.id} />
                <DietHistory patientId={patient.id} version={dietVersion} />
              </div>
            </>
          )}

          {activeTab === 'entrenamiento' && (
            <>
              {panelAction('Asignar rutina', 'fitness_center', () => setShowRoutine(true))}
              <div className="tab-empty-aware" data-empty-text="No hay una rutina asignada.">
                <WorkoutDashboard patientId={patient.id} version={routineVersion} />
              </div>
            </>
          )}

          {activeTab === 'fotos' && (
            <>
              {panelAction('Tomar foto', 'photo_camera', () => setShowPhoto(true))}
              <PhotoHistory patientId={patient.id} version={photoVersion} />
            </>
          )}

          {activeTab === 'info' && (
            <>
              <section className="card" aria-labelledby="profile-data-title">
                <h2 id="profile-data-title">Datos personales</h2>
                <dl className="detail-list">
                  <div className="detail-item">
                    <dt>Teléfono</dt>
                    <dd>{patient.phone ?? '—'}</dd>
                  </div>
                  <div className="detail-item">
                    <dt>Fecha de nacimiento</dt>
                    <dd>{dob ?? '—'}</dd>
                  </div>
                  <div className="detail-item">
                    <dt>Registrado el</dt>
                    <dd>{new Date(patient.createdAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</dd>
                  </div>
                  <div className="detail-item detail-item--full">
                    <dt>Notas</dt>
                    <dd>{patient.notes ?? 'Sin notas'}</dd>
                  </div>
                </dl>
              </section>

              {isPatient && (
                <section className="card" aria-labelledby="profile-account-title">
                  <h2 id="profile-account-title">Cuenta</h2>
                  <div className="account-actions">
                    {(user?.memberships?.length ?? 0) > 1 && (
                      <div className="account-switch">
                        <span className="text-muted">Cambiar de perfil</span>
                        <ProfileSwitcher />
                      </div>
                    )}
                    <button type="button" className="btn btn--ghost" onClick={handleLogout}>
                      <span className="material-symbols-outlined" aria-hidden="true">
                        logout
                      </span>
                      Cerrar sesión
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
        </Tabs>
      </div>

      {editing && (
        <PatientForm
          title="Editar paciente"
          initial={{
            firstName: patient.firstName,
            lastName: patient.lastName,
            email: patient.email,
            phone: patient.phone ?? '',
            dateOfBirth: patient.dateOfBirth ?? '',
            notes: patient.notes ?? '',
            profilePhotoUrl: patient.profilePhotoUrl,
          }}
          submitLabel="Guardar cambios"
          onSubmit={handleUpdate}
          onCancel={() => setEditing(false)}
        />
      )}

      {showDiet && (
        <AssignPicker
          title="Asignar dieta"
          subtitle={`Elige una dieta para ${patient.fullName}. Se mostrará en su perfil con los valores nutricionales diarios.`}
          emptyText="No hay planes de dieta creados todavía."
          load={loadDiets}
          onSelect={handleAssignDiet}
          onClear={() => handleAssignDiet('')}
          onCancel={() => setShowDiet(false)}
          saving={dietSaving}
        />
      )}

      {showPhoto && <PhotoCapture onCapture={handleCapturePhoto} onCancel={() => setShowPhoto(false)} />}

      {showRoutine && (
        <AssignPicker
          title="Asignar rutina"
          subtitle={`Elige un plan de entrenamiento para ${patient.fullName}. Se asignará como su rutina actual.`}
          emptyText="No hay planes de entrenamiento creados todavía."
          load={loadRoutines}
          onSelect={handleAssignRoutine}
          onClear={() => handleAssignRoutine('')}
          onCancel={() => setShowRoutine(false)}
          saving={routineSaving}
        />
      )}

      {showDelete && (
        <DeleteConfirmModal
          title="Eliminar paciente"
          question="¿Estás seguro de que deseas eliminar este paciente?"
          subject={`${patient.fullName} (${patient.email})`}
          loadImpact={async () => []}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  )
}
