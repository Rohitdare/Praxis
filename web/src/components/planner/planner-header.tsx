import { BarChart3, Calendar, CheckSquare, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PlannerHeaderProps {
  currentDate: string // YYYY-MM-DD
  onDateChange: (newDateStr: string) => void
  completedCount: number
  totalCount: number
  activeTab: "daily" | "weekly"
  onTabChange: (tab: "daily" | "weekly") => void
}

export function PlannerHeader({
  currentDate,
  onDateChange,
  completedCount,
  totalCount,
  activeTab,
  onTabChange,
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
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
      {/* Left: Title & Date Controls */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-heading font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <CheckSquare className="size-5 sm:size-6 text-primary shrink-0" />
            <span>To-Do Planner</span>
          </h1>

          {/* Progress summary badge */}
          {activeTab === "daily" && totalCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-secondary text-secondary-foreground">
              {completedCount} of {totalCount} completed
            </span>
          )}
        </div>

        {activeTab === "daily" && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-0.5">
            <span className="font-semibold text-foreground text-sm">
              {formattedDateString}
            </span>

            <div className="flex items-center gap-0.5 ml-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handlePrevDay}
                className="size-6 p-0 rounded-md"
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
                className="h-6 px-2 text-[11px] rounded-md font-medium"
                title="Go to Today"
              >
                Today
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleNextDay}
                className="size-6 p-0 rounded-md"
                title="Next Day"
                aria-label="Next Day"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Right: Tab Switcher (Daily vs Weekly) */}
      <div
        role="tablist"
        aria-label="Planner views"
        className="flex items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border/60 self-start sm:self-auto"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "daily"}
          onClick={() => onTabChange("daily")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
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
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
            activeTab === "weekly"
              ? "bg-card text-foreground font-semibold shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-label="Weekly Stats view"
        >
          <BarChart3 className="size-3.5" />
          <span>Weekly Stats</span>
        </button>
      </div>
    </header>
  )
}
