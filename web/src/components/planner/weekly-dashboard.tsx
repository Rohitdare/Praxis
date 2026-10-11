import { AlertCircle, Calendar, CheckCircle2, ChevronLeft, ChevronRight, Clock, Target, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WeeklyBarChart } from "./weekly-bar-chart"
import type { WeeklyStats } from "@/lib/planner/types"

interface WeeklyDashboardProps {
  stats: WeeklyStats
  referenceDate: Date
  onWeekChange: (newRefDate: Date) => void
  isLoading?: boolean
}

export function WeeklyDashboard({
  stats,
  referenceDate,
  onWeekChange,
  isLoading = false,
}: WeeklyDashboardProps) {
  const handlePrevWeek = () => {
    const prev = new Date(referenceDate)
    prev.setDate(prev.getDate() - 7)
    onWeekChange(prev)
  }

  const handleNextWeek = () => {
    const next = new Date(referenceDate)
    next.setDate(next.getDate() + 7)
    onWeekChange(next)
  }

  const handleCurrentWeek = () => {
    onWeekChange(new Date())
  }

  const isCurrentWeek = () => {
    const now = new Date()
    const nowMon = new Date(now)
    nowMon.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1))
    return nowMon.toLocaleDateString("en-CA") === stats.weekStart
  }

  // Format week range label (e.g. "Oct 12 – Oct 18, 2026")
  const formatWeekRange = () => {
    const startObj = new Date(`${stats.weekStart}T00:00:00`)
    const endObj = new Date(`${stats.weekEnd}T00:00:00`)
    const startMonth = startObj.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    const endMonth = endObj.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    return `${startMonth} – ${endMonth}`
  }

  const isEmptyWeek = stats.tasksPlanned === 0 && stats.tasksCompleted === 0

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Week Navigator Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xs">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-primary shrink-0" />
          <span className="text-sm font-semibold text-foreground tracking-tight">
            {formatWeekRange()}
          </span>
          {isCurrentWeek() && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary uppercase tracking-wider">
              Current Week
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handlePrevWeek}
            disabled={isLoading}
            className="h-8 px-2 rounded-lg text-xs gap-1"
            title="Previous Week"
            aria-label="Previous Week"
          >
            <ChevronLeft className="size-3.5" />
            <span className="hidden sm:inline">Prev Week</span>
          </Button>

          <Button
            type="button"
            variant={isCurrentWeek() ? "secondary" : "outline"}
            size="sm"
            onClick={handleCurrentWeek}
            disabled={isLoading}
            className="h-8 px-2.5 rounded-lg text-xs font-medium"
            title="Current Week"
          >
            This Week
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleNextWeek}
            disabled={isLoading}
            className="h-8 px-2 rounded-lg text-xs gap-1"
            title="Next Week"
            aria-label="Next Week"
          >
            <span className="hidden sm:inline">Next Week</span>
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Planned */}
        <div className="p-4 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Planned</span>
            <Target className="size-3.5 text-primary" />
          </div>
          <div className="text-2xl font-bold font-heading tracking-tight text-foreground">
            {stats.tasksPlanned}
          </div>
          <p className="text-[11px] text-muted-foreground">Tasks scheduled this week</p>
        </div>

        {/* Completed */}
        <div className="p-4 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Completed</span>
            <CheckCircle2 className="size-3.5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-heading tracking-tight text-foreground">
            {stats.tasksCompleted}
          </div>
          <p className="text-[11px] text-muted-foreground">Finished during this week</p>
        </div>

        {/* Completion Rate */}
        <div className="p-4 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Completion Rate</span>
            <TrendingUp className="size-3.5 text-primary" />
          </div>
          <div className="text-2xl font-bold font-heading tracking-tight text-foreground">
            {`${stats.completionRate}%`}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {stats.tasksPlanned > 0
              ? `Of ${stats.tasksPlanned} planned tasks`
              : "No planned tasks"}
          </p>
        </div>

        {/* Outstanding / Overdue */}
        <div className="p-4 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Outstanding</span>
            {stats.overdueTasks > 0 ? (
              <AlertCircle className="size-3.5 text-rose-500" />
            ) : (
              <Clock className="size-3.5 text-muted-foreground" />
            )}
          </div>
          <div className="text-2xl font-bold font-heading tracking-tight text-foreground">
            {stats.outstandingTasks}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {stats.overdueTasks > 0
              ? `${stats.overdueTasks} overdue`
              : "All caught up"}
          </p>
        </div>
      </div>

      {isEmptyWeek ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-2xl border border-dashed border-border/80 bg-muted/10 space-y-2">
          <Calendar className="size-8 text-muted-foreground/60" />
          <h3 className="text-sm font-semibold text-foreground">No task activity this week</h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            No tasks were planned or completed during this week. Plan tasks in the Daily Planner to build your progress.
          </p>
        </div>
      ) : (
        <>
          {/* 7-Day Activity Chart */}
          <WeeklyBarChart activity={stats.dailyActivity} />

          {/* Daily Breakdown Table */}
          <div className="p-4 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xs space-y-3">
            <h3 className="text-xs font-semibold text-foreground">Daily Activity Breakdown</h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground">
                    <th className="pb-2 font-medium">Day</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium text-right">Planned</th>
                    <th className="pb-2 font-medium text-right">Completed</th>
                    <th className="pb-2 font-medium text-right">Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {stats.dailyActivity.map((day) => {
                    const isToday =
                      new Date().toLocaleDateString("en-CA") === day.date

                    return (
                      <tr
                        key={day.date}
                        className={`hover:bg-muted/30 transition-colors ${
                          isToday ? "bg-primary/5 font-semibold text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        <td className="py-2.5 font-medium flex items-center gap-1.5">
                          <span>{day.day}</span>
                          {isToday && (
                            <span className="size-1.5 rounded-full bg-primary" />
                          )}
                        </td>
                        <td className="py-2.5">{day.date}</td>
                        <td className="py-2.5 text-right font-medium text-foreground">
                          {day.plannedCount}
                        </td>
                        <td className="py-2.5 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                          {day.completedCount}
                        </td>
                        <td className="py-2.5 text-right font-medium">
                          {day.outstandingCount}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
