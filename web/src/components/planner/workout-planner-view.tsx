import * as React from "react"
import { Check, Dumbbell, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  deleteWorkout,
  fetchUserWorkouts,
  saveWorkout,
  type WorkoutItem,
} from "@/lib/planner/workout-diet-service"

interface WorkoutPlannerViewProps {
  userId: string
  selectedDate?: string
}

export function WorkoutPlannerView({ userId, selectedDate }: WorkoutPlannerViewProps) {
  const [workouts, setWorkouts] = React.useState<WorkoutItem[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [newTitle, setNewTitle] = React.useState("")
  const [newExercises, setNewExercises] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const loadData = React.useCallback(async () => {
    if (!userId) return
    setIsLoading(true)
    try {
      const data = await fetchUserWorkouts(userId, selectedDate)
      setWorkouts(data)
    } finally {
      setIsLoading(false)
    }
  }, [userId, selectedDate])

  React.useEffect(() => {
    void loadData()
  }, [loadData])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || !userId || isSubmitting) return

    setIsSubmitting(true)
    try {
      const exerciseList = newExercises
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)

      const created = await saveWorkout({
        id: crypto.randomUUID(),
        userId,
        title: newTitle.trim(),
        exercises: exerciseList,
        completed: false,
        scheduledDate: selectedDate || null,
      })

      setWorkouts((prev) => [created, ...prev])
      setNewTitle("")
      setNewExercises("")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggle = async (item: WorkoutItem) => {
    const updated = { ...item, completed: !item.completed }
    setWorkouts((prev) => prev.map((w) => (w.id === item.id ? updated : w)))
    await saveWorkout(updated)
  }

  const handleDelete = async (workoutId: string) => {
    setWorkouts((prev) => prev.filter((w) => w.id !== workoutId))
    await deleteWorkout(workoutId, userId)
  }

  return (
    <div className="space-y-6" data-testid="workout-planner-view">
      {/* Header Info */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/50">
        <div>
          <h2 className="text-lg font-heading font-bold text-foreground flex items-center gap-2">
            <Dumbbell className="size-5 text-primary" aria-hidden="true" />
            Workout Planner
          </h2>
          <p className="text-xs text-muted-foreground">
            {selectedDate
              ? `Plan routines and sessions for ${selectedDate}`
              : "Organize training routines and daily workout sessions"}
          </p>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {workouts.filter((w) => w.completed).length} / {workouts.length} completed
        </span>
      </div>

      {/* Add Routine Form */}
      <form
        onSubmit={handleCreate}
        className="p-4 rounded-xl border border-border/80 bg-card/60 space-y-3 shadow-2xs"
      >
        <span className="text-xs font-semibold text-foreground block">
          Add Workout Routine or Session
        </span>
        <div className="space-y-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Routine name (e.g. Upper Body Strength, Morning 5k Run)"
            className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs md:text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            aria-label="Workout routine title"
          />
          <textarea
            rows={2}
            value={newExercises}
            onChange={(e) => setNewExercises(e.target.value)}
            placeholder="Exercises or notes (one per line, e.g. Bench Press 3x10)"
            className="w-full p-2.5 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
            aria-label="Workout exercises list"
          />
        </div>
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={!newTitle.trim() || isSubmitting}
            className="text-xs font-medium gap-1.5"
          >
            <Plus className="size-3.5" />
            Add Workout
          </Button>
        </div>
      </form>

      {/* Workouts List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-xs text-muted-foreground animate-pulse">
            Loading workouts...
          </div>
        ) : workouts.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-dashed border-border/70 text-xs text-muted-foreground">
            No workouts scheduled yet. Add a routine above to get started.
          </div>
        ) : (
          workouts.map((workout) => (
            <div
              key={workout.id}
              className={`p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                workout.completed
                  ? "bg-muted/30 border-border/40 opacity-75"
                  : "bg-card border-border/80 shadow-2xs"
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={workout.completed}
                  onClick={() => handleToggle(workout)}
                  className={`size-4.5 rounded-md border mt-0.5 flex items-center justify-center transition-colors shrink-0 ${
                    workout.completed
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-muted-foreground/40 hover:border-foreground"
                  }`}
                  aria-label={`Mark ${workout.title} as ${workout.completed ? "incomplete" : "complete"}`}
                >
                  {workout.completed && <Check className="size-3" />}
                </button>
                <div className="space-y-1 min-w-0">
                  <span
                    className={`font-medium text-xs sm:text-sm block truncate ${
                      workout.completed ? "line-through text-muted-foreground" : "text-foreground"
                    }`}
                  >
                    {workout.title}
                  </span>
                  {workout.exercises.length > 0 && (
                    <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc list-inside">
                      {workout.exercises.map((ex, idx) => (
                        <li key={idx} className="truncate">
                          {ex}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => handleDelete(workout.id)}
                className="text-muted-foreground hover:text-destructive shrink-0"
                aria-label={`Delete ${workout.title}`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
