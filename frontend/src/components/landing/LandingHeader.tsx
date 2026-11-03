import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LANDING_SECTIONS } from '../../config/landing'

function Brand() {
  return (
    <a href="#inicio" className="lp-brand" aria-label="MyFitnessLife, ir al inicio">
      <span className="brand-mark" aria-hidden="true">
        <span className="material-symbols-outlined is-filled">favorite</span>
      </span>
      <span className="lp-brand__name">MyFitnessLife</span>
    </a>
  )
}

/** Header fijo de la landing (§2.1): anclas, 2 CTA siempre visibles y menú compacto bajo 960 px. */
export default function LandingHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const headerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Menú abierto: Esc o tocar fuera lo cierran y el foco vuelve al botón ☰ (UX-3).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }
    const onPointer = (e: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  // Tras elegir un ancla: se cierra y el foco vuelve a ☰ después del salto (el navegador lo mueve al navegar al #).
  const closeMenu = () => {
    setOpen(false)
    window.setTimeout(() => toggleRef.current?.focus({ preventScroll: true }), 0)
  }

  return (
    <header ref={headerRef} className={`lp-header${scrolled ? ' is-scrolled' : ''}`}>
      <div className="lp-container lp-header__bar">
        <Brand />
        <nav className="lp-header__nav" aria-label="Secciones">
          {LANDING_SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {s.label}
            </a>
          ))}
        </nav>
        <div className="lp-header__actions">
          <Link to="/login" className="btn lp-btn-link" aria-label="Entrar (iniciar sesión)">
            <span className="lp-only-desktop">Iniciar sesión</span>
            <span className="lp-only-mobile" aria-hidden="true">
              Entrar
            </span>
          </Link>
          <Link to="/crear-cuenta" className="btn btn--primary" aria-label="Crear cuenta gratis">
            <span className="lp-only-desktop">Crear cuenta gratis</span>
            <span className="lp-only-mobile" aria-hidden="true">
              Crear cuenta
            </span>
          </Link>
          <button
            ref={toggleRef}
            type="button"
            className="btn btn--icon lp-header__toggle"
            aria-expanded={open}
            aria-controls="lp-menu"
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {open ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>
      <nav id="lp-menu" className="lp-menu" aria-label="Menú" hidden={!open}>
        <ul>
          {LANDING_SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} onClick={closeMenu}>
                {s.label}
              </a>
            </li>
          ))}
          <li>
            <Link to="/login">Iniciar sesión</Link>
          </li>
        </ul>
      </nav>
    </header>
  )
}
