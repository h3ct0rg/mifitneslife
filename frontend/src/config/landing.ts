// Configuración de la landing pública. Contacto vacío por defecto: los textos/enlaces que lo usan se omiten.
// Para activarlo, define VITE_CONTACT_WHATSAPP (solo dígitos con código de país, p. ej. 59171234567)
// y/o VITE_CONTACT_EMAIL en el .env del build.

const WHATSAPP = (import.meta.env.VITE_CONTACT_WHATSAPP ?? '').replace(/\D/g, '')
const EMAIL = (import.meta.env.VITE_CONTACT_EMAIL ?? '').trim()

export interface ContactLink {
  href: string
  label: string
  external: boolean
}

/** Canal de contacto público (WhatsApp primero, luego correo) o `null` si no hay ninguno. */
export const CONTACT: ContactLink | null = WHATSAPP
  ? { href: `https://wa.me/${WHATSAPP}`, label: 'Escríbenos por WhatsApp', external: true }
  : EMAIL
    ? { href: `mailto:${EMAIL}`, label: `Escríbenos: ${EMAIL}`, external: false }
    : null

/** Anclas del header y del menú móvil (orden de la página). */
export const LANDING_SECTIONS = [
  { id: 'funciones', label: 'Funciones' },
  { id: 'beneficios', label: 'Beneficios' },
  { id: 'capturas', label: 'Capturas' },
  { id: 'planes', label: 'Planes' },
  { id: 'preguntas', label: 'Preguntas' },
] as const

/** Días de prueba mientras carga `GET /api/plans` o si falla. */
export const DEFAULT_TRIAL_DAYS = 30

/** Tutoriales en YouTube (mismos enlaces enviados a los clientes). */
export const TUTORIALS: { label: string; href: string }[] = [
  { label: 'Dashboard', href: 'https://youtu.be/cYbnxkKxe8w' },
  { label: 'Pacientes', href: 'https://youtu.be/vD24sKqSJB4' },
  { label: 'Agenda', href: 'https://youtu.be/vzbwjmmhNGA' },
  { label: 'Alimentos y dietas', href: 'https://youtu.be/cFVglBX5uuE' },
  { label: 'Ejercicios y entrenamiento', href: 'https://youtu.be/isvRtw2BJn4' },
  { label: 'Perfil del paciente', href: 'https://youtu.be/-KffHchcqWw' },
]
