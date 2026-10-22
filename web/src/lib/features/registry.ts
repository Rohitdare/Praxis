import type { FeatureDefinition } from "./types"

/**
 * Centralized Feature Registry
 * Single source of truth for all optional modules and expandable features in Praxis.
 * To register a new feature, add its metadata here.
 */
export const FEATURE_REGISTRY: Record<string, FeatureDefinition> = {
  workout_planner: {
    id: "workout_planner",
    name: "Workout Planner",
    description: "Create workout routines and organize training sessions.",
    defaultEnabled: false,
    navigationTarget: "/planner/workouts",
    category: "Planner",
    status: "available",
  },
  diet_planner: {
    id: "diet_planner",
    name: "Diet Planner",
    description: "Plan meals and organize daily nutrition.",
    defaultEnabled: false,
    navigationTarget: "/planner/diet",
    category: "Planner",
    status: "available",
  },
  expense_tracker: {
    id: "expense_tracker",
    name: "Expense Tracker",
    description: "Track daily expenses, payment accounts, and monthly budgets.",
    defaultEnabled: false,
    navigationTarget: "/planner/expenses",
    category: "Planner",
    status: "available",
  },
}

/**
 * Get all registered features in registry order
 */
export function getAllFeatures(): FeatureDefinition[] {
  return Object.values(FEATURE_REGISTRY)
}

/**
 * Look up a feature definition by ID
 */
export function getFeature(id: string): FeatureDefinition | undefined {
  return FEATURE_REGISTRY[id]
}

/**
 * Resolves whether a feature is enabled by default for new users or when preference is unconfigured
 */
export function isFeatureDefaultEnabled(id: string): boolean {
  const feat = FEATURE_REGISTRY[id]
  return feat ? feat.defaultEnabled : false
}

/**
 * Get registered features filtered by category (e.g., 'Planner')
 */
export function getFeaturesByCategory(category: string): FeatureDefinition[] {
  return getAllFeatures().filter((f) => f.category === category && f.status === "available")
}
