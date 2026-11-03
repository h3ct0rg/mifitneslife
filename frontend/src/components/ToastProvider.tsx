import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ToastContext } from '../context/toastContext'
import type { ToastApi, ToastType } from '../context/toastContext'

interface ToastItem {
  id: number
  text: string
  type: ToastType
}

const AUTO_CLOSE_MS = 4000

const ICONS: Record<ToastType, string> = {
  success: 'check_circle',
  error: 'error',
  info: 'info',
}

/** Provider de toasts: montar una sola vez (App). Usar con `useToast()`. */
export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
  }, [])

  const show = useCallback(
    (text: string, type: ToastType = 'info') => {
      const id = nextId.current++
      setToasts((list) => [...list, { id, text, type }])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), AUTO_CLOSE_MS),
      )
    },
    [dismiss],
  )

  useEffect(() => {
    const map = timers.current
    return () => map.forEach((t) => clearTimeout(t))
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (text) => show(text, 'success'),
      error: (text) => show(text, 'error'),
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" role="status" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="material-symbols-outlined" aria-hidden="true">
              {ICONS[t.type]}
            </span>
            <span className="toast-text">{t.text}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => dismiss(t.id)}
              aria-label="Cerrar notificación"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                close
              </span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
