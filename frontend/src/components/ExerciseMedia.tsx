import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getExerciseImageUrlCached, getExerciseVideoUrlCached } from '../api/mediaCache'

interface Props {
  gifUrl?: string
  imageUrl?: string
  alt?: string
  className?: string
  prefer?: 'gif' | 'image'
  /** Se muestra si no hay medio o no se pudo cargar (p. ej. un icono). */
  fallback?: ReactNode
}

export default function ExerciseMedia({ gifUrl, imageUrl, alt = '', className, prefer = 'gif', fallback = null }: Props) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      // Si la URL ya es http(s) (no fileName de Minio), usarla directo
      if (prefer === 'gif' && gifUrl) {
        if (gifUrl.startsWith('http')) {
          if (!cancelled) setSrc(gifUrl)
          return
        }
        try {
          const url = await getExerciseVideoUrlCached(gifUrl)
          if (!cancelled) setSrc(url)
          return
        } catch {
          // intentar imagen
        }
      }
      if (imageUrl) {
        if (imageUrl.startsWith('http')) {
          if (!cancelled) setSrc(imageUrl)
          return
        }
        try {
          const url = await getExerciseImageUrlCached(imageUrl)
          if (!cancelled) setSrc(url)
          return
        } catch {
          /* noop */
        }
      }
      if (prefer === 'gif' && gifUrl) {
        try {
          const url = await getExerciseVideoUrlCached(gifUrl)
          if (!cancelled) setSrc(url)
          return
        } catch {
          /* noop */
        }
      }
      if (!cancelled) setSrc(null)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [gifUrl, imageUrl, prefer])

  if (!src) return <>{fallback}</>

  return <img src={src} alt={alt} className={className} loading="lazy" />
}
