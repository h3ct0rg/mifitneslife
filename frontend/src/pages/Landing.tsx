import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import LandingHeader from '../components/landing/LandingHeader'
import LandingGallery from '../components/landing/LandingGallery'
import LandingPlans from '../components/landing/LandingPlans'
import { usePublicPlans } from '../components/landing/usePublicPlans'
import { CONTACT, TUTORIALS } from '../config/landing'

const PRO_FEATURES = [
  'Ficha completa de cada paciente: datos, mediciones, visitas, fotos y notas.',
  'Agenda con calendario: crea citas y registra la visita con sus medidas en un clic.',
  'Planes de dieta con calorías y macros que se calculan solos a partir del catálogo de alimentos.',
  'Rutinas por día con series, repeticiones, descanso y la animación de cada ejercicio.',
  'Panel de inicio con asistencia, no-show y pacientes sin seguimiento.',
]

const PATIENT_FEATURES = [
  'Ven su progreso en gráficos: peso, IMC, grasa corporal y cintura.',
  'Tienen su dieta del día con comidas, horarios y macros.',
  'Siguen su rutina con imágenes que les recuerdan cada movimiento.',
  'Comparan su antes y después con sus fotos.',
  'Todo desde el celular o la computadora, sin instalar nada.',
]

const BENEFITS = [
  { icon: 'folder_shared', title: 'Todo en un solo lugar', text: 'Datos, visitas, dietas, rutinas y fotos de cada paciente, siempre a mano.' },
  { icon: 'monitoring', title: 'Progreso que se ve', text: 'Gráficos y fotos antes/después que tu paciente entiende al instante. Ver su avance motiva a seguir.' },
  { icon: 'bolt', title: 'Planes en minutos', text: 'Elige alimentos y ejercicios del catálogo: las calorías y los macros se suman solos.' },
  { icon: 'notification_important', title: 'Sabes a quién llamar', text: 'El panel te muestra quién lleva 30 días sin cita ni medición, para que lo contactes a tiempo.' },
  { icon: 'devices', title: 'En cualquier pantalla', text: 'Funciona en el navegador de tu computadora, tablet o celular. No hay nada que instalar.' },
  { icon: 'groups', title: 'Tu equipo, cada quien en su rol', text: 'Invita a nutricionistas y entrenadores. Cada uno ve y hace lo que le corresponde.' },
]

const VIDEOS_FAQ_ID = 'faq-videos'

function External({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only"> (abre en YouTube)</span>
    </a>
  )
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="lp-checks">
      {items.map((t) => (
        <li key={t}>
          <span className="material-symbols-outlined" aria-hidden="true">
            check_circle
          </span>
          {t}
        </li>
      ))}
    </ul>
  )
}

/** Reveal al hacer scroll: solo si hay JS, IntersectionObserver y no se pidió reducir el movimiento (UX-11). */
function useReveal(rootRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const items = root.querySelectorAll<HTMLElement>('.lp-reveal')
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible')
            io.unobserve(e.target)
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )
    items.forEach((el) => io.observe(el))
    root.classList.add('lp-anim')
    return () => {
      io.disconnect()
      root.classList.remove('lp-anim')
    }
  }, [rootRef])
}

