import PagePlaceholder from './PagePlaceholder'

/** Fuera del menú (F2b) mientras sea placeholder; la ruta sigue existiendo. */
export default function WhatsApp() {
  return (
    <PagePlaceholder
      title="WhatsApp"
      icon="chat"
      message="Pronto podrás enviar recordatorios de citas y mensajes a tus pacientes por WhatsApp."
      back={{ to: '/configuracion', label: 'Configuración' }}
    />
  )
}
