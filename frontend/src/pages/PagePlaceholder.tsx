import { Link } from 'react-router-dom'
import PageHeader from '../components/ui/PageHeader'
import StateView from '../components/ui/StateView'

interface PagePlaceholderProps {
  title: string
  /** Icono Material Symbols del módulo. */
  icon?: string
  message?: string
  back?: { to: string; label: string }
}

/** Página de módulo aún no disponible: cabecera + estado vacío coherente con el resto. */
export default function PagePlaceholder({
  title,
  icon = 'construction',
  message = 'Este módulo estará disponible en una próxima versión.',
  back,
}: PagePlaceholderProps) {
  return (
    <div className="page">
      <PageHeader title={title} back={back} />
      <section className="card">
        <StateView
          state="empty"
          icon={icon}
          title="Próximamente"
          message={message}
          action={
            back && (
              <Link to={back.to} className="btn btn--ghost">
                {back.label}
              </Link>
            )
          }
        />
      </section>
    </div>
  )
}
