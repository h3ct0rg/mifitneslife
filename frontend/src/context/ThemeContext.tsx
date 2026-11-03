import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

/** Temas = sobrescritura del acento (U2). */
export type ThemeId = 'vs-blue' | 'blue-white' | 'blue-rose'
/** @deprecated usar ThemeId. */
export type ThemeType = ThemeId

const THEMES: { id: ThemeId; label: string }[] = [
  { id: 'vs-blue', label: 'Océano' },
  { id: 'blue-white', label: 'Esmeralda' },
  { id: 'blue-rose', label: 'Aurora' },
]

interface ThemeContextType {
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
  themes: { id: ThemeId; label: string }[]
}

// Misma clave que antes: la preferencia guardada se conserva.
const STORAGE_KEY = 'mifitnesslife_theme'

const isThemeId = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v)

function readSaved(): ThemeId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return isThemeId(saved) ? saved : 'vs-blue'
  } catch {
    return 'vs-blue'
  }
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeId>(readSaved)

  const setTheme = useCallback((next: ThemeId) => {
    if (!isThemeId(next)) return
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* almacenamiento no disponible: el tema dura la sesión */
    }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const value = useMemo(() => ({ theme, setTheme, themes: THEMES }), [theme, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
