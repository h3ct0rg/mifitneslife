import { useLayoutEffect, useRef, useState } from 'react'
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { GOOGLE_CLIENT_ID } from '../config/auth'

interface Props {
  /** Texto del botón de Google: "signin_with" (login) o "continue_with" (crear cuenta). */
  text: 'signin_with' | 'continue_with'
  onCredential: (credential: string) => void
  onError: () => void
  /** Mientras se procesa la credencial: botón inactivo + aria-busy. */
  busy?: boolean
}

/**
 * Botón oficial de Google (pill, grande, en español) al ancho del contenedor (200–400 px, límites de la librería).
 * Solo se monta si hay VITE_GOOGLE_CLIENT_ID; el llamador decide qué mostrar si no.
 */
export default function GoogleAuthButton({ text, onCredential, onError, busy = false }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(Math.round(Math.min(400, Math.max(200, el.clientWidth))))
  }, [])

  return (
    <div ref={ref} className={`auth-google${busy ? ' is-busy' : ''}`} aria-busy={busy || undefined}>
      {width > 0 && (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID} locale="es">
          <GoogleLogin
            onSuccess={(res) => {
              if (res.credential) onCredential(res.credential)
            }}
            onError={onError}
            text={text}
            shape="pill"
            size="large"
            width={width}
          />
        </GoogleOAuthProvider>
      )}
    </div>
  )
}
