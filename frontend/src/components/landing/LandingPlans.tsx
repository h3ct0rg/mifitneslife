import { Link } from 'react-router-dom'
import { CONTACT } from '../../config/landing'
import { durationLabel, formatUsd, pricePlans } from '../../utils/plans'
import type { PublicPlansState } from './usePublicPlans'

function TrialBanner({ days, fallback }: { days: number; fallback: boolean }) {
  return (
    <div className="lp-trial">
      <span className="icon-chip" aria-hidden="true">
        <span className="material-symbols-outlined">card_giftcard</span>
      </span>
      <p className="lp-trial__text">
        <strong>Al registrarte tienes {days} días gratis, sin tarjeta.</strong>{' '}
        {fallback
          ? 'No pudimos cargar los precios en este momento. Recarga la página para verlos.'
          : 'Pruébalo todo con tus pacientes y decide después.'}
      </p>
      <Link to="/crear-cuenta" className="btn btn--primary lp-btn-lg">
        Empieza gratis
      </Link>
    </div>
  )
}

/** Planes (§2.7): datos de GET /api/plans, ahorro real vs. el plan más corto; sin precios si el API falla. */
export default function LandingPlans({ state }: { state: PublicPlansState }) {
  const plans = state.status === 'ok' ? pricePlans(state.data.plans) : []
  const showGrid = state.status === 'loading' || plans.length > 0

  return (
    <>
      <TrialBanner days={state.trialDays} fallback={!showGrid} />
      {showGrid && (
        <>
          <p className="lp-plans__all">Todas las funciones en todos los planes. Solo cambia cuánto tiempo pagas.</p>
          {state.status === 'loading' ? (
            <ul className="lp-plans" aria-busy="true" aria-label="Cargando planes">
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className="lp-plan lp-plan--skeleton" aria-hidden="true">
                  <span className="skeleton" style={{ width: '50%', height: 20 }} />
                  <span className="skeleton" style={{ width: '70%', height: 40 }} />
                  <span className="skeleton" style={{ width: '40%', height: 16 }} />
                  <span className="skeleton" style={{ width: '100%', height: 44, marginTop: 'auto' }} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="lp-plans">
              {plans.map((p) => (
                <li key={p.id} className={`lp-plan${p.recommended ? ' is-recommended' : ''}`}>
                  {p.recommended && <span className="lp-plan__badge">Recomendado · mejor precio</span>}
                  <h3 className="lp-plan__name">{p.name}</h3>
                  <p className="lp-plan__price">
                    <span className="lp-plan__amount">${formatUsd(p.priceUsd)}</span>
                    <span className="lp-plan__currency">USD</span>
                  </p>
                  <p className="lp-plan__per">/ {durationLabel(p.durationDays)}</p>
                  <p className="lp-plan__days">{p.durationDays} días de acceso</p>
                  <div className="lp-plan__extra">
                    {p.monthlyEquivalent !== null && (
                      <p className="lp-plan__monthly">≈ {formatUsd(p.monthlyEquivalent)} USD al mes</p>
                    )}
                    {p.savingsPct !== null && (
                      <p className="lp-plan__save">Ahorras {p.savingsPct} % vs. mensual</p>
                    )}
                  </div>
                  <Link
                    to="/crear-cuenta"
                    className={`btn btn--block ${p.recommended ? 'btn--primary' : 'btn--secondary'}`}
                    aria-label={`Empieza gratis (plan ${p.name})`}
                  >
                    Empieza gratis
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="lp-plans__note">
            Precios en dólares (USD) por centro. Al terminar tu prueba eliges un plan y lo activas con un pago
            directo{CONTACT ? '; te guiamos paso a paso' : ''}. No hay cobros automáticos.
          </p>
        </>
      )}
    </>
  )
}
