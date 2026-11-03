import { useEffect, useState } from 'react'
import { publicApi } from '../../api'
import type { PublicPlansDto } from '../../api/types'
import { DEFAULT_TRIAL_DAYS } from '../../config/landing'

export type PublicPlansState =
  | { status: 'loading'; trialDays: number; data: null }
  | { status: 'ok'; trialDays: number; data: PublicPlansDto }
  | { status: 'error'; trialDays: number; data: null }

// Una sola petición por carga de la app (landing ↔ /crear-cuenta comparten el resultado).
let cache: Promise<PublicPlansDto> | null = null

function load(): Promise<PublicPlansDto> {
  if (!cache) {
    cache = publicApi.plans().catch((err) => {
      cache = null // permite reintentar en la próxima visita
      throw err
    })
  }
  return cache
}

/** Planes públicos + días de prueba (fallback 30 mientras carga o si falla). */
export function usePublicPlans(): PublicPlansState {
  const [state, setState] = useState<PublicPlansState>({
    status: 'loading',
    trialDays: DEFAULT_TRIAL_DAYS,
    data: null,
  })

  useEffect(() => {
    let alive = true
    load()
      .then((data) => {
        if (!alive) return
        const trialDays = data.trialDays > 0 ? data.trialDays : DEFAULT_TRIAL_DAYS
        setState({ status: 'ok', trialDays, data })
      })
      .catch(() => {
        if (alive) setState({ status: 'error', trialDays: DEFAULT_TRIAL_DAYS, data: null })
      })
    return () => {
      alive = false
    }
  }, [])

  return state
}
