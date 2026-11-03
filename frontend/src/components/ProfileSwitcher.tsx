import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getErrorMessage } from '../api/client'
import { roleLabel } from '../api/types'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/toastContext'
import { membershipLabel, membershipTenant, roleIcon, sortMemberships } from './membershipUtils'

/** Selector de perfil (membresía) en la cabecera. Solo se renderiza con >1 membresía. */
export default function ProfileSwitcher() {
  const { user, switchMembership } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  useEffect(() => {
    if (open) itemRefs.current.find((el) => el?.getAttribute('aria-checked') === 'true')?.focus()
  }, [open])

  const memberships = user?.memberships ?? []
  if (!user || memberships.length <= 1) return null

  const sorted = sortMemberships(memberships)
  const current = memberships.find((m) => m.id === user.membershipId)

  const close = () => {
    setOpen(false)
    buttonRef.current?.focus()
  }

  const handleSwitch = async (membershipId: string) => {
    if (membershipId === user.membershipId) {
      close()
      return
    }
    setBusyId(membershipId)
    try {
      await switchMembership(membershipId)
      const m = memberships.find((x) => x.id === membershipId)
      setOpen(false)
      navigate('/')
      if (m) toast.success(`Ahora estás como ${membershipLabel(m)}`)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = itemRefs.current.filter((el): el is HTMLButtonElement => !!el)
    const idx = items.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      items[(idx + 1) % items.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      items[(idx - 1 + items.length) % items.length]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      items[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      items[items.length - 1]?.focus()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div className="profile-switcher" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="btn-ghost profile-switcher-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title="Cambiar de perfil"
        aria-label={`Cambiar de perfil${current ? ` (actual: ${membershipLabel(current)})` : ''}`}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          switch_account
        </span>
        <span className="profile-switcher-current">
          {current ? membershipTenant(current) : 'Cambiar perfil'}
        </span>
        <span className="nav-chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div className="profile-switcher-menu" role="menu" aria-label="Cambiar de perfil" onKeyDown={onMenuKeyDown}>
          {sorted.map((m, i) => {
            const isCurrent = m.id === user.membershipId
            return (
              <button
                key={m.id}
                ref={(el) => {
                  itemRefs.current[i] = el
                }}
                type="button"
                role="menuitemradio"
                aria-checked={isCurrent}
                className={`profile-switcher-item${isCurrent ? ' current' : ''}`}
                onClick={() => handleSwitch(m.id)}
                disabled={busyId !== null}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  {roleIcon(m.role)}
                </span>
                <span className="profile-switcher-item-body">
                  <strong>{membershipTenant(m)}</strong>
                  <span>{roleLabel(m.role)}</span>
                </span>
                {busyId === m.id ? (
                  <span className="profile-switcher-tag">Cambiando...</span>
                ) : (
                  isCurrent && (
                    <span className="material-symbols-outlined profile-switcher-check" aria-hidden="true">
                      check
                    </span>
                  )
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
