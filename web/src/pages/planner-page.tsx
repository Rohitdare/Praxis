import * as React from "react"
import { AlertCircle, WifiOff } from "lucide-react"
import { useAuth } from "@/lib/auth/auth-context"
import {
  carryTaskForward,
  createPlannerTask,
  deletePlannerTask,
  fetchDailyPlannerData,
  fetchWeeklyProductivityStats,
  toggleTaskCompletion,
} from "@/lib/planner/service"
import { calculateWeeklyStats, formatLocalDateString } from "@/lib/planner/stats"
import type { DailyPlannerData, PlannerTask, TaskPriority, WeeklyStats } from "@/lib/planner/types"
import { PlannerHeader } from "@/components/planner/planner-header"
import { RolloverBanner } from "@/components/planner/rollover-banner"
import { TaskListSection } from "@/components/planner/task-list-section"
import { TaskQuickAdd } from "@/components/planner/task-quick-add"
import { WeeklyDashboard } from "@/components/planner/weekly-dashboard"

export function PlannerPage() {
  const { user } = useAuth()
  const userId = user?.id || ""

  const [activeTab, setActiveTab] = React.useState<"daily" | "weekly">("daily")
  const [selectedDate, setSelectedDate] = React.useState<string>(() =>
    formatLocalDateString(new Date())
  )
  const [weekReferenceDate, setWeekReferenceDate] = React.useState<Date>(() => new Date())

  const [dailyData, setDailyData] = React.useState<DailyPlannerData>(() => ({
    date: formatLocalDateString(new Date()),
    tasks: [],
    overdueTasks: [],
    completedTodayCount: 0,
    plannedTodayCount: 0,
  }))

  const [weeklyStats, setWeeklyStats] = React.useState<WeeklyStats>(() =>
    calculateWeeklyStats([], [], new Date())
  )

  const [isLoadingDaily, setIsLoadingDaily] = React.useState(true)
  const [isLoadingWeekly, setIsLoadingWeekly] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [isOffline, setIsOffline] = React.useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  )

  // Listen to browser online/offline status
  React.useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // Load Daily Tasks
  const loadDailyTasks = React.useCallback(async () => {
    if (!userId) return
    setIsLoadingDaily(true)
    setErrorMessage(null)
    try {
      const data = await fetchDailyPlannerData(userId, selectedDate)
      setDailyData(data)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load tasks")
    } finally {
      setIsLoadingDaily(false)
    }
  }, [userId, selectedDate])

  React.useEffect(() => {
    void loadDailyTasks()
  }, [loadDailyTasks])

  // Load Weekly Statistics
  const loadWeeklyStats = React.useCallback(async () => {
    if (!userId) return
    setIsLoadingWeekly(true)
    try {
      const stats = await fetchWeeklyProductivityStats(userId, weekReferenceDate)
      setWeeklyStats(stats)
    } catch (err) {
      console.warn("Error loading weekly stats:", err)
    } finally {
      setIsLoadingWeekly(false)
    }
  }, [userId, weekReferenceDate])

  React.useEffect(() => {
    if (activeTab === "weekly") {
      void loadWeeklyStats()
    }
  }, [activeTab, loadWeeklyStats])

  // Action: Add Task
  const handleAddTask = async (
    title: string,
    priority: TaskPriority,
    dueAt: string | null
  ) => {
    if (!userId) return
    const created = await createPlannerTask({
      userId,
      title,
      priority,
      dueAt,
    })

    // Immediately update local state
    setDailyData((prev) => ({
      ...prev,
      tasks: [...prev.tasks, created],
      plannedTodayCount: prev.plannedTodayCount + 1,
    }))
  }

  // Action: Toggle Task Completion
  const handleToggleComplete = async (task: PlannerTask) => {
    if (!userId) return
    const isNowDone = task.status !== "done"

    // Optimistic UI update
    setDailyData((prev) => {
      const updatedTasks = prev.tasks.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: isNowDone ? ("done" as const) : ("active" as const),
              completedAt: isNowDone ? new Date().toISOString() : null,
              isOverdue: false,
            }
          : t
      )
      const updatedOverdue = prev.overdueTasks.filter((t) => t.id !== task.id)
      const completedCount = updatedTasks.filter((t) => t.status === "done").length

      return {
        ...prev,
        tasks: updatedTasks,
        overdueTasks: updatedOverdue,
        completedTodayCount: completedCount,
      }
    })

    try {
      await toggleTaskCompletion(task.id, userId, isNowDone)
    } catch (err) {
      // Revert if failed
      void loadDailyTasks()
      setErrorMessage(err instanceof Error ? err.message : "Failed to update task")
    }
  }

  // Action: Delete Task
  const handleDeleteTask = async (taskId: string) => {
    if (!userId) return
    setDailyData((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== taskId),
      overdueTasks: prev.overdueTasks.filter((t) => t.id !== taskId),
      plannedTodayCount: Math.max(0, prev.plannedTodayCount - 1),
    }))

    try {
      await deletePlannerTask(taskId, userId)
    } catch (err) {
      void loadDailyTasks()
      setErrorMessage(err instanceof Error ? err.message : "Failed to delete task")
    }
  }

  // Action: Carry Single Task Forward
  const handleCarryForward = async (taskId: string) => {
    if (!userId) return
    const newDueDate = new Date(`${selectedDate}T12:00:00`).toISOString()
    await carryTaskForward(taskId, userId, newDueDate)
    void loadDailyTasks()
  }

  // Action: Carry All Overdue Tasks Forward to Today
  const handleCarryAllOverdue = async () => {
    if (!userId || dailyData.overdueTasks.length === 0) return
    const targetDueDate = new Date(`${selectedDate}T12:00:00`).toISOString()
    await Promise.all(
      dailyData.overdueTasks.map((t) => carryTaskForward(t.id, userId, targetDueDate))
    )
    void loadDailyTasks()
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Offline Status Notice */}
      {isOffline && (
        <div
          role="status"
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-medium"
        >
          <WifiOff className="size-4 shrink-0" />
          <span>
            Offline mode active. Viewing local tasks. Edits and cloud synchronization will resume when reconnected.
          </span>
        </div>
      )}

      {/* Header with Date Navigation & Tab Switcher */}
      <PlannerHeader
        currentDate={selectedDate}
        onDateChange={setSelectedDate}
        completedCount={dailyData?.completedTodayCount ?? 0}
        totalCount={dailyData?.tasks?.length ?? 0}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Error Alert */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs font-medium hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Daily Planner Tab */}
      {activeTab === "daily" && (
        <div className="space-y-5">
          {/* Quick Add Bar */}
          <TaskQuickAdd
            currentDate={selectedDate}
            onAddTask={handleAddTask}
            disabled={isLoadingDaily}
          />

          {/* Overdue Rollover Banner */}
          {(dailyData?.overdueTasks?.length ?? 0) > 0 && (
            <RolloverBanner
              overdueCount={dailyData?.overdueTasks?.length ?? 0}
              onCarryAllForward={handleCarryAllOverdue}
            />
          )}

          {/* Daily Task List */}
          {isLoadingDaily ? (
            <div className="flex h-36 items-center justify-center text-xs text-muted-foreground animate-pulse">
              Loading today's planner...
            </div>
          ) : (
            <TaskListSection
              tasks={dailyData?.tasks ?? []}
              overdueTasks={dailyData?.overdueTasks ?? []}
              onToggleComplete={handleToggleComplete}
              onDelete={handleDeleteTask}
              onCarryForward={handleCarryForward}
            />
          )}
        </div>
      )}

      {/* Weekly Stats Tab */}
      {activeTab === "weekly" && (
        <WeeklyDashboard
          stats={weeklyStats}
          referenceDate={weekReferenceDate}
          onWeekChange={setWeekReferenceDate}
          isLoading={isLoadingWeekly}
        />
      )}
    </div>
  )
}
