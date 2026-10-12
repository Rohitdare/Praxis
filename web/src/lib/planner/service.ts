import type { SupabaseClient } from "@supabase/supabase-js"
import { db, type PersonalMemoryDB } from "@/lib/db/index"
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client"
import { softDeleteItem } from "@/lib/inbox/service"
import { calculateWeeklyStats, formatLocalDateString, getMondayOfWeek, getSundayOfWeek, isSameDay } from "./stats"
import type { CreatePlannerTaskParams, DailyPlannerData, PlannerTask, WeeklyStats } from "./types"

export interface PlannerServiceOptions {
  supabaseClient?: SupabaseClient
  database?: PersonalMemoryDB
  now?: Date
  isOffline?: boolean
}

interface TaskQueryRow {
  item_id: string
  due_at: string | null
  priority: "low" | "normal" | "high"
  completed_at: string | null
  created_at: string
  updated_at: string
  items: {
    title: string | null
    content: string | null
    status: string | null
    deleted_at: string | null
  } | null
}

function mapRowToPlannerTask(row: TaskQueryRow, referenceNow: Date): PlannerTask {
  const isDone = row.items?.status === "done" || row.completed_at !== null
  const nowMs = referenceNow.getTime()
  const isOverdue = !isDone && Boolean(row.due_at && new Date(row.due_at).getTime() < nowMs)

  return {
    id: row.item_id,
    userId: "",
    title: row.items?.title || "Untitled Task",
    content: row.items?.content || null,
    status: isDone ? "done" : "active",
    priority: row.priority || "normal",
    dueAt: row.due_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isOverdue,
  }
}

/**
 * Fetches tasks for a specific date (YYYY-MM-DD), along with any active overdue tasks.
 * Offline-first: Falls back to Dexie local_items when offline or Supabase is unavailable.
 */
export async function fetchDailyPlannerData(
  userId: string,
  targetDate: string | Date = new Date(),
  options: PlannerServiceOptions = {}
): Promise<DailyPlannerData> {
  const targetDateStr =
    typeof targetDate === "string" ? targetDate : formatLocalDateString(targetDate)

  if (!userId) {
    return {
      date: targetDateStr,
      tasks: [],
      overdueTasks: [],
      completedTodayCount: 0,
      plannedTodayCount: 0,
    }
  }

  const client = options.supabaseClient || supabase
  const database = options.database || db
  const refNow = options.now || new Date()
  const isOffline =
    options.isOffline ?? (typeof navigator !== "undefined" && !navigator.onLine)

  if (isOffline || !isSupabaseConfigured) {
    return fetchDailyPlannerDataOffline(userId, targetDateStr, database, refNow)
  }

  try {
    // 1. Fetch all non-deleted task items for the authenticated user
    const { data, error } = await client
      .from("tasks")
      .select(`
        item_id,
        due_at,
        priority,
        completed_at,
        created_at,
        updated_at,
        items!inner (
          title,
          content,
          status,
          deleted_at
        )
      `)
      .eq("user_id", userId)
      .is("items.deleted_at", null)
      .order("created_at", { ascending: true })

    if (error) {
      console.warn("Failed to fetch daily tasks from Supabase, falling back to local DB:", error.message)
      return fetchDailyPlannerDataOffline(userId, targetDateStr, database, refNow)
    }

    const rows = (data as unknown as TaskQueryRow[]) || []
    const allTasks = rows.map((r) => mapRowToPlannerTask(r, refNow))

    // Tasks scheduled for today or completed today
    const scheduledForDate = allTasks.filter(
      (t) => isSameDay(t.dueAt, targetDateStr) || (t.status === "done" && isSameDay(t.completedAt, targetDateStr))
    )

    // Overdue tasks: active tasks whose due date was strictly before targetDateStr (start of day)
    const targetDateStartMs = new Date(`${targetDateStr}T00:00:00`).getTime()
    const overdueTasks = allTasks.filter((t) => {
      if (t.status === "done" || !t.dueAt) return false
      const taskDueMs = new Date(t.dueAt).getTime()
      return taskDueMs < targetDateStartMs
    })

    const completedTodayCount = scheduledForDate.filter((t) => t.status === "done").length
    const plannedTodayCount = scheduledForDate.filter((t) => isSameDay(t.dueAt, targetDateStr)).length

    return {
      date: targetDateStr,
      tasks: scheduledForDate,
      overdueTasks,
      completedTodayCount,
      plannedTodayCount,
    }
  } catch (err) {
    console.warn("Error in fetchDailyPlannerData, falling back to local DB:", err)
    return fetchDailyPlannerDataOffline(userId, targetDateStr, database, refNow)
  }
}

