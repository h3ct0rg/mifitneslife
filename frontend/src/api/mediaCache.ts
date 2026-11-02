import { api } from './client'

const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7115/api'
const CACHE_NAME = 'exercise-media-v2'

// Cache en memoria: fileName -> Promise<objectURL> para no re-descargar durante la sesión.
const objectUrlCache = new Map<string, Promise<string>>()

async function getAuthBlob(path: string): Promise<Blob> {
  const cache = await caches.open(CACHE_NAME)
  const cacheUrl = `${API_URL}${path}`

  // 1) Intentar desde Cache API (persistente entre sesiones)
  try {
    const cached = await cache.match(cacheUrl)
    if (cached) return await cached.blob()
  } catch {
    /* ignore cache errors */
  }

  // 2) Descargar desde el backend
  const { data } = await api.get(path, { responseType: 'blob' })

  // 3) Guardar en Cache API para próximas sesiones
  try {
    await cache.put(cacheUrl, new Response(data))
  } catch {
    /* ignore */
  }

  return data
}

function loadCached(path: string): Promise<string> {
  const existing = objectUrlCache.get(path)
  if (existing) return existing

  const promise = getAuthBlob(path)
    .then((blob) => URL.createObjectURL(blob))
    .catch((err) => {
      // Limpiar el cache para permitir reintento
      objectUrlCache.delete(path)
      throw err
    })

  objectUrlCache.set(path, promise)
  return promise
}

export async function getExerciseImageUrlCached(fileName: string): Promise<string> {
  // Los nombres son seguros ("exercises/XXXX-ABC123.gif"): sin codificar para no romper la "/".
  return loadCached(`/uploads/exercise-image/${fileName}`)
}

export async function getExerciseVideoUrlCached(fileName: string): Promise<string> {
  return loadCached(`/uploads/exercise-video/${fileName}`)
}
