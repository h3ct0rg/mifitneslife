import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'

/** Destino directo. Con `active` definido el estado activo lo decide el llamador (p. ej. `?tab=`). */
export interface BottomNavLinkItem {
  kind: 'link'
  key: string
  to: string
  label: string
  icon: string
  end?: boolean
  active?: boolean
}

/** Abre una hoja inferior con más opciones (Planes, Más, Cuenta). */
export interface BottomNavSheetItem {
  kind: 'sheet'
  key: string
  label: string
  icon: string
  /** Título de la hoja. */
  title: string
  /** Una ruta de la hoja está activa. */
  active?: boolean
  render: (close: () => void) => ReactNode
}

export type BottomNavItem = BottomNavLinkItem | BottomNavSheetItem

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Barra de navegación inferior (solo ≤640px; el CSS la oculta en tablet/desktop).
 * Mientras está montada añade `has-bottom-nav` a <body> y expone `--bottom-nav-offset` (K4).
 */
export default function BottomNav({ items, label }: { items: BottomNavItem[]; label: string }) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const close = useCallback(() => setOpenKey(null), [])

  useEffect(() => {
    document.body.classList.add('has-bottom-nav')
    return () => document.body.classList.remove('has-bottom-nav')
  }, [])

  const openSheet = items.find(
    (i): i is BottomNavSheetItem => i.kind === 'sheet' && i.key === openKey,
  )

  return (
    <>
      <nav className="bottom-nav" aria-label={label}>
        {items.map((item) => {
          const content = (
            <>
              <span className="material-symbols-outlined bottom-nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="bottom-nav-label">{item.label}</span>
            </>
          )

          if (item.kind === 'sheet') {
            return (
              <button
                key={item.key}
                type="button"
                className={`bottom-nav-item${item.active ? ' active' : ''}`}
                aria-haspopup="dialog"
                aria-expanded={openKey === item.key}
                aria-current={item.active ? 'true' : undefined}
                onClick={() => setOpenKey((k) => (k === item.key ? null : item.key))}
              >
                {content}
              </button>
            )
          }

          if (item.active !== undefined) {
            return (
              <Link
                key={item.key}
                to={item.to}
                className={`bottom-nav-item${item.active ? ' active' : ''}`}
                aria-current={item.active ? 'page' : undefined}
              >
                {content}
              </Link>
            )
          }

          return (
            <NavLink key={item.key} to={item.to} end={item.end} className="bottom-nav-item">
              {content}
            </NavLink>
          )
        })}
      </nav>

      {openSheet && (
        <NavSheet title={openSheet.title} onClose={close}>
          {openSheet.render(close)}
        </NavSheet>
      )}
    </>
  )
}

/** Hoja inferior: foco atrapado, Esc cierra y el foco vuelve al disparador. */
function NavSheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const titleId = useId()
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sheetRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !sheetRef.current) return
    const focusables = Array.from(sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="nav-sheet-layer">
      <div className="nav-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        className="nav-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
      >
        <div className="nav-sheet-head">
          <h2 id={titleId} className="nav-sheet-title">
            {title}
          </h2>
          <button type="button" className="nav-sheet-close" aria-label="Cerrar" onClick={onClose}>
            <span className="material-symbols-outlined" aria-hidden="true">
              close
            </span>
          </button>
        </div>
        <div className="nav-sheet-body">{children}</div>
      </div>
    </div>
  )
}
