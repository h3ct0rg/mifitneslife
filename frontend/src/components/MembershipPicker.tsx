import { useEffect, useRef } from 'react'
import type { MembershipDto } from '../api/types'
import { roleLabel } from '../api/types'
import { lastUsedId, membershipTenant, roleIcon, sortMemberships } from './membershipUtils'

interface Props {
  memberships: MembershipDto[]
  busyId: string | null
  error?: string
  onSelect: (membershipId: string) => void
  onBack: () => void
}

/** Pantalla "¿Con qué perfil quieres entrar?" (login en 2 pasos). */
export default function MembershipPicker({ memberships, busyId, error, onSelect, onBack }: Props) {
  const sorted = sortMemberships(memberships)
  const last = lastUsedId(memberships)
  const firstRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    firstRef.current?.focus()
  }, [])

  return (
    <div className="membership-picker">
      <h2 id="membership-picker-title">¿Con qué perfil quieres entrar?</h2>
      <p className="hint">Tu cuenta tiene acceso a varios perfiles. Podrás cambiarlo luego desde el menú.</p>
      <ul className="membership-cards" aria-labelledby="membership-picker-title">
        {sorted.map((m, i) => {
          const isLast = m.id === last
          return (
            <li key={m.id}>
              <button
                ref={i === 0 ? firstRef : undefined}
                type="button"
                className={`membership-card${isLast ? ' last-used' : ''}`}
                onClick={() => onSelect(m.id)}
                disabled={busyId !== null}
                aria-label={`Entrar como ${roleLabel(m.role)} en ${membershipTenant(m)}${isLast ? ' (último usado)' : ''}`}
              >
                <span className="material-symbols-outlined membership-card-icon" aria-hidden="true">
                  {roleIcon(m.role)}
                </span>
                <span className="membership-card-body">
                  <strong>{membershipTenant(m)}</strong>
                  <span>{roleLabel(m.role)}</span>
                </span>
                {isLast && <span className="membership-card-tag">Último usado</span>}
                {busyId === m.id && <span className="membership-card-tag">Entrando...</span>}
              </button>
            </li>
          )
        })}
      </ul>
      {error && <div className="error-box">{error}</div>}
      <button type="button" className="btn-ghost membership-back" onClick={onBack} disabled={busyId !== null}>
        ← Usar otra cuenta
      </button>
    </div>
  )
}