async function fetchDailyPlannerDataOffline(
  userId: string,
  targetDateStr: string,
  database: PersonalMemoryDB,
  refNow: Date
): Promise<DailyPlannerData> {
  const localItems = await database.local_items
    .where("user_id")
    .equals(userId)
    .and((item) => item.type === "task" && item.deleted_at === null)
    .toArray()

  const tasks: PlannerTask[] = localItems.map((item) => {
    const isDone = item.status === "done"
    const isOverdue = !isDone && Boolean(item.captured_at && new Date(item.captured_at).getTime() < refNow.getTime())
    return {
      id: item.id,
      userId: item.user_id || userId,
      title: item.title || item.raw_input || "Untitled Task",
      content: item.content || null,
      status: isDone ? "done" : "active",
      priority: "normal",
      dueAt: item.captured_at,
      completedAt: isDone ? item.updated_at : null,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      isOverdue,
    }
  })

  const scheduled = tasks.filter((t) => isSameDay(t.dueAt, targetDateStr))
  const completedTodayCount = scheduled.filter((t) => t.status === "done").length

  return {
    date: targetDateStr,
    tasks: scheduled,
    overdueTasks: [],
    completedTodayCount,
    plannedTodayCount: scheduled.length,
  }
}

/**
 * Creates a new task directly from the planner using the idempotent RPC.
 */
export async function createPlannerTask(
  params: CreatePlannerTaskParams,
  options: PlannerServiceOptions = {}
): Promise<PlannerTask> {
  const title = params.title.trim()
  if (!title) {
    throw new Error("Task title cannot be empty")
  }

  const itemId = params.itemId || crypto.randomUUID()
  const client = options.supabaseClient || supabase
  const database = options.database || db
  const priority = params.priority || "normal"
  const dueAt = params.dueAt || null
  const now = (options.now || new Date()).toISOString()

  // 1. Invoke atomic PostgreSQL RPC
  const { error } = await client.rpc("classify_and_update_item", {
    p_item_id: itemId,
    p_type: "task",
    p_title: title,
    p_content: params.content?.trim() || null,
    p_status: "active",
    p_priority: priority,
    p_due_at: dueAt,
    p_completed_at: null,
    p_url: null,
    p_domain: null,
    p_resource_status: null,
    p_start_at: null,
    p_end_at: null,
    p_all_day: false,
  })

  if (error) {
    console.error("Failed to create planner task via RPC:", error.message)
    throw new Error(`Failed to create task: ${error.message}`)
  }

  // 2. Write to local IndexedDB for immediate responsiveness
  try {
    await database.local_items.put({
      id: itemId,
      user_id: params.userId,
      raw_input: title,
      captured_at: now,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      type: "task",
      status: "active",
      title,
      content: params.content?.trim() || null,
      synced: true,
    })
  } catch {
    // Non-fatal
  }

  return {
    id: itemId,
    userId: params.userId,
    title,
    content: params.content?.trim() || null,
    status: "active",
    priority,
    dueAt,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    isOverdue: false,
  }
}

/**
 * Toggles a task's completion state.
 * When completed: status = 'done', completed_at = now()
 * When reopened: status = 'active', completed_at = null
 */
export async function toggleTaskCompletion(
  itemId: string,
  userId: string,
  completed: boolean,
  options: PlannerServiceOptions = {}
): Promise<{ status: "active" | "done"; completedAt: string | null }> {
  if (!itemId || !userId) {
    throw new Error("Item ID and User ID are required to toggle task completion")
  }

  const client = options.supabaseClient || supabase
  const database = options.database || db
  const completedAt = completed ? (options.now || new Date()).toISOString() : null
  const status: "active" | "done" = completed ? "done" : "active"
  const now = (options.now || new Date()).toISOString()

  // 1. Update tasks table (completed_at) and items table (status)
  const { error: taskErr } = await client
    .from("tasks")
    .update({
      completed_at: completedAt,
      updated_at: now,
    })
    .eq("item_id", itemId)
    .eq("user_id", userId)

  if (taskErr) {
    throw new Error(`Failed to update task completion: ${taskErr.message}`)
  }

  const { error: itemErr } = await client
    .from("items")
    .update({
      status,
      updated_at: now,
    })
    .eq("id", itemId)
    .eq("user_id", userId)

  if (itemErr) {
    throw new Error(`Failed to update item status: ${itemErr.message}`)
  }

  // 2. Update local Dexie record
  try {
    const existing = await database.local_items.get(itemId)
    if (existing) {
      await database.local_items.update(itemId, {
        status,
        updated_at: now,
      })
    }
  } catch {
    // Non-fatal
  }

  return { status, completedAt }
}

