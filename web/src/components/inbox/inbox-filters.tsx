import { cn } from "cn"
import type { InboxFilterType } from "@/lib/inbox/service"

export interface InboxFiltersProps {
  currentFilter: InboxFilterType
  counts?: Record<InboxFilterType, number>
  onFilterChange: (filter: InboxFilterType) => void
  className?: string
}

interface FilterOption {
  id: InboxFilterType
  label: string
}

const FILTER_OPTIONS: FilterOption[] = [
  { id: "all", label: "All" },
  { id: "resource", label: "Resource" },
  { id: "idea", label: "Idea / Note" },
  { id: "task", label: "Task" },
  { id: "event", label: "Event" },
]

export function InboxFilters({
  currentFilter,
  counts,
  onFilterChange,
  className,
}: InboxFiltersProps) {
  return (
    <nav
      aria-label="Filter inbox items"
      className={cn("flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none", className)}
    >
      {FILTER_OPTIONS.map((option) => {
        const isActive = currentFilter === option.id
        const count = counts ? counts[option.id] : undefined

        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls="inbox-item-list"
            onClick={() => onFilterChange(option.id)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring/50",
              isActive
                ? "bg-secondary text-secondary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <span>{option.label}</span>
            {count !== undefined && count > 0 && (
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full",
                  isActive
                    ? "bg-foreground/10 text-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
