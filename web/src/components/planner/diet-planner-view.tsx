import * as React from "react"
import { Check, Plus, Trash2, UtensilsCrossed } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  deleteMeal,
  fetchUserMeals,
  saveMeal,
  type MealItem,
} from "@/lib/planner/workout-diet-service"

interface DietPlannerViewProps {
  userId: string
  selectedDate: string
}

const MEAL_TYPES: Array<{ id: MealItem["mealType"]; label: string }> = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "snack", label: "Snacks" },
]

export function DietPlannerView({ userId, selectedDate }: DietPlannerViewProps) {
  const [meals, setMeals] = React.useState<MealItem[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [newMealType, setNewMealType] = React.useState<MealItem["mealType"]>("breakfast")
  const [newName, setNewName] = React.useState("")
  const [newNotes, setNewNotes] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const loadData = React.useCallback(async () => {
    if (!userId) return
    setIsLoading(true)
    try {
      const data = await fetchUserMeals(userId, selectedDate)
      setMeals(data)
    } finally {
      setIsLoading(false)
    }
  }, [userId, selectedDate])

  React.useEffect(() => {
    void loadData()
  }, [loadData])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !userId || isSubmitting) return

    setIsSubmitting(true)
    try {
      const created = await saveMeal({
        id: crypto.randomUUID(),
        userId,
        date: selectedDate,
        mealType: newMealType,
        name: newName.trim(),
        notes: newNotes.trim() || undefined,
        completed: false,
      })

      setMeals((prev) => [...prev, created])
      setNewName("")
      setNewNotes("")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggle = async (meal: MealItem) => {
    const updated = { ...meal, completed: !meal.completed }
    setMeals((prev) => prev.map((m) => (m.id === meal.id ? updated : m)))
    await saveMeal(updated)
  }

  const handleDelete = async (mealId: string) => {
    setMeals((prev) => prev.filter((m) => m.id !== mealId))
    await deleteMeal(mealId, userId)
  }

  return (
    <div className="space-y-6" data-testid="diet-planner-view">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/50">
        <div>
          <h2 className="text-lg font-heading font-bold text-foreground flex items-center gap-2">
            <UtensilsCrossed className="size-5 text-primary" aria-hidden="true" />
            Diet Planner
          </h2>
          <p className="text-xs text-muted-foreground">
            Plan daily meals and nutrition for {selectedDate}
          </p>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {meals.filter((m) => m.completed).length} / {meals.length} logged
        </span>
      </div>

      {/* Add Meal Form */}
      <form
        onSubmit={handleCreate}
        className="p-4 rounded-xl border border-border/80 bg-card/60 space-y-3 shadow-2xs"
      >
        <span className="text-xs font-semibold text-foreground block">
          Add Planned Meal
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <select
            value={newMealType}
            onChange={(e) => setNewMealType(e.target.value as MealItem["mealType"])}
            className="h-9 px-2.5 rounded-lg border border-border bg-background text-xs font-medium text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            aria-label="Meal type"
          >
            {MEAL_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Meal description (e.g. Oatmeal with berries)"
            className="sm:col-span-3 h-9 px-3 rounded-lg border border-border bg-background text-xs md:text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            aria-label="Meal item name"
          />
        </div>
        <input
          type="text"
          value={newNotes}
          onChange={(e) => setNewNotes(e.target.value)}
          placeholder="Optional nutrition notes (e.g. 500 kcal, high protein)"
          className="w-full h-8 px-3 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          aria-label="Meal notes"
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={!newName.trim() || isSubmitting}
            className="text-xs font-medium gap-1.5"
          >
            <Plus className="size-3.5" />
            Add Meal
          </Button>
        </div>
      </form>

      {/* Meals Grouped by Type */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-xs text-muted-foreground animate-pulse">
            Loading meal plan...
          </div>
        ) : (
          MEAL_TYPES.map((typeObj) => {
            const groupMeals = meals.filter((m) => m.mealType === typeObj.id)
            return (
              <div
                key={typeObj.id}
                className="p-3.5 rounded-xl border border-border/70 bg-card/40 space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span>{typeObj.label}</span>
                  <span className="text-[11px] font-normal text-muted-foreground">
                    {groupMeals.length} item{groupMeals.length === 1 ? "" : "s"}
                  </span>
                </div>

                {groupMeals.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic py-1">
                    No {typeObj.label.toLowerCase()} planned.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {groupMeals.map((meal) => (
                      <div
                        key={meal.id}
                        className={`p-2.5 rounded-lg border transition-all flex items-center justify-between gap-2.5 ${
                          meal.completed
                            ? "bg-muted/30 border-border/40 opacity-75"
                            : "bg-background border-border/70 shadow-2xs"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={meal.completed}
                            onClick={() => handleToggle(meal)}
                            className={`size-4 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                              meal.completed
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-muted-foreground/40 hover:border-foreground"
                            }`}
                            aria-label={`Mark ${meal.name} as ${meal.completed ? "uncompleted" : "completed"}`}
                          >
                            {meal.completed && <Check className="size-2.5" />}
                          </button>
                          <div className="min-w-0">
                            <span
                              className={`text-xs block truncate ${
                                meal.completed
                                  ? "line-through text-muted-foreground"
                                  : "text-foreground font-medium"
                              }`}
                            >
                              {meal.name}
                            </span>
                            {meal.notes && (
                              <span className="text-[10px] text-muted-foreground block truncate">
                                {meal.notes}
                              </span>
                            )}
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleDelete(meal.id)}
                          className="text-muted-foreground hover:text-destructive shrink-0 size-6 p-0"
                          aria-label={`Delete ${meal.name}`}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
