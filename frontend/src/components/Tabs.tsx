import { useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

export interface TabItem<K extends string = string> {
  key: K
  label: string
  /** Nombre de icono Material Symbols. */
  icon?: string
}

interface TabsProps<K extends string> {
  tabs: TabItem<K>[]
  active: K
  onChange: (key: K) => void
  /** Prefijo único para los id de tab/panel (accesibilidad). */
  idPrefix: string
  /** Etiqueta accesible de la barra de pestañas. */
  ariaLabel: string
  /** Contenido del panel activo (solo se monta el activo). */
  children: ReactNode
}

/**
 * Pestañas accesibles (patrón WAI-ARIA Tabs, activación automática).
 * Flechas ←/→ y Home/End mueven el foco y activan la pestaña.
 */
export default function Tabs<K extends string>({
  tabs,
  active,
  onChange,
  idPrefix,
  ariaLabel,
  children,
}: TabsProps<K>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const tabId = (k: K) => `${idPrefix}-tab-${k}`
  const panelId = (k: K) => `${idPrefix}-panel-${k}`

  const focusAndSelect = (index: number) => {
    const next = tabs[(index + tabs.length) % tabs.length]
    onChange(next.key)
    const el = refs.current[(index + tabs.length) % tabs.length]
    el?.focus()
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault()
        focusAndSelect(index + 1)
        break
      case 'ArrowLeft':
        e.preventDefault()
        focusAndSelect(index - 1)
        break
      case 'Home':
        e.preventDefault()
        focusAndSelect(0)
        break
      case 'End':
        e.preventDefault()
        focusAndSelect(tabs.length - 1)
        break
    }
  }

  return (
    <div className="tabs">
      <div className="tabs-bar" role="tablist" aria-label={ariaLabel}>
        {tabs.map((t, i) => {
          const selected = t.key === active
          return (
            <button
              key={t.key}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="tab"
              id={tabId(t.key)}
              aria-selected={selected}
              aria-controls={panelId(t.key)}
              tabIndex={selected ? 0 : -1}
              className={`tab${selected ? ' active' : ''}`}
              onClick={() => onChange(t.key)}
              onKeyDown={(e) => handleKeyDown(e, i)}
            >
              {t.icon && (
                <span className="material-symbols-outlined" aria-hidden="true">
                  {t.icon}
                </span>
              )}
              <span className="tab-label">{t.label}</span>
            </button>
          )
        })}
      </div>
      <div
        className="tab-panel"
        role="tabpanel"
        id={panelId(active)}
        aria-labelledby={tabId(active)}
        tabIndex={0}
      >
        {children}
      </div>
    </div>
  )
}
