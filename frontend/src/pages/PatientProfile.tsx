import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { dietsApi, patientPhotosApi, patientsApi, workoutPlansApi } from '../api'
import { getErrorMessage } from '../api/client'
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

export default function PatientProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [patient, setPatient] = useState<PatientDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDiet, setShowDiet] = useState(false)
  const [dietSaving, setDietSaving] = useState(false)
  const [dietVersion, setDietVersion] = useState(0)
  const [showPhoto, setShowPhoto] = useState(false)
  const [photoVersion, setPhotoVersion] = useState(0)
  const [showRoutine, setShowRoutine] = useState(false)
  const [routineSaving, setRoutineSaving] = useState(false)
  const [routineVersion, setRoutineVersion] = useState(0)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setMessage(null)
    try {
      setPatient(await patientsApi.getById(id))
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

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
      setMessage({ type: 'ok', text: 'Paciente actualizado correctamente.' })
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
      throw err
    }
  }

  const handleDelete = async () => {
    if (!id) return
    setDeleting(true)
    try {
      await patientsApi.remove(id)
      navigate('/pacientes')
    } catch (err) {
      setDeleting(false)
      setShowDelete(false)
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

  const loadDiets = async (params: { search?: string; page: number; pageSize: number }) => {
    const data = await dietsApi.getPaged({ ...params })
    return {
      page: data.page,
      pageSize: data.pageSize,
      total: data.total,
      totalPages: data.totalPages,
      items: data.items.map((d) => ({
        id: d.id,
        name: d.name,
        meta: d.objective ?? 'Sin objetivo',
      })),
    }
  }

  const handleAssignDiet = async (dietId: string) => {
    if (!id) return
    setDietSaving(true)
    setMessage(null)
    try {
      await dietsApi.assign(id, dietId || undefined)
      setShowDiet(false)
      setDietVersion((v) => v + 1)
      setMessage({ type: 'ok', text: dietId ? 'Dieta asignada al paciente.' : 'Se quitó la dieta asignada.' })
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    } finally {
      setDietSaving(false)
    }
  }

  const handleCapturePhoto = async (file: File) => {
    if (!id) return
    try {
      const now = new Date()
      const takenAt = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString()
      await patientPhotosApi.upload(id, file, takenAt)
      setShowPhoto(false)
      setPhotoVersion((v) => v + 1)
      setMessage({ type: 'ok', text: 'Foto guardada correctamente.' })
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
      throw err
    }
  }

  const loadRoutines = async (params: { search?: string; page: number; pageSize: number }) => {
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
    setMessage(null)
    try {
      await workoutPlansApi.assign(id, planId || undefined)
      setShowRoutine(false)
      setRoutineVersion((v) => v + 1)
      setMessage({ type: 'ok', text: planId ? 'Rutina asignada al paciente.' : 'Se quitó la rutina asignada.' })
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    } finally {
      setRoutineSaving(false)
    }
  }

  if (loading) return <div className="page"><p>Cargando...</p></div>

  if (!patient) {
    return (
      <div className="page">
        {message && <div className={`alert ${message.type}`}>{message.text}</div>}
        <p className="empty-state">Paciente no encontrado.</p>
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

  return (
    <div className="page">
      {message && <div className={`alert ${message.type}`}>{message.text}</div>}

      <div className="profile-head card">
        <div className="profile-head-top">
          {patient.profilePhotoUrl ? (
            <AuthImage fileName={patient.profilePhotoUrl} alt="" className="profile-avatar" fallbackText={patient.fullName[0]} />
          ) : (
            <span className="profile-avatar empty">{patient.fullName[0]}</span>
          )}
          <div>
            <h2>{patient.fullName}</h2>
            <p className="profile-meta">{patient.email}</p>
            {patient.phone && <p className="profile-meta">📞 {patient.phone}</p>}
            <p className="profile-meta">
              Estado: <span className="badge">{patient.status}</span>
            </p>
          </div>
        </div>
        <div className="profile-actions">
          <button type="button" className="btn-ghost" onClick={() => navigate('/pacientes')}>
            ← Volver
          </button>
          <button type="button" className="btn-ghost" onClick={() => navigate(`/pacientes/${id}/historial`)}>
            Historial
          </button>
          <button type="button" className="btn-ghost" onClick={() => setShowDiet(true)}>
            Dieta
          </button>
          <button type="button" className="btn-ghost" onClick={() => setShowPhoto(true)}>
            📷 Foto
          </button>
          <button type="button" className="btn-ghost" onClick={() => setShowRoutine(true)}>
            Asignar rutina
          </button>
          <button type="button" className="btn-ghost" onClick={() => setEditing(true)}>
            Editar
          </button>
          <button type="button" className="btn-danger-soft" onClick={() => setShowDelete(true)}>
            Eliminar
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Evolución antropométrica</h2>
        <MeasurementDashboard patientId={patient.id} />
      </div>

      <DietDashboard key={dietVersion} patientId={patient.id} />
      <DietHistory patientId={patient.id} version={dietVersion} />
      <PhotoHistory patientId={patient.id} version={photoVersion} />
      <WorkoutDashboard patientId={patient.id} version={routineVersion} />

      <div className="card">
        <h2>Información</h2>
        <div className="detail-list">
          <div className="detail-item">
            <span>Nombre completo</span>
            <strong>{patient.fullName}</strong>
          </div>
          <div className="detail-item">
            <span>Email</span>
            <strong>{patient.email}</strong>
          </div>
          <div className="detail-item">
            <span>Teléfono</span>
            <strong>{patient.phone ?? '—'}</strong>
          </div>
          <div className="detail-item">
            <span>Fecha de nacimiento</span>
            <strong>{dob ?? '—'}</strong>
          </div>
          <div className="detail-item">
            <span>Registrado el</span>
            <strong>{new Date(patient.createdAt).toLocaleString('es-ES')}</strong>
          </div>
          <div className="detail-item">
            <span>Notas</span>
            <strong>{patient.notes ?? 'Sin notas'}</strong>
          </div>
        </div>
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

      {showPhoto && (
        <PhotoCapture
          onCapture={handleCapturePhoto}
          onCancel={() => setShowPhoto(false)}
        />
      )}

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
        <div className="modal-overlay" onClick={() => !deleting && setShowDelete(false)}>
          <div className="modal modal-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon">🗑</div>
            <h2>Eliminar paciente</h2>
            <p>
              ¿Estás seguro que deseas eliminar a <strong>{patient.fullName}</strong>? Esta acción
              no se puede deshacer.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowDelete(false)}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}