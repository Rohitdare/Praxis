export type FeatureId = "workout_planner" | "diet_planner" | (string & {})

export interface FeatureDefinition {
  id: FeatureId
  name: string
  description: string
  defaultEnabled: boolean
  navigationTarget: string
  category: "Planner" | (string & {})
  status: "available" | "unavailable"
}

export type FeaturePreferences = Record<string, boolean>
