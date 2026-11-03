/**
 * Fechas de citas = hora de reloj de la clínica, sin zona (D1/D5 de la tarea zona horaria).
 * Nunca se convierten a UTC: se envían como `YYYY-MM-DDTHH:mm:ss` local sin offset y las respuestas
 * sin `Z` se interpretan como hora local (comportamiento nativo de `new Date('YYYY-MM-DDTHH:mm:ss')`).
 */

const pad = (n: number) => String(n).padStart(2, '0')

/** `YYYY-MM-DD` de la fecha local (no UTC). */
export function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** `YYYY-MM-DDTHH:mm:ss` en hora local, sin offset ni `Z`. */
export function toLocalIso(d: Date): string {
  return `${toLocalDateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/**
 * Normaliza el valor de un `<input type="datetime-local">` (`YYYY-MM-DDTHH:mm` o con segundos)
 * a `YYYY-MM-DDTHH:mm:ss`, sin pasar por `Date` (la hora elegida se conserva tal cual).
 */
export function normalizeLocalInput(value: string): string {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00` : value
}

/** Zona IANA del navegador (p. ej. `America/La_Paz`); `undefined` si el entorno no la expone. */
export function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
  } catch {
    return undefined
  }
}
