import * as React from "react"

export type Theme = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const STORAGE_KEY = "pm-theme"

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined)

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light"
  }
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  } catch {
    return "light"
  }
}

function applyThemeToHtml(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return
  const root = document.documentElement
  if (resolved === "dark") {
    root.classList.add("dark")
    root.classList.remove("light")
    root.style.colorScheme = "dark"
  } else {
    root.classList.remove("dark")
    root.classList.add("light")
    root.style.colorScheme = "light"
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(() => {
    if (typeof window === "undefined") return "system"
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === "light" || stored === "dark" || stored === "system") {
        return stored
      }
    } catch {
      // Fallback
    }
    return "system"
  })

  const [systemTheme, setSystemTheme] = React.useState<ResolvedTheme>(() => getSystemTheme())

  const resolvedTheme: ResolvedTheme = theme === "system" ? systemTheme : theme

  // Apply to DOM whenever resolvedTheme changes
  React.useEffect(() => {
    applyThemeToHtml(resolvedTheme)
  }, [resolvedTheme])

  // Track system preference when in 'system' mode
  React.useEffect(() => {
    if (theme !== "system" || typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return
    }

    try {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      const handleChange = (e: MediaQueryListEvent) => {
        setSystemTheme(e.matches ? "dark" : "light")
      }

      mediaQuery.addEventListener("change", handleChange)
      return () => mediaQuery.removeEventListener("change", handleChange)
    } catch {
      // Fallback if addEventListener not supported
    }
  }, [theme])

  const setTheme = React.useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme)
    try {
      localStorage.setItem(STORAGE_KEY, nextTheme)
    } catch {
      // Ignore
    }
  }, [])

  const toggleTheme = React.useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }, [resolvedTheme, setTheme])

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme, setTheme, toggleTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

const defaultThemeValue: ThemeContextValue = {
  theme: "light",
  resolvedTheme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext)
  return context ?? defaultThemeValue
}
