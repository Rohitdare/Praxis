import type { DayActivity, PlannerTask, WeeklyStats } from "./types"

const DAY_NAMES: DayActivity["day"][] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

/**
 * Returns the Monday for the week containing the given date.
 * Weeks strictly start on Monday.
 */
export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  // Distance to Monday: if Sunday (0), Monday was 6 days ago; otherwise day - 1
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Returns the Sunday for the week containing the given date.
 * Weeks strictly end on Sunday 23:59:59.999.
 */
export function getSundayOfWeek(date: Date): Date {
  const monday = getMondayOfWeek(date)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return sunday
}

/**
 * Formats a Date object to YYYY-MM-DD string.
 */
export function formatLocalDateString(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Returns an array of 7 dates (Monday through Sunday) for the given reference date.
 */
export function getWeekDates(referenceDate: Date): Date[] {
  const monday = getMondayOfWeek(referenceDate)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

/**
 * Checks whether a given ISO date-time string falls within a date (YYYY-MM-DD).
 */
export function isSameDay(isoString: string | null | undefined, targetDateStr: string): boolean {
  if (!isoString) return false
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return false
    return formatLocalDateString(d) === targetDateStr
  } catch {
    return false
  }
}

/**
 * Pure calculation function for weekly metrics.
 * 
 * Rules:
 * - Tasks Planned (P): Tasks whose due_at falls in [weekStart, weekEnd]
 * - Tasks Completed (C): Tasks whose completed_at falls in [weekStart, weekEnd]
 * - Completion Rate: Completed tasks that were planned for this week divided by Tasks Planned.
 *   If P = 0 and C > 0: 100%. If P = 0 and C = 0: 0%.
 *   Rate never exceeds 100%.
 * - Outstanding Tasks: Planned tasks for the week that are not completed.
 * - Overdue Tasks: Tasks planned on or before today whose due date has passed and are still active.
 */
export function calculateWeeklyStats(
  plannedTasks: PlannerTask[],
  completedTasks: PlannerTask[],
  weekStartDate: Date,
  referenceNow: Date = new Date()
): WeeklyStats {
  const weekStartStr = formatLocalDateString(getMondayOfWeek(weekStartDate))
  const weekEndStr = formatLocalDateString(getSundayOfWeek(weekStartDate))
  const weekDates = getWeekDates(weekStartDate)

  const tasksPlanned = plannedTasks.length
  const tasksCompleted = completedTasks.length

  // Planned tasks that are completed
  const plannedAndCompleted = plannedTasks.filter(
    (t) => t.status === "done" && t.completedAt !== null
  ).length

  // Completion Rate: plannedAndCompleted / tasksPlanned (capped at 100%)
  let completionRate = 0
  if (tasksPlanned > 0) {
    completionRate = Math.min(100, Math.round((plannedAndCompleted / tasksPlanned) * 100))
  } else if (tasksCompleted > 0) {
    completionRate = 100
  }

  // Outstanding tasks: planned for this week and still active
  const outstandingTasks = plannedTasks.filter((t) => t.status === "active").length

  // Overdue tasks: planned for this week on or before now and still active
  const nowMs = referenceNow.getTime()
  const overdueTasks = plannedTasks.filter((t) => {
    if (t.status !== "active" || !t.dueAt) return false
    const dueMs = new Date(t.dueAt).getTime()
    return dueMs < nowMs
  }).length

  // Daily activity breakdown for Mon-Sun
  const dailyActivity: DayActivity[] = weekDates.map((dateObj, idx) => {
    const dateStr = formatLocalDateString(dateObj)
    const dayName = DAY_NAMES[idx]

    const completedOnDay = completedTasks.filter((t) => isSameDay(t.completedAt, dateStr)).length
    const plannedOnDay = plannedTasks.filter((t) => isSameDay(t.dueAt, dateStr)).length
    const outstandingOnDay = plannedTasks.filter(
      (t) => isSameDay(t.dueAt, dateStr) && t.status === "active"
    ).length

    return {
      day: dayName,
      date: dateStr,
      completedCount: completedOnDay,
      plannedCount: plannedOnDay,
      outstandingCount: outstandingOnDay,
    }
  })

  return {
    weekStart: weekStartStr,
    weekEnd: weekEndStr,
    tasksPlanned,
    tasksCompleted,
    completionRate,
    outstandingTasks,
    overdueTasks,
    dailyActivity,
  }
}
