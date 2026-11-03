import type { ReactNode } from 'react'

export interface StateViewProps {
  state: 'loading' | 'empty' | 'error'
  title?: ReactNode
  message?: ReactNode
  /** CTA (empty) o "Reintentar" (error). */
  action?: ReactNode
  /** Icono Material Symbols; por defecto según el estado. */
  icon?: string
  /** Menos relleno, para bloques pequeños. */
  compact?: boolean
}

const DEFAULT_ICON: Record<StateViewProps['state'], string> = {
  loading: '',
  empty: 'inbox',
  error: 'error',
}

const DEFAULT_TITLE: Record<StateViewProps['state'], string> = {
  loading: 'Cargando...',
  empty: 'No hay datos',
  error: 'No se pudo cargar',
}

/**
 * Estado de carga / vacío / error inline (nunca a pantalla completa) (K3).
 * loading → spinner con role="status"; error → role="alert".
 */
export default function StateView({ state, title, message, action, icon, compact }: StateViewProps) {
  const role = state === 'error' ? 'alert' : state === 'loading' ? 'status' : undefined
  const iconName = icon ?? DEFAULT_ICON[state]
  return (
    <div
      className={`state-view state-view--${state}${compact ? ' state-view--compact' : ''}`}
      role={role}
      aria-live={state === 'loading' ? 'polite' : undefined}
      aria-busy={state === 'loading' || undefined}
    >
      {state === 'loading' ? (
        <span className="spinner" aria-hidden="true" />
      ) : (
        iconName && (
          <span className="material-symbols-outlined state-view-icon" aria-hidden="true">
            {iconName}
          </span>
        )
      )}
      <p className="state-view-title">{title ?? DEFAULT_TITLE[state]}</p>
      {message && <p className="state-view-message">{message}</p>}
      {action && <div className="state-view-action">{action}</div>}
    </div>
  )
}
