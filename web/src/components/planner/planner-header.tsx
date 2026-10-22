import { BarChart3, Calendar, CheckSquare, ChevronLeft, ChevronRight, Dumbbell, UtensilsCrossed } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { FeatureDefinition } from "@/lib/features/types"

interface PlannerHeaderProps {
  currentDate: string // YYYY-MM-DD
  onDateChange: (newDateStr: string) => void
  completedCount: number
  totalCount: number
  activeTab: string
  onTabChange: (tab: any) => void
  enabledModules?: FeatureDefinition[]
}

export function PlannerHeader({
  currentDate,
  onDateChange,
  completedCount,
  totalCount,
  activeTab,
  onTabChange,
  enabledModules = [],
}: PlannerHeaderProps) {
  const currentObj = new Date(`${currentDate}T00:00:00`)
  const isToday =
    new Date().toLocaleDateString("en-CA") === currentDate // YYYY-MM-DD format

  const handlePrevDay = () => {
    const prev = new Date(currentObj)
    prev.setDate(prev.getDate() - 1)
    onDateChange(prev.toLocaleDateString("en-CA"))
  }

  const handleNextDay = () => {
    const next = new Date(currentObj)
    next.setDate(next.getDate() + 1)
    onDateChange(next.toLocaleDateString("en-CA"))
  }

  const handleToday = () => {
    onDateChange(new Date().toLocaleDateString("en-CA"))
  }

  const formattedDateString = currentObj.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  })

  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-2 border-b border-border/60">
      {/* Left: Title & Date Controls */}
      <div className="space-y-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-heading font-extrabold tracking-tight text-foreground flex items-center gap-2">
            {activeTab === "workouts" ? (
              <>
                <Dumbbell className="size-5 sm:size-6 text-primary shrink-0" />
                <span>Workout Planner</span>
              </>
            ) : activeTab === "diet" ? (
              <>
                <UtensilsCrossed className="size-5 sm:size-6 text-primary shrink-0" />
                <span>Diet Planner</span>
              </>
            ) : (
              <>
                <CheckSquare className="size-5 sm:size-6 text-primary shrink-0" />
                <span>To-Do Planner</span>
              </>
            )}
          </h1>

          {/* Progress summary badge */}
          {activeTab === "daily" && totalCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-secondary text-secondary-foreground">
              {completedCount} of {totalCount} completed
            </span>
          )}
        </div>

        {activeTab !== "weekly" && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground pt-0.5">
            <span className="font-semibold text-foreground text-sm">
              {formattedDateString}
            </span>

            <div className="flex items-center gap-1 ml-1 sm:ml-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handlePrevDay}
                className="size-7 sm:size-6 p-0 rounded-md"
                title="Previous Day"
                aria-label="Previous Day"
              >
                <ChevronLeft className="size-3.5" />
              </Button>

              <Button
                type="button"
                variant={isToday ? "secondary" : "outline"}
                size="sm"
                onClick={handleToday}
                className="h-7 sm:h-6 px-2.5 text-[11px] rounded-md font-medium"
                title="Go to Today"
              >
                Today
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleNextDay}
                className="size-7 sm:size-6 p-0 rounded-md"
                title="Next Day"
                aria-label="Next Day"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Right: Tab Switcher (Daily vs Weekly vs Optional Modules) */}
      <div
        role="tablist"
        aria-label="Planner views"
        className="w-full sm:w-auto flex flex-wrap items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border/60"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "daily"}
          onClick={() => onTabChange("daily")}
          className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium min-h-[36px] sm:min-h-0 transition-all ${
            activeTab === "daily"
              ? "bg-card text-foreground font-semibold shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-label="Daily Planner view"
        >
          <Calendar className="size-3.5" />
          <span>Daily Planner</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "weekly"}
          onClick={() => onTabChange("weekly")}
          className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium min-h-[36px] sm:min-h-0 transition-all ${
            activeTab === "weekly"
              ? "bg-card text-foreground font-semibold shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-label="Weekly Stats view"
        >
          <BarChart3 className="size-3.5" />
          <span>Weekly Stats</span>
        </button>

        {enabledModules.map((mod) => {
          const tabKey =
            mod.id === "workout_planner"
              ? "workouts"
              : mod.id === "diet_planner"
              ? "diet"
              : mod.id
          const isSelected = activeTab === tabKey
          return (
            <button
              key={mod.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => onTabChange(tabKey)}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium min-h-[36px] sm:min-h-0 transition-all ${
                isSelected
                  ? "bg-card text-foreground font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label={`${mod.name} view`}
            >
              {mod.id === "workout_planner" ? (
                <Dumbbell className="size-3.5" />
              ) : mod.id === "diet_planner" ? (
                <UtensilsCrossed className="size-3.5" />
              ) : null}
              <span>{mod.name}</span>
            </button>
          )
        })}
      </div>
    </header>
  )
}
