import * as React from "react"
import { useAuth } from "@/lib/auth/auth-context"
import { getAllFeatures, getFeaturesByCategory, isFeatureDefaultEnabled } from "./registry"
import {
  getCachedPreferences,
  loadUserFeaturePreferences,
  resolveFeatureState,
  saveUserFeaturePreference,
} from "./preferences"
import type { FeatureDefinition, FeaturePreferences } from "./types"

interface FeatureContextValue {
  preferences: FeaturePreferences
  isLoading: boolean
  error: string | null
  features: FeatureDefinition[]
  enabledPlannerModules: FeatureDefinition[]
  isFeatureEnabled: (featureId: string) => boolean
  setFeatureEnabled: (featureId: string, enabled: boolean) => Promise<void>
  clearError: () => void
}

const FeatureContext = React.createContext<FeatureContextValue | null>(null)

export function FeatureProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id || ""

  const [preferences, setPreferences] = React.useState<FeaturePreferences>(() =>
    getCachedPreferences(userId)
  )
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Reload preferences whenever authenticated user changes
  React.useEffect(() => {
    let isCurrent = true

    if (!userId) {
      setPreferences({})
      setIsLoading(false)
      return
    }

    // Immediately seed with cached preferences for zero-flash rendering
    const cached = getCachedPreferences(userId)
    setPreferences(cached)
    setIsLoading(true)

    loadUserFeaturePreferences(userId)
      .then((loaded) => {
        if (isCurrent) {
          setPreferences((current) => ({
            ...loaded,
            ...current,
          }))
        }
      })
      .catch((err) => {
        if (isCurrent) {
          console.warn("Failed to load feature preferences:", err)
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false)
        }
      })

    return () => {
      isCurrent = false
    }
  }, [userId])

  const preferencesRef = React.useRef(preferences)
  preferencesRef.current = preferences

  const isFeatureEnabled = React.useCallback(
    (featureId: string): boolean => {
      return resolveFeatureState(featureId, preferences)
    },
    [preferences]
  )

  const setFeatureEnabled = React.useCallback(
    async (featureId: string, enabled: boolean): Promise<void> => {
      if (!userId) {
        throw new Error("Must be logged in to configure features")
      }

      setError(null)
      const previous = preferencesRef.current

      // Optimistic update
      const updated = {
        ...previous,
        [featureId]: enabled,
      }
      setPreferences(updated)

      try {
        const saved = await saveUserFeaturePreference(userId, featureId, enabled, previous)
        setPreferences(saved)
      } catch (err) {
        // Rollback to previous state on failure
        setPreferences(previous)
        const msg = err instanceof Error ? err.message : "Failed to save feature preference"
        setError(msg)
        throw err
      }
    },
    [userId]
  )

  const clearError = React.useCallback(() => {
    setError(null)
  }, [])

  const features = React.useMemo(() => getAllFeatures(), [])

  const enabledPlannerModules = React.useMemo(() => {
    return getFeaturesByCategory("Planner").filter((feat) =>
      resolveFeatureState(feat.id, preferences)
    )
  }, [preferences])

  const value = React.useMemo(
    () => ({
      preferences,
      isLoading,
      error,
      features,
      enabledPlannerModules,
      isFeatureEnabled,
      setFeatureEnabled,
      clearError,
    }),
    [
      preferences,
      isLoading,
      error,
      features,
      enabledPlannerModules,
      isFeatureEnabled,
      setFeatureEnabled,
      clearError,
    ]
  )

  return <FeatureContext.Provider value={value}>{children}</FeatureContext.Provider>
}

export function useFeatures(): FeatureContextValue {
  const context = React.useContext(FeatureContext)
  if (!context) {
    return {
      preferences: {
        workout_planner: isFeatureDefaultEnabled("workout_planner"),
        diet_planner: isFeatureDefaultEnabled("diet_planner"),
        expense_tracker: isFeatureDefaultEnabled("expense_tracker"),
        wishlist: isFeatureDefaultEnabled("wishlist"),
      },
      isLoading: false,
      error: null,
      features: getAllFeatures(),
      enabledPlannerModules: [],
      isFeatureEnabled: (id: string) => isFeatureDefaultEnabled(id),
      setFeatureEnabled: async () => {},
      clearError: () => {},
    }
  }
  return context
}

