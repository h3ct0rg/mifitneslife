import { useEffect, useState } from 'react'
import { getImageUrl } from '../api'

interface Props {
  fileName?: string
  alt?: string
  className?: string
  fallbackText?: string
}

export default function AuthImage({ fileName, alt = '', className, fallbackText }: Props) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let objectUrl: string | null = null
    if (!fileName) {
      setSrc(null)
      return
    }
    getImageUrl(fileName)
      .then((url) => {
        objectUrl = url
        setSrc(url)
      })
      .catch(() => setSrc(null))
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [fileName])

  if (!src || !fileName) {
    return <div className={`table-avatar empty ${className ?? ''}`}>{fallbackText ?? '?'}</div>
  }

  return <img src={src} alt={alt} className={className} />
}