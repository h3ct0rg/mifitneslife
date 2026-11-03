import type { PublicPlanDto } from '../api/types'

const numberFmt = new Intl.NumberFormat('es', { maximumFractionDigits: 2 })

/** "12", "9,45": hasta 2 decimales, sin ",00". */
export const formatUsd = (n: number) => numberFmt.format(n)

/** 30 → "1 mes"; múltiplos de 30 (<360) → "n meses"; 360–366 → "1 año"; resto → "n días". */
export function durationLabel(days: number): string {
  if (days === 30) return '1 mes'
  if (days >= 360 && days <= 366) return '1 año'
  if (days % 30 === 0 && days < 360) return `${days / 30} meses`
  return `${days} días`
}

export interface PricedPlan extends PublicPlanDto {
  /** Equivalente a 30 días (`costoDía × 30`); `null` en el plan base. */
  monthlyEquivalent: number | null
  /** Ahorro % vs. el plan base (floor); `null` si es < 1 o es el plan base. */
  savingsPct: number | null
  recommended: boolean
}

/**
 * Ahorro real vs. el plan más corto (base mensual): floor((1 − costoDía / costoDíaBase) × 100).
 * Recomendado = el de mayor ahorro (solo si hay más de un plan y alguno ahorra).
 */
export function pricePlans(plans: PublicPlanDto[]): PricedPlan[] {
  const valid = plans
    .filter((p) => p.durationDays > 0 && p.priceUsd >= 0)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  if (valid.length === 0) return []
  const base = valid.reduce((min, p) => (p.durationDays < min.durationDays ? p : min))
  const baseDaily = base.priceUsd / base.durationDays

  const priced = valid.map((p) => {
    const daily = p.priceUsd / p.durationDays
    const isBase = p.id === base.id
    const pct = !isBase && baseDaily > 0 ? Math.floor((1 - daily / baseDaily) * 100) : 0
    return {
      ...p,
      monthlyEquivalent: isBase ? null : Math.round(daily * 30 * 100) / 100,
      savingsPct: pct >= 1 ? pct : null,
      recommended: false,
    }
  })

  if (priced.length > 1) {
    const best = priced.reduce<PricedPlan | null>(
      (acc, p) => (p.savingsPct !== null && (!acc || p.savingsPct > (acc.savingsPct ?? 0)) ? p : acc),
      null,
    )
    if (best) best.recommended = true
  }
  return priced
}
