import { db } from "@/lib/db/index"
import type { LocalItem, OutboxRecord } from "@/lib/db/schema"

export interface WorkoutExercise {
  id: string
  name: string
  setsReps?: string
}

export interface WorkoutItem {
  id: string
  userId: string
  title: string
  exercises: string[]
  completed: boolean
  scheduledDate: string | null // YYYY-MM-DD or null for reusable routine
  createdAt: string
}

export interface MealItem {
  id: string
  userId: string
  date: string // YYYY-MM-DD
  mealType: "breakfast" | "lunch" | "dinner" | "snack"
  name: string
  notes?: string
  completed: boolean
  createdAt: string
}

/**
 * Fetch workouts for a specific user.
 * Optionally filter by date or get reusable routines.
 */
export async function fetchUserWorkouts(
  userId: string,
  date?: string
): Promise<WorkoutItem[]> {
  if (!userId) return []

  const items = await db.local_items
    .where("user_id")
    .equals(userId)
    .filter((i) => Boolean(i.ai_tags?.includes("Workout") && !i.deleted_at))
    .toArray()

  return items
    .map((item) => {
      let parsedExercises: string[] = []
      let scheduledDate: string | null = null

      if (item.content) {
        try {
          const payload = JSON.parse(item.content)
          if (Array.isArray(payload.exercises)) {
            parsedExercises = payload.exercises
          }
          if (payload.scheduledDate) {
            scheduledDate = payload.scheduledDate
          }
        } catch {
          // If not JSON, split by lines
          parsedExercises = item.content.split("\n").filter(Boolean)
        }
      }

      return {
        id: item.id,
        userId: item.user_id || userId,
        title: item.title || item.raw_input || "Untitled Workout",
        exercises: parsedExercises,
        completed: item.status === "done",
        scheduledDate,
        createdAt: item.created_at,
      }
    })
    .filter((w) => {
      if (!date) return true
      return w.scheduledDate === date || !w.scheduledDate
    })
}

/**
 * Create or update a workout routine/session.
 */
export async function saveWorkout(
  workout: Omit<WorkoutItem, "createdAt"> & { createdAt?: string }
): Promise<WorkoutItem> {
  const now = new Date().toISOString()
  const workoutId = workout.id || crypto.randomUUID()
  const createdAt = workout.createdAt || now

  const payloadContent = JSON.stringify({
    exercises: workout.exercises,
    scheduledDate: workout.scheduledDate,
  })

  const rawInput = `Workout: ${workout.title}`

  const localItem: LocalItem = {
    id: workoutId,
    user_id: workout.userId,
    raw_input: rawInput,
    title: workout.title,
    content: payloadContent,
    type: "task",
    status: workout.completed ? "done" : "active",
    captured_at: createdAt,
    created_at: createdAt,
    updated_at: now,
    deleted_at: null,
    ai_tags: ["Workout"],
    synced: false,
  }

  const outboxRecord: OutboxRecord = {
    id: crypto.randomUUID(),
    item_id: workoutId,
    user_id: workout.userId,
    operation: workout.id ? "update" : "insert",
    payload: localItem,
    status: "pending",
    created_at: now,
    updated_at: now,
    retry_count: 0,
    last_error: null,
  }

  await db.transaction("rw", [db.local_items, db.outbox], async () => {
    await db.local_items.put(localItem)
    await db.outbox.put(outboxRecord)
  })

  return {
    ...workout,
    id: workoutId,
    createdAt,
  }
}

/**
 * Delete a workout item (soft delete).
 */
