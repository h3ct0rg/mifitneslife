import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export interface PageHeaderProps {
  /** Único h1 de la página. */
  title: ReactNode
  subtitle?: ReactNode
  /** Enlace "volver" sobre el título. */
  back?: { to: string; label: string }
  /** Acciones de la página (botones). En `hero` se muestran como botón claro (`btn--light`) vía CSS. */
  actions?: ReactNode
  /** `hero`: fondo con el gradiente de marca y texto blanco (MV-1.3). Por defecto `default`. */
  variant?: 'default' | 'hero'
}

/** Cabecera de página: volver + h1 + subtítulo + acciones (K3). */
export default function PageHeader({ title, subtitle, back, actions, variant = 'default' }: PageHeaderProps) {
  return (
    <header className={`page-header${variant === 'hero' ? ' page-header--hero' : ''}`}>
      <div className="page-header-main">
        {back && (
          <Link to={back.to} className="page-header-back">
            <span className="material-symbols-outlined" aria-hidden="true">
              arrow_back
            </span>
            {back.label}
          </Link>
        )}
        <h1>{title}</h1>
        {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  )
}
