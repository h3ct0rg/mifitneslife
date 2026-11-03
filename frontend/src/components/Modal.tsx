import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getErrorMessage } from '../api/client'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
}

/** Modal genérico: cierra con Esc o clic en el fondo. */
export default function Modal({ title, onClose, children, className }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal ${className ?? ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

interface DeleteConfirmModalProps {
  title: string
  /** Ej.: "¿Estás seguro de que deseas eliminar este tenant?" */
  question: string
  /** Nombre o email del elemento a eliminar. */
  subject: string
  /** Consulta el impacto (delete-impact) y lo devuelve como líneas legibles. */
  loadImpact: () => Promise<string[]>
  /** Ejecuta el borrado; el llamador gestiona toast/refresco/cierre. */
  onConfirm: () => Promise<void>
  onCancel: () => void
}

/** Confirmación de borrado definitivo con resumen de impacto. */
export function DeleteConfirmModal({
  title,
  question,
  subject,
  loadImpact,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  const [impact, setImpact] = useState<string[] | null>(null)
  const [impactError, setImpactError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadImpact()
      .then((lines) => {
        if (!cancelled) setImpact(lines)
      })
      .catch((err) => {
        if (!cancelled) setImpactError(getErrorMessage(err))
      })
    return () => {
      cancelled = true
    }
    // Se consulta una sola vez al abrir el modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadingImpact = impact === null && impactError === null

  const handleConfirm = async () => {
    setDeleting(true)
    try {
      await onConfirm()
    } finally {
      setDeleting(false)
    }
  }

  const close = () => {
    if (!deleting) onCancel()
  }

  return (
    <Modal title={title} onClose={close} className="modal-confirm modal-delete">
      <div className="confirm-icon" aria-hidden="true">
        <span className="material-symbols-outlined">delete</span>
      </div>
      <p>{question}</p>
      <p>
        <strong>{subject}</strong>
      </p>
      {loadingImpact ? (
        <p className="text-muted">Calculando impacto...</p>
      ) : impactError ? (
        <div className="alert err">No se pudo obtener el impacto: {impactError}</div>
      ) : (
        impact &&
        impact.length > 0 && (
          <ul className="delete-impact">
            {impact.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )
      )}
      <p className="delete-warning">Esta acción no se puede deshacer.</p>
      <div className="modal-actions">
        <button type="button" className="btn-ghost" onClick={close} disabled={deleting}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn-danger"
          onClick={handleConfirm}
          disabled={loadingImpact || !!impactError || deleting}
        >
          {deleting ? 'Eliminando...' : 'Eliminar'}
        </button>
      </div>
    </Modal>
  )
}

interface ConfirmModalProps {
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  title,
  message,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal title={title} onClose={onCancel} className="modal-confirm">
      <p>{message}</p>
      <div className="modal-actions">
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button
          type="button"
          className={danger ? 'btn-danger' : 'btn-primary'}
          onClick={onConfirm}
          disabled={busy}
          autoFocus
        >
          {busy ? 'Procesando...' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
