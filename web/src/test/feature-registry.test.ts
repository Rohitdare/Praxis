import { describe, expect, it } from "vitest"
import {
  FEATURE_REGISTRY,
  getAllFeatures,
  getFeature,
  getFeaturesByCategory,
  isFeatureDefaultEnabled,
} from "@/lib/features/registry"

describe("Phase 2: Centralized Feature Registry", () => {
  it("registers workout_planner and diet_planner with required metadata", () => {
    const workout = FEATURE_REGISTRY["workout_planner"]
    expect(workout).toBeDefined()
    expect(workout.id).toBe("workout_planner")
    expect(workout.name).toBe("Workout Planner")
    expect(workout.description).toBe("Create workout routines and organize training sessions.")
    expect(workout.defaultEnabled).toBe(false)
    expect(workout.category).toBe("Planner")
    expect(workout.status).toBe("available")
    expect(workout.navigationTarget).toBe("/planner/workouts")

    const diet = FEATURE_REGISTRY["diet_planner"]
    expect(diet).toBeDefined()
    expect(diet.id).toBe("diet_planner")
    expect(diet.name).toBe("Diet Planner")
    expect(diet.description).toBe("Plan meals and organize daily nutrition.")
    expect(diet.defaultEnabled).toBe(false)
    expect(diet.category).toBe("Planner")
    expect(diet.status).toBe("available")
    expect(diet.navigationTarget).toBe("/planner/diet")
  })

  it("resolves both initial optional modules to disabled by default", () => {
    expect(isFeatureDefaultEnabled("workout_planner")).toBe(false)
    expect(isFeatureDefaultEnabled("diet_planner")).toBe(false)
  })

  it("handles unknown or retired feature IDs safely", () => {
    expect(isFeatureDefaultEnabled("non_existent_feature")).toBe(false)
    expect(getFeature("non_existent_feature")).toBeUndefined()
  })

  it("returns all features via getAllFeatures without duplicate definitions", () => {
    const all = getAllFeatures()
    expect(all.length).toBeGreaterThanOrEqual(2)
    const ids = all.map((f) => f.id)
    expect(ids).toContain("workout_planner")
    expect(ids).toContain("diet_planner")
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("filters features by category", () => {
    const plannerFeatures = getFeaturesByCategory("Planner")
    expect(plannerFeatures.map((f) => f.id)).toEqual(["workout_planner", "diet_planner"])
    expect(getFeaturesByCategory("UnknownCategory")).toEqual([])
  })
})
