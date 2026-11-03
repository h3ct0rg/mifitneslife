import type { MembershipDto } from '../api/types'
import { roleLabel } from '../api/types'

const ROLE_ICONS: Record<string, string> = {
  SuperAdmin: 'admin_panel_settings',
  Admin: 'shield_person',
  Nutritionist: 'nutrition',
  Trainer: 'fitness_center',
  Patient: 'person',
}

export const roleIcon = (role: string) => ROLE_ICONS[role] ?? 'badge'

/** "Clínica X" o "Plataforma" (SuperAdmin sin tenant). */
export const membershipTenant = (m: MembershipDto) => m.tenantName ?? (m.tenantId ? 'Tenant' : 'Plataforma')

export const membershipLabel = (m: MembershipDto) => `${membershipTenant(m)} · ${roleLabel(m.role)}`

/** Id de la membresía usada más recientemente (null si ninguna tiene fecha). */
export function lastUsedId(memberships: MembershipDto[]): string | null {
  let best: MembershipDto | null = null
  for (const m of memberships) {
    if (m.lastUsedAt && (!best?.lastUsedAt || m.lastUsedAt > best.lastUsedAt)) best = m
  }
  return best?.id ?? null
}

/** Orden: último usado primero, luego por tenant y rol. */
export function sortMemberships(memberships: MembershipDto[]): MembershipDto[] {
  const last = lastUsedId(memberships)
  return [...memberships].sort((a, b) => {
    if (a.id === last) return -1
    if (b.id === last) return 1
    return membershipLabel(a).localeCompare(membershipLabel(b), 'es')
  })
}
