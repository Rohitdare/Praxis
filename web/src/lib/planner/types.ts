import type { TaskPriority } from "@/lib/supabase/database.types"

export type { TaskPriority }

export interface PlannerTask {
  id: string
  userId: string
  title: string
  content: string | null
  status: "active" | "done"
  priority: TaskPriority
  dueAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  isOverdue: boolean
}

export interface CreatePlannerTaskParams {
  userId: string
  title: string
  dueAt?: string | null
  priority?: TaskPriority
  content?: string | null
  itemId?: string
}

export interface DayActivity {
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun"
  date: string // YYYY-MM-DD
  completedCount: number
  plannedCount: number
  outstandingCount: number
}

export interface WeeklyStats {
  weekStart: string // YYYY-MM-DD
  weekEnd: string // YYYY-MM-DD
  tasksPlanned: number
  tasksCompleted: number
  completionRate: number // 0 - 100
  outstandingTasks: number
  overdueTasks: number
  dailyActivity: DayActivity[]
}

export interface DailyPlannerData {
  date: string // YYYY-MM-DD
  tasks: PlannerTask[]
  overdueTasks: PlannerTask[]
  completedTodayCount: number
  plannedTodayCount: number
}