/**
 * Carries an unfinished or overdue task forward to a new target due date.
 */
export async function carryTaskForward(
  itemId: string,
  userId: string,
  newDueDate: string | Date,
  options: PlannerServiceOptions = {}
): Promise<void> {
  if (!itemId || !userId || !newDueDate) {
    throw new Error("Item ID, User ID, and target due date are required")
  }

  const client = options.supabaseClient || supabase
  const now = (options.now || new Date()).toISOString()
  const dueAtISO = typeof newDueDate === "string" ? newDueDate : newDueDate.toISOString()

  const { error } = await client
    .from("tasks")
    .update({
      due_at: dueAtISO,
      updated_at: now,
    })
    .eq("item_id", itemId)
    .eq("user_id", userId)

  if (error) {
    throw new Error(`Failed to reschedule task: ${error.message}`)
  }
}

/**
 * Soft deletes a task via existing inbox softDeleteItem service.
 */
export async function deletePlannerTask(
  itemId: string,
  userId?: string,
  options: PlannerServiceOptions = {}
): Promise<void> {
  const client = options.supabaseClient || supabase
  const database = options.database || db
  await softDeleteItem(itemId, {
    supabaseClient: client,
    database,
    userId,
  })
}

/**
 * Fetches weekly productivity statistics for the week containing referenceDate.
 */
export async function fetchWeeklyProductivityStats(
  userId: string,
  referenceDate: Date,
  options: PlannerServiceOptions = {}
): Promise<WeeklyStats> {
  const client = options.supabaseClient || supabase
  const refNow = options.now || new Date()
  const monday = getMondayOfWeek(referenceDate)
  const sunday = getSundayOfWeek(referenceDate)

  const mondayISO = monday.toISOString()
  const sundayISO = sunday.toISOString()

  if (!userId || !isSupabaseConfigured) {
    return calculateWeeklyStats([], [], referenceDate, refNow)
  }

  try {
    // 1. Fetch tasks planned for this week (due_at between monday and sunday)
    const { data: plannedData, error: plannedErr } = await client
      .from("tasks")
      .select(`
        item_id,
        due_at,
        priority,
        completed_at,
        created_at,
        updated_at,
        items!inner (
          title,
          content,
          status,
          deleted_at
        )
      `)
      .eq("user_id", userId)
      .is("items.deleted_at", null)
      .gte("due_at", mondayISO)
      .lte("due_at", sundayISO)

    if (plannedErr) {
      console.warn("Error querying planned weekly tasks:", plannedErr.message)
    }

    // 2. Fetch tasks completed in this week (completed_at between monday and sunday)
    const { data: completedData, error: completedErr } = await client
      .from("tasks")
      .select(`
        item_id,
        due_at,
        priority,
        completed_at,
        created_at,
        updated_at,
        items!inner (
          title,
          content,
          status,
          deleted_at
        )
      `)
      .eq("user_id", userId)
      .is("items.deleted_at", null)
      .gte("completed_at", mondayISO)
      .lte("completed_at", sundayISO)

    if (completedErr) {
      console.warn("Error querying completed weekly tasks:", completedErr.message)
    }

    const plannedRows = (plannedData as unknown as TaskQueryRow[]) || []
    const completedRows = (completedData as unknown as TaskQueryRow[]) || []

    const plannedTasks = plannedRows.map((r) => mapRowToPlannerTask(r, refNow))
    const completedTasks = completedRows.map((r) => mapRowToPlannerTask(r, refNow))

    return calculateWeeklyStats(plannedTasks, completedTasks, referenceDate, refNow)
  } catch (err) {
    console.warn("Error calculating weekly productivity stats:", err)
    return calculateWeeklyStats([], [], referenceDate, refNow)
  }
}