export async function deleteWorkout(workoutId: string, userId: string): Promise<void> {
  const existing = await db.local_items.get(workoutId)
  if (!existing || existing.user_id !== userId) return

  const now = new Date().toISOString()
  const updatedItem: LocalItem = {
    ...existing,
    deleted_at: now,
    updated_at: now,
    synced: false,
  }

  const outboxRecord: OutboxRecord = {
    id: crypto.randomUUID(),
    item_id: workoutId,
    user_id: userId,
    operation: "delete",
    payload: updatedItem,
    status: "pending",
    created_at: now,
    updated_at: now,
    retry_count: 0,
    last_error: null,
  }

  await db.transaction("rw", [db.local_items, db.outbox], async () => {
    await db.local_items.put(updatedItem)
    await db.outbox.put(outboxRecord)
  })
}

/**
 * Fetch meal plans for a specific user and date.
 */
export async function fetchUserMeals(userId: string, date: string): Promise<MealItem[]> {
  if (!userId) return []

  const items = await db.local_items
    .where("user_id")
    .equals(userId)
    .filter((i) => Boolean(i.ai_tags?.includes("Diet") && !i.deleted_at))
    .toArray()

  return items
    .map((item) => {
      let mealType: MealItem["mealType"] = "breakfast"
      let mealDate = date
      let notes: string | undefined

      if (item.content) {
        try {
          const payload = JSON.parse(item.content)
          if (payload.mealType) mealType = payload.mealType
          if (payload.date) mealDate = payload.date
          if (payload.notes) notes = payload.notes
        } catch {
          notes = item.content
        }
      }

      return {
        id: item.id,
        userId: item.user_id || userId,
        date: mealDate,
        mealType,
        name: item.title || item.raw_input || "Untitled Meal",
        notes,
        completed: item.status === "done",
        createdAt: item.created_at,
      }
    })
    .filter((m) => m.date === date)
}

/**
 * Create or update a meal item.
 */
export async function saveMeal(
  meal: Omit<MealItem, "createdAt"> & { createdAt?: string }
): Promise<MealItem> {
  const now = new Date().toISOString()
  const mealId = meal.id || crypto.randomUUID()
  const createdAt = meal.createdAt || now

  const payloadContent = JSON.stringify({
    date: meal.date,
    mealType: meal.mealType,
    notes: meal.notes || null,
  })

  const rawInput = `Meal (${meal.mealType}): ${meal.name}`

  const localItem: LocalItem = {
    id: mealId,
    user_id: meal.userId,
    raw_input: rawInput,
    title: meal.name,
    content: payloadContent,
    type: "note",
    status: meal.completed ? "done" : "active",
    captured_at: createdAt,
    created_at: createdAt,
    updated_at: now,
    deleted_at: null,
    ai_tags: ["Diet"],
    synced: false,
  }

  const outboxRecord: OutboxRecord = {
    id: crypto.randomUUID(),
    item_id: mealId,
    user_id: meal.userId,
    operation: meal.id ? "update" : "insert",
    payload: localItem,
    status: "pending",
    created_at: now,
    updated_at: now,
    retry_count: 0,
    last_error: null,
  }

  await db.transaction("rw", [db.local_items, db.outbox], async () => {
    await db.local_items.put(localItem)
    await db.outbox.put(outboxRecord)
  })

  return {
    ...meal,
    id: mealId,
    createdAt,
  }
}

/**
 * Delete a meal item (soft delete).
 */
export async function deleteMeal(mealId: string, userId: string): Promise<void> {
  const existing = await db.local_items.get(mealId)
  if (!existing || existing.user_id !== userId) return

  const now = new Date().toISOString()
  const updatedItem: LocalItem = {
    ...existing,
    deleted_at: now,
    updated_at: now,
    synced: false,
  }

  const outboxRecord: OutboxRecord = {
    id: crypto.randomUUID(),
    item_id: mealId,
    user_id: userId,
    operation: "delete",
    payload: updatedItem,
    status: "pending",
    created_at: now,
    updated_at: now,
    retry_count: 0,
    last_error: null,
  }

  await db.transaction("rw", [db.local_items, db.outbox], async () => {
    await db.local_items.put(updatedItem)
    await db.outbox.put(outboxRecord)
  })
}