/** Landing pública (`/` sin sesión). Copy y estructura: 01-ux.md §2–§3. */
export default function Landing() {
  const rootRef = useRef<HTMLDivElement>(null)
  const plans = usePublicPlans()
  const D = plans.trialDays
  useReveal(rootRef)

  const openVideos = () => {
    const faq = document.getElementById(VIDEOS_FAQ_ID) as HTMLDetailsElement | null
    if (!faq) return
    faq.open = true
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    faq.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    faq.querySelector('summary')?.focus({ preventScroll: true })
  }

  return (
    <div ref={rootRef} className="lp" id="inicio">
      <a href="#contenido" className="lp-skip">
        Saltar al contenido
      </a>
      <LandingHeader />

      <main id="contenido" tabIndex={-1}>
        {/* ===== Hero ===== */}
        <section className="lp-hero" aria-labelledby="lp-hero-title">
          <div className="lp-container lp-hero__grid">
            <div className="lp-hero__copy">
              <p className="lp-chip lp-in" style={{ '--i': 0 } as React.CSSProperties}>
                Para nutricionistas, entrenadores y centros de bienestar
              </p>
              <h1 id="lp-hero-title" className="lp-in" style={{ '--i': 1 } as React.CSSProperties}>
                Tu consulta, en orden. Tus pacientes, motivados.
              </h1>
              <p className="lp-lead lp-in" style={{ '--i': 2 } as React.CSSProperties}>
                Agenda, fichas con gráficos de progreso, planes de dieta con macros calculados y rutinas con
                animaciones. Tú lo armas en minutos y tu paciente lo ve en su celular.
              </p>
              <div className="lp-hero__ctas lp-in" style={{ '--i': 3 } as React.CSSProperties}>
                <Link to="/crear-cuenta" className="btn lp-btn-lime lp-btn-lg">
                  Empieza gratis con Google
                </Link>
                <a href="#capturas" className="btn lp-btn-outline-light lp-btn-lg">
                  Ver cómo se ve
                </a>
              </div>
              <ul className="lp-hero__checks lp-in" style={{ '--i': 4 } as React.CSSProperties}>
                <li>
                  <span className="material-symbols-outlined" aria-hidden="true">check</span>
                  {D} días gratis
                </li>
                <li>
                  <span className="material-symbols-outlined" aria-hidden="true">check</span>
                  Sin tarjeta
                </li>
                <li>
                  <span className="material-symbols-outlined" aria-hidden="true">check</span>
                  Entras al instante con Google
                </li>
              </ul>
            </div>

            <figure className="lp-hero__media lp-in lp-in--media">
              <div className="lp-browser lp-browser--hero">
                <div className="lp-browser__bar" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <img
                  src="/landing/hero-dashboard-1440.webp"
                  srcSet="/landing/hero-dashboard-720.webp 720w, /landing/hero-dashboard-1440.webp 1440w"
                  sizes="(min-width: 960px) 680px, 92vw"
                  width={1440}
                  height={900}
                  alt="Panel de inicio de MyFitnessLife con citas del día, pacientes activos y gráfico de los últimos 6 meses, junto al perfil de una paciente en el celular (datos de demostración)."
                  fetchPriority="high"
                  decoding="async"
                />
              </div>
              <div className="lp-phone lp-phone--hero">
                <img src="/landing/movil-progreso.webp" width={780} height={1688} alt="" fetchPriority="high" decoding="async" />
              </div>
              <span className="lp-float lp-float--1" aria-hidden="true">
                <span className="material-symbols-outlined">restaurant</span>
                Macros calculados solos
              </span>
              <span className="lp-float lp-float--2" aria-hidden="true">
                <span className="material-symbols-outlined">monitoring</span>
                Progreso en gráficos
              </span>
            </figure>
          </div>
          <svg className="lp-wave" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <path d="M0 48c160 26 320 32 480 18S800 14 960 20s320 38 480 30v30H0z" fill="currentColor" />
          </svg>
        </section>

        {/* ===== Qué hace ===== */}
        <section id="funciones" className="lp-section" aria-labelledby="lp-funciones-title">
          <div className="lp-container">
            <header className="lp-section__head lp-reveal">
              <h2 id="lp-funciones-title">Todo lo que necesitas para acompañar a tus pacientes</h2>
              <p className="lp-lead">Una sola plataforma para ti, tu equipo y las personas que atiendes.</p>
            </header>
            <div className="lp-features">
              <article className="lp-card lp-feature lp-reveal">
                <span className="icon-chip" aria-hidden="true">
                  <span className="material-symbols-outlined">stethoscope</span>
                </span>
                <h3>Para ti y tu equipo</h3>
                <FeatureList items={PRO_FEATURES} />
              </article>
              <article className="lp-card lp-feature lp-feature--patient lp-reveal">
                <span className="icon-chip icon-chip--accent" aria-hidden="true">
                  <span className="material-symbols-outlined">smartphone</span>
                </span>
                <h3>Para tus pacientes</h3>
                <div className="lp-feature__body">
                  <FeatureList items={PATIENT_FEATURES} />
                  <div className="lp-phone lp-phone--mini">
                    <img
                      src="/landing/movil-dieta.webp"
                      width={780}
                      height={1688}
                      alt="Dieta del día vista desde el celular de una paciente (datos de demostración)."
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* ===== Por qué ===== */}
        <section id="beneficios" className="lp-section lp-section--sky" aria-labelledby="lp-beneficios-title">
          <div className="lp-container">
            <header className="lp-section__head lp-reveal">
              <h2 id="lp-beneficios-title">
                Menos papeles, más <mark className="lp-mark">resultados</mark>
              </h2>
              <p className="lp-lead">
                Cuando el seguimiento se pierde entre libretas, planillas y chats, el paciente también se pierde. Aquí
                todo queda en su lugar.
              </p>
            </header>
            <ul className="lp-benefits">
              {BENEFITS.map((b) => (
                <li key={b.title} className="lp-card lp-benefit lp-reveal">
                  <span className="icon-chip icon-chip--soft" aria-hidden="true">
                    <span className="material-symbols-outlined">{b.icon}</span>
                  </span>
                  <h3>{b.title}</h3>
                  <p>{b.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ===== Galería ===== */}
        <section id="capturas" className="lp-section" aria-labelledby="lp-capturas-title">
          <div className="lp-container">
            <header className="lp-section__head lp-reveal">
              <h2 id="lp-capturas-title">Así se ve por dentro</h2>
              <p className="lp-lead">Capturas reales de la plataforma, con datos de demostración.</p>
            </header>
            <LandingGallery onVideos={openVideos} />
          </div>
        </section>

        {/* ===== Cómo empezar ===== */}
        <section id="empezar" className="lp-section lp-section--sky" aria-labelledby="lp-empezar-title">
          <div className="lp-container">
            <header className="lp-section__head lp-reveal">
              <h2 id="lp-empezar-title">Empieza en 3 pasos</h2>
            </header>
            <ol className="lp-steps lp-reveal">
              <li>
                <span className="lp-steps__num" aria-hidden="true">1</span>
                <h3>Entra con Google</h3>
                <p>Presiona el botón y elige tu cuenta. Sin formularios ni contraseñas nuevas.</p>
              </li>
              <li>
                <span className="lp-steps__num" aria-hidden="true">2</span>
                <h3>Tu centro queda listo</h3>
                <p>Entras directo a tu propio espacio, con {D} días gratis para probarlo todo.</p>
              </li>
              <li>
                <span className="lp-steps__num" aria-hidden="true">3</span>
                <h3>Registra a tu primer paciente</h3>
                <p>Le llega una invitación a su correo y desde ese momento ve su perfil.</p>
              </li>
            </ol>
            <div className="lp-center">
              <Link to="/crear-cuenta" className="btn btn--primary lp-btn-lg lp-btn-xl">
                Crear mi cuenta gratis
              </Link>
            </div>
          </div>
        </section>

        {/* ===== Planes ===== */}
        <section id="planes" className="lp-section" aria-labelledby="lp-planes-title">
          <div className="lp-container">
            <header className="lp-section__head lp-reveal">
              <h2 id="lp-planes-title">Precios claros, sin sorpresas</h2>
              <p className="lp-lead">
                Pruébalo gratis y, si te gusta, elige cuánto tiempo quieres. Todas las funciones están incluidas en
                todos los planes.
              </p>
            </header>
            <LandingPlans state={plans} />
          </div>
        </section>

        {/* ===== FAQ ===== */}
        <section id="preguntas" className="lp-section lp-section--sky" aria-labelledby="lp-preguntas-title">
          <div className="lp-container lp-faq">
            <header className="lp-section__head lp-reveal">
              <h2 id="lp-preguntas-title">Preguntas frecuentes</h2>
            </header>
            <details>
              <summary>¿Necesito tarjeta para probar?</summary>
              <p>No. Creas tu cuenta con Google y tienes {D} días gratis, sin ingresar ningún medio de pago.</p>
            </details>
            <details>
              <summary>¿Cómo creo mi cuenta?</summary>
              <p>
                Presiona "Crear cuenta gratis" y luego el botón de Google. Entras directo a tu propio centro, como
                administrador.
              </p>
            </details>
            <details>
              <summary>¿Qué pasa al terminar los {D} días?</summary>
              <p>
                No se te cobra nada automáticamente. Tu información se conserva. Para seguir usando la plataforma con
                tu equipo, activas el plan que prefieras con un pago directo (por ahora no usamos pasarela de pago)
                {CONTACT && (
                  <>
                    {' y te guiamos en el proceso — '}
                    <a
                      href={CONTACT.href}
                      {...(CONTACT.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      escríbenos aquí
                    </a>
                  </>
                )}
                . Mientras tanto, tus pacientes pueden seguir viendo su información.
              </p>
            </details>
            <details>
              <summary>¿Cómo entran mis pacientes?</summary>
              <p>
                Los registras con su nombre y correo, y les llega una invitación para activar su cuenta (con contraseña
                o con Google). Si no la encuentran, se la reenvías desde su ficha. Luego entran a su perfil desde el
                celular o la computadora.
              </p>
            </details>
            <details>
              <summary>Soy paciente, ¿tengo que crear una cuenta?</summary>
              <p>
                No. Tu centro te envía una invitación por correo. Úsala para activar tu cuenta y después entra con
                "Iniciar sesión".
              </p>
            </details>
            <details>
              <summary>¿Puedo sumar a mi equipo?</summary>
              <p>Sí. Como administrador invitas a nutricionistas y entrenadores, y cada uno trabaja con sus permisos.</p>
            </details>
            <details>
              <summary>¿Mis datos están seguros?</summary>
              <p>
                Cada centro tiene su propio espacio: tu equipo ve la información de tu centro y cada paciente ve solo la
                suya. Entras con Google o con tu contraseña, y la conexión con la plataforma va cifrada (HTTPS).
              </p>
            </details>
            <details>
              <summary>¿Funciona en el celular?</summary>
              <p>Sí, en cualquier navegador moderno de celular, tablet o computadora. No necesitas descargar ninguna app.</p>
            </details>
            <details id={VIDEOS_FAQ_ID}>
              <summary>¿Hay videos para aprender?</summary>
              <p>Sí, tienes tutoriales cortos en YouTube:</p>
              <ul className="lp-videos">
                {TUTORIALS.map((t) => (
                  <li key={t.href}>
                    <External href={t.href}>
                      <span className="material-symbols-outlined" aria-hidden="true">
                        smart_display
                      </span>
                      {t.label}
                    </External>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </section>

        {/* ===== CTA final ===== */}
        <section className="lp-final" aria-labelledby="lp-final-title">
          <div className="lp-container lp-final__inner lp-reveal">
            <h2 id="lp-final-title">Tus pacientes ya se están esforzando. Dales una forma de verlo.</h2>
            <p className="lp-lead">Crea tu centro hoy y empieza a registrar su progreso desde la primera visita.</p>
            <Link to="/crear-cuenta" className="btn lp-btn-lime lp-btn-lg lp-btn-xl">
              Empieza gratis con Google
            </Link>
            <p className="lp-final__micro">
              {D} días gratis · Sin tarjeta · Cancelas sin hacer nada, simplemente no activas un plan.
            </p>
          </div>
        </section>
      </main>

      {/* ===== Footer ===== */}
      <footer className="lp-footer">
        <div className="lp-container lp-footer__grid">
          <div className="lp-footer__brand">
            <span className="lp-brand lp-brand--footer">
              <span className="brand-mark" aria-hidden="true">
                <span className="material-symbols-outlined is-filled">favorite</span>
              </span>
              <span className="lp-brand__name">MyFitnessLife</span>
            </span>
            <p>Seguimiento nutricional y de entrenamiento, simple y en un solo lugar.</p>
          </div>
          <nav aria-label="Producto">
            <h2>Producto</h2>
            <ul>
              <li><a href="#funciones">Funciones</a></li>
              <li><a href="#planes">Planes</a></li>
              <li><a href="#preguntas">Preguntas</a></li>
            </ul>
          </nav>
          <nav aria-label="Cuenta">
            <h2>Cuenta</h2>
            <ul>
              <li><Link to="/login">Iniciar sesión</Link></li>
              <li><Link to="/crear-cuenta">Crear cuenta gratis</Link></li>
            </ul>
          </nav>
          <nav aria-label="Aprende">
            <h2>Aprende</h2>
            <ul>
              <li>
                <External href={TUTORIALS[0].href}>Tutoriales en YouTube</External>
              </li>
              {CONTACT && (
                <li>
                  <a href={CONTACT.href} {...(CONTACT.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                    {CONTACT.label}
                  </a>
                </li>
              )}
            </ul>
          </nav>
        </div>
        <div className="lp-container lp-footer__legal">
          <p>© {new Date().getFullYear()} MyFitnessLife. Hecho para profesionales del bienestar.</p>
        </div>
      </footer>
    </div>
  )
}
