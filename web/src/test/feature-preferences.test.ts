import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  getCachedPreferences,
  loadUserFeaturePreferences,
  resolveFeatureState,
  saveUserFeaturePreference,
  setCachedPreferences,
} from "@/lib/features/preferences"
import * as SupabaseClientModule from "@/lib/supabase/client"

describe("Phase 3: Per-User Feature Preferences", () => {
  const testUserId = "11111111-1111-4111-a111-111111111111"
  const testUserId2 = "22222222-2222-4222-a222-222222222222"

  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it("resolves feature state using safe defaults when unconfigured", () => {
    expect(resolveFeatureState("workout_planner", {})).toBe(false)
    expect(resolveFeatureState("diet_planner", {})).toBe(false)
    expect(resolveFeatureState("unknown_future_flag", {})).toBe(false)
  })

  it("explicit user preference takes precedence over default", () => {
    expect(resolveFeatureState("workout_planner", { workout_planner: true })).toBe(true)
    expect(resolveFeatureState("workout_planner", { workout_planner: false })).toBe(false)
    expect(resolveFeatureState("diet_planner", { diet_planner: true })).toBe(true)
  })

  it("preserves unrelated preferences and unknown feature IDs when updating a single module", async () => {
    const existing = {
      workout_planner: true,
      unknown_custom_module: true,
    }

    const updated = await saveUserFeaturePreference(
      testUserId,
      "diet_planner",
      true,
      existing
    )

    expect(updated).toEqual({
      workout_planner: true,
      unknown_custom_module: true,
      diet_planner: true,
    })

    // LocalStorage should reflect the updated state for that user
    const cached = getCachedPreferences(testUserId)
    expect(cached).toEqual({
      workout_planner: true,
      unknown_custom_module: true,
      diet_planner: true,
    })
  })

  it("isolates cached preferences per user ID", () => {
    setCachedPreferences(testUserId, { workout_planner: true })
    setCachedPreferences(testUserId2, { diet_planner: true })

    expect(getCachedPreferences(testUserId)).toEqual({ workout_planner: true })
    expect(getCachedPreferences(testUserId2)).toEqual({ diet_planner: true })
  })

  it("handles cloud loading failures gracefully by falling back to local cache", async () => {
    setCachedPreferences(testUserId, { workout_planner: true })

    // Simulate Supabase returning an error
    vi.spyOn(SupabaseClientModule.supabase, "from").mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Network connection lost" },
          }),
        }),
      }),
    } as any)

    const prefs = await loadUserFeaturePreferences(testUserId)
    expect(prefs).toEqual({ workout_planner: true })
  })

  it("throws clear error when saving fails and requires authenticated user", async () => {
    await expect(
      saveUserFeaturePreference("", "workout_planner", true, {})
    ).rejects.toThrow("Cannot save feature preference without authenticated user")
  })
})
