import { useRef } from 'react'

interface Shot {
  name: string
  kind: 'desktop' | 'phone'
  alt: string
  caption: string
}

// Capturas reales del tenant demo (public/landing). El dashboard ya va en el hero.
const SHOTS: Shot[] = [
  {
    name: 'ficha-progreso',
    kind: 'desktop',
    alt: 'Ficha de una paciente con indicadores IMC, cintura-cadera e IAC, gráficos de peso, IMC, grasa corporal y cintura, y tabla de variación (datos de demostración).',
    caption: 'Gráficos de evolución y variación desde la primera medición.',
  },
  {
    name: 'movil-dieta',
    kind: 'phone',
    alt: 'Dieta del día en el celular de una paciente: anillo de calorías y tarjetas de proteína, carbohidratos y grasa (datos de demostración).',
    caption: 'Tu paciente ve sus calorías y macros del día.',
  },
  {
    name: 'movil-entreno',
    kind: 'phone',
    alt: 'Rutina en el celular de una paciente: Día 1 con ejercicios ilustrados y sus series, repeticiones y descanso (datos de demostración).',
    caption: 'Y su rutina, con series, repeticiones y descanso.',
  },
  {
    name: 'agenda',
    kind: 'desktop',
    alt: 'Agenda con el calendario del mes y las citas de hoy con su estado: atendida y programadas (datos de demostración).',
    caption: 'Calendario del mes y citas del día, con su estado.',
  },
  {
    name: 'ejercicios',
    kind: 'desktop',
    alt: 'Catálogo de ejercicios con buscador, filtros por categoría y equipamiento, y la ilustración de cada ejercicio.',
    caption: 'Catálogo con la animación de cada ejercicio.',
  },
]

function ShotImage({ shot }: { shot: Shot }) {
  if (shot.kind === 'phone') {
    return (
      <div className="lp-phone">
        <img
          src={`/landing/${shot.name}.webp`}
          width={780}
          height={1688}
          alt={shot.alt}
          loading="lazy"
          decoding="async"
        />
      </div>
    )
  }
  return (
    <div className="lp-browser">
      <div className="lp-browser__bar" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <img
        src={`/landing/${shot.name}-1440.webp`}
        srcSet={`/landing/${shot.name}-720.webp 720w, /landing/${shot.name}-1440.webp 1440w`}
        sizes="(min-width: 960px) 760px, 85vw"
        width={1440}
        height={900}
        alt={shot.alt}
        loading="lazy"
        decoding="async"
      />
    </div>
  )
}

/** Galería (§2.5): bento en escritorio, carrusel con scroll-snap y botones en móvil. */
export default function LandingGallery({ onVideos }: { onVideos: () => void }) {
  const trackRef = useRef<HTMLDivElement>(null)

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <>
      <div ref={trackRef} className="lp-gallery" tabIndex={0} role="region" aria-label="Capturas de la app">
        <ul className="lp-gallery__list">
        {SHOTS.map((s) => (
          <li key={s.name} className={`lp-shot lp-shot--${s.name}`}>
            <figure>
              <ShotImage shot={s} />
              <figcaption>{s.caption}</figcaption>
            </figure>
          </li>
        ))}
        <li className="lp-shot lp-shot--video">
          <a
            href="#preguntas"
            className="lp-video-tile"
            onClick={(e) => {
              e.preventDefault()
              onVideos()
            }}
          >
            <span className="lp-video-tile__icon" aria-hidden="true">
              <span className="material-symbols-outlined is-filled">play_circle</span>
            </span>
            <span className="lp-video-tile__title">¿Prefieres verlo en video?</span>
            <span className="lp-video-tile__link">
              Mira los tutoriales <span aria-hidden="true">→</span>
            </span>
          </a>
        </li>
        </ul>
      </div>
      <div className="lp-gallery__controls">
        <button type="button" className="btn btn--icon btn--secondary" aria-label="Captura anterior" onClick={() => scrollBy(-1)}>
          <span className="material-symbols-outlined" aria-hidden="true">
            chevron_left
          </span>
        </button>
        <button type="button" className="btn btn--icon btn--secondary" aria-label="Captura siguiente" onClick={() => scrollBy(1)}>
          <span className="material-symbols-outlined" aria-hidden="true">
            chevron_right
          </span>
        </button>
      </div>
    </>
  )
}
