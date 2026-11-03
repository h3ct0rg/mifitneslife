/** Clase de avatar con gradiente (.av-1….av-6, MV-1) estable para una misma semilla (id o nombre). */
export function avatarClass(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return `av-${(Math.abs(hash) % 6) + 1}`
}

/** Iniciales (máx. 2) de un nombre completo. */
export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
