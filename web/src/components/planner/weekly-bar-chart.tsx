import type { DayActivity } from "@/lib/planner/types"

interface WeeklyBarChartProps {
  activity: DayActivity[]
}

export function WeeklyBarChart({ activity }: WeeklyBarChartProps) {
  const maxCompleted = Math.max(...activity.map((a) => a.completedCount), 1)

  return (
    <div
      className="p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xs space-y-3"
      role="region"
      aria-label="Weekly Activity Chart"
    >
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground">Completed Tasks by Day</span>
        <span className="text-muted-foreground text-[11px]">Mon – Sun</span>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-2 items-end pt-4 pb-2 h-36">
        {activity.map((item) => {
          const heightPercent =
            item.completedCount === 0
              ? 6
              : Math.max(14, Math.round((item.completedCount / maxCompleted) * 100))

          const isToday =
            new Date().toLocaleDateString("en-CA") === item.date

          return (
            <div
              key={item.day}
              className="flex flex-col items-center justify-end h-full gap-1.5 group relative"
            >
              {/* Tooltip on hover / tap */}
              <div className="absolute -top-7 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 group-active:opacity-100 transition-opacity bg-popover text-popover-foreground text-[10px] font-medium px-1.5 py-0.5 rounded shadow-xs pointer-events-none whitespace-nowrap z-10 border border-border/80">
                {item.completedCount} completed ({item.plannedCount} planned)
              </div>

              {/* Bar */}
              <div className="w-full max-w-[28px] h-full flex items-end justify-center">
                <div
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full rounded-md transition-all duration-300 ${
                    item.completedCount > 0
                      ? isToday
                        ? "bg-primary shadow-xs"
                        : "bg-primary/75 hover:bg-primary"
                      : "bg-muted/40"
                  }`}
                  aria-label={`${item.day}: ${item.completedCount} completed`}
                  tabIndex={0}
                />
              </div>

              {/* Count label */}
              <span className="text-[11px] font-semibold text-foreground/80 group-hover:text-foreground">
                {item.completedCount}
              </span>

              {/* Day label */}
              <span
                className={`text-[10px] font-medium ${
                  isToday
                    ? "text-primary font-bold"
                    : "text-muted-foreground"
                }`}
              >
                {item.day}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
