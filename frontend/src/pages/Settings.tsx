import { useTheme, type ThemeType } from '../context/ThemeContext'


interface ThemeOption {
  id: ThemeType
  name: string
  icon: string
  description: string
  swatches: string[]
  badgeText: string
}

const THEMES: ThemeOption[] = [
  {
    id: 'vs-blue',
    name: 'Visual Studio Blue',
    icon: 'laptop_chromebook',
    description: 'Estética profesional, tecnológica y empresarial basada en Visual Studio y productos Microsoft.',
    swatches: ['#0078D4', '#4FC3F7', '#F3F6FA', '#1F2937'],
    badgeText: 'Profesional / Tecnológico',
  },
  {
    id: 'blue-white',
    name: 'Blue & White Premium',
    icon: 'auto_awesome',
    description: 'Diseño ultra limpio, moderno y confiable con enfoque en azul cristalino y blancos luminosos.',
    swatches: ['#2563EB', '#60A5FA', '#F8FAFC', '#172033'],
    badgeText: 'Limpio / Premium',
  },
  {
    id: 'blue-rose',
    name: 'Blue & Rose',
    icon: 'favorite',
    description: 'Estructura sólida en azul complementada con elegantes detalles y microinteracciones en color rosa.',
    swatches: ['#2563EB', '#EC4899', '#F8FAFC', '#172033'],
    badgeText: 'Moderno / Diferenciado',
  },
]

export default function Settings() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="page">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '1.75rem', fontWeight: 700 }}>
          Configuración
        </h1>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.95rem' }}>
          Personaliza la experiencia visual y las preferencias de la plataforma SaaS.
        </p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '1.5rem' }}>
            palette
          </span>
          <h2 style={{ margin: 0 }}>Apariencia & Tema de la Aplicación</h2>
        </div>

        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: 0, marginBottom: '1.5rem' }}>
          Selecciona una de las 3 paletas visuales diseñadas con arquitectura <strong>Glassmorphism</strong>.
          El cambio se reflejará instantáneamente en toda la interfaz sin necesidad de recargar.
        </p>

        <div className="theme-grid">
          {THEMES.map((item) => {
            const isSelected = theme === item.id
            return (
              <div
                key={item.id}
                className={`theme-card ${isSelected ? 'active' : ''}`}
                onClick={() => setTheme(item.id)}
              >
                <div>
                  <div className="theme-card-header">
                    <div className="theme-card-title">
                      <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '1.25rem' }}>
                        {item.icon}
                      </span>
                      {item.name}
                    </div>
                    {isSelected && (
                      <span className="theme-badge">
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                          check_circle
                        </span>
                        Tema actual
                      </span>
                    )}
                  </div>

                  <p className="theme-card-desc">{item.description}</p>

                  <div className="theme-swatches">
                    {item.swatches.map((color, idx) => (
                      <span
                        key={idx}
                        className="theme-dot"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                  <button
                    type="button"
                    className={isSelected ? 'btn-primary' : 'btn-secondary'}
                    style={{ width: '100%' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setTheme(item.id)
                    }}
                  >
                    {isSelected ? '✓ Tema Seleccionado' : 'Aplicar Tema'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}