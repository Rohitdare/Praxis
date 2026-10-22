import { isSupabaseConfigured, supabase } from "@/lib/supabase/client"
import { isFeatureDefaultEnabled } from "./registry"
import type { FeaturePreferences } from "./types"

const STORAGE_PREFIX = "praxis_feature_preferences_"

/**
 * Returns safe storage key scoped to the authenticated user ID.
 */
function getStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`
}

/**
 * Reads locally cached feature preferences for the user.
 */
export function getCachedPreferences(userId: string): FeaturePreferences {
  if (!userId || typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(getStorageKey(userId))
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === "object" && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * Sets locally cached feature preferences for the user.
 */
export function setCachedPreferences(userId: string, prefs: FeaturePreferences): void {
  if (!userId || typeof window === "undefined") return
  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(prefs))
  } catch {
    // Local storage quota or security error ignored
  }
}

/**
 * Evaluates whether a feature is enabled, resolving:
 * 1. Explicit user preference
 * 2. Registry default value (disabled for optional modules)
 * 3. Safe fallback (false)
 */
export function resolveFeatureState(featureId: string, preferences: FeaturePreferences): boolean {
  if (typeof preferences[featureId] === "boolean") {
    return preferences[featureId]
  }
  return isFeatureDefaultEnabled(featureId)
}

/**
 * Loads feature preferences for an authenticated user.
 * Tries cloud profile first (if online & configured), falling back to local cache.
 */
export async function loadUserFeaturePreferences(userId: string): Promise<FeaturePreferences> {
  if (!userId) return {}

  const cached = getCachedPreferences(userId)

  if (!isSupabaseConfigured || (typeof navigator !== "undefined" && !navigator.onLine)) {
    return cached
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("feature_preferences")
      .eq("id", userId)
      .maybeSingle()

    if (error) {
      console.warn("Could not load cloud feature preferences, using cached:", error.message)
      return cached
    }

    if (data?.feature_preferences && typeof data.feature_preferences === "object") {
      const merged: FeaturePreferences = {
        ...cached,
        ...(data.feature_preferences as FeaturePreferences),
      }
      setCachedPreferences(userId, merged)
      return merged
    }

    return cached
  } catch (err) {
    console.warn("Exception loading cloud feature preferences:", err)
    return cached
  }
}

/**
 * Saves an updated feature toggle for an authenticated user.
 * Preserves all unrelated existing preferences (including future/unknown IDs).
 */
export async function saveUserFeaturePreference(
  userId: string,
  featureId: string,
  enabled: boolean,
  currentPreferences: FeaturePreferences
): Promise<FeaturePreferences> {
  if (!userId) {
    throw new Error("Cannot save feature preference without authenticated user")
  }

  const updated: FeaturePreferences = {
    ...currentPreferences,
    [featureId]: enabled,
  }

  // Update local cache first
  setCachedPreferences(userId, updated)

  // Persist to Supabase if configured and online
  if (isSupabaseConfigured && (typeof navigator === "undefined" || navigator.onLine)) {
    const { error } = await supabase
      .from("profiles")
      .update({
        feature_preferences: updated,
      })
      .eq("id", userId)

    if (error) {
      // If error indicates column does not exist (e.g. migration not applied in dev), warn but keep local cache
      if (error.message && error.message.includes("feature_preferences")) {
        console.warn("profiles.feature_preferences column not yet created in Supabase database. Kept in local persistence.")
        return updated
      }
      throw new Error(error.message || "Failed to save feature preference to cloud")
    }
  }

  return updated
}
