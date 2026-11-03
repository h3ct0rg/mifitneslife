import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { getErrorMessage } from '../api/client'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
  /** Acciones fijas al pie (en móvil quedan pegadas abajo de la hoja). Opcional: también sirve `.modal-actions` dentro de children. */
  footer?: ReactNode
  /** Oculta el botón de cerrar de la cabecera (Esc sigue cerrando). */
  hideCloseButton?: boolean
  /**
   * Opt-in: el clic en el fondo cierra. Solo para modales informativos o de selección sin datos que perder.
   * Por defecto NO cierra, para no perder formularios a medio llenar.
   */
  closeOnBackdrop?: boolean
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Pila de modales abiertos: Esc y el foco atrapado solo actúan sobre el de arriba. */
const modalStack: symbol[] = []

/**
 * Modal accesible: en ≤640px se muestra como hoja inferior (CSS).
 * Esc y el botón X cierran; el clic en el fondo solo con `closeOnBackdrop`.
 * El foco queda atrapado dentro y vuelve al disparador al cerrar.
 */
export default function Modal({
  title,
  onClose,
  children,
  className,
  footer,
  hideCloseButton,
  closeOnBackdrop = false,
}: ModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const pressStartedOnOverlay = useRef(false)
  // Se captura en el primer render, antes de que un hijo con autoFocus mueva el foco.
  const [trigger] = useState(() => document.activeElement as HTMLElement | null)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Sin barra de acciones (.modal-actions/.modal-footer) la hoja móvil quedaría con padding inferior 0:
  // se añade espacio + safe-area. Un MutationObserver lo recalcula si el contenido cambia (p. ej. carga → formulario).
  const [hasActionBar, setHasActionBar] = useState(true)
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const check = () => setHasActionBar(!!dialog.querySelector('.modal-actions, .modal-footer'))
    check()
    const observer = new MutationObserver(check)
    observer.observe(dialog, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const token = Symbol('modal')
    modalStack.push(token)
    const dialog = dialogRef.current
    // Si ningún hijo tomó el foco (autoFocus), se enfoca el primer control o el propio diálogo.
    if (dialog && !dialog.contains(document.activeElement)) {
      const first = dialog.querySelector<HTMLElement>(`.modal-body ${FOCUSABLE}, .modal-footer ${FOCUSABLE}`)
      ;(first ?? dialog).focus()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalStack[modalStack.length - 1] === token) {
        e.stopPropagation()
        onCloseRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      const i = modalStack.indexOf(token)
      if (i >= 0) modalStack.splice(i, 1)
      if (trigger && document.contains(trigger)) trigger.focus()
    }
  }, [trigger])

  const trapTab = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !dialogRef.current) return
    const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    )
    if (nodes.length === 0) {
      e.preventDefault()
      return
    }
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  // Cierra solo si el clic empezó y terminó en el fondo (evita cerrar al arrastrar una selección).
  const onOverlayDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    pressStartedOnOverlay.current = e.target === e.currentTarget
  }
  const onOverlayClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && pressStartedOnOverlay.current && e.target === e.currentTarget) onCloseRef.current()
  }

  return (
    <div className="modal-overlay" onMouseDown={onOverlayDown} onClick={onOverlayClick}>
      <div
        ref={dialogRef}
        className={`modal${hasActionBar ? '' : ' modal--no-actions'} ${className ?? ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={trapTab}      >
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          {!hideCloseButton && (
            <button
              type="button"
              className="btn btn--icon modal-close"
              onClick={() => onCloseRef.current()}
              aria-label="Cerrar"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                close
              </span>
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
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
    // Confirmación sin datos que perder: cerrar por fondo = cancelar (bloqueado mientras borra).
    <Modal title={title} onClose={close} className="modal-confirm modal-delete" closeOnBackdrop>
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
        {/* Foco inicial en Cancelar: Enter no debe borrar por accidente. */}
        <button type="button" className="btn-ghost" onClick={close} disabled={deleting} autoFocus>
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
  // Mientras se procesa no se puede cancelar (ni con Esc, X o fondo).
  const cancel = () => {
    if (!busy) onCancel()
  }

  return (
    <Modal title={title} onClose={cancel} className="modal-confirm" closeOnBackdrop>
      <p>{message}</p>
      <div className="modal-actions">
        {/* En acciones peligrosas el foco inicial va a Cancelar. */}
        <button type="button" className="btn-ghost" onClick={cancel} disabled={busy} autoFocus={danger}>
          Cancelar
        </button>
        <button
          type="button"
          className={danger ? 'btn-danger' : 'btn-primary'}
          onClick={onConfirm}
          disabled={busy}
          autoFocus={!danger}
        >
          {busy ? 'Procesando...' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
