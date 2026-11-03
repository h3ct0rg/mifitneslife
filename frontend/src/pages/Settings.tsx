import { Link } from 'react-router-dom'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

/**
 * Configuración del centro: una sola entrada con accesos simples.
 * El tema se elige en "Apariencia" del menú de usuario (U2); aquí solo se informa.
 */
export default function Settings() {
  const { user } = useAuth()
  const { theme, themes } = useTheme()
  const isAdmin = user?.role === 'Admin'
  const themeLabel = themes.find((t) => t.id === theme)?.label ?? theme

  return (
    <div className="page">
      <PageHeader title="Configuración" subtitle="Preferencias del centro y de tu cuenta." />

      <ul className="settings-list">
        {isAdmin && (
          <li>
            <Link to="/configuracion/usuarios" className="settings-item">
              <span className="settings-item-icon" aria-hidden="true">
                <span className="material-symbols-outlined">manage_accounts</span>
              </span>
              <span className="settings-item-body">
                <strong>Usuarios e invitaciones</strong>
                <span>Invita a tu equipo y a tus pacientes, y asigna roles.</span>
              </span>
              <span className="material-symbols-outlined settings-item-end" aria-hidden="true">
                chevron_right
              </span>
            </Link>
          </li>
        )}
        <li>
          <div className="settings-item">
            <span className="settings-item-icon" aria-hidden="true">
              <span className="material-symbols-outlined">palette</span>
            </span>
            <span className="settings-item-body">
              <strong>Apariencia</strong>
              <span>
                Tema actual: {themeLabel}. Cámbialo desde el menú de tu cuenta (tu avatar, arriba a la derecha).
              </span>
            </span>
          </div>
        </li>
      </ul>
    </div>
  )
}
