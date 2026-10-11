import * as React from "react"
import { Clock as ClockIcon } from "lucide-react"

export interface ClockProps extends React.HTMLAttributes<HTMLElement> {
  /** If true, displays seconds in the time readout */
  showSeconds?: boolean
  /** If true, displays the date alongside the time on larger viewports */
  showDate?: boolean
  /** Compact mode hides the date and uses tighter padding */
  compact?: boolean
}

/**
 * Clock Component
 * Displays a live, responsive digital clock widget in the application shell.
 * Uses semantic <time> tag with accessible datetime and title attributes.
 */
export function Clock({
  showSeconds = false,
  showDate = true,
  compact = false,
  className = "",
  ...props
}: ClockProps) {
  const [currentTime, setCurrentTime] = React.useState<Date>(() => new Date())

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const formattedTime = currentTime.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    ...(showSeconds ? { second: "2-digit" } : {}),
  })

  const formattedDate = currentTime.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  })

  const fullDateTime = currentTime.toLocaleString([], {
    dateStyle: "full",
    timeStyle: "medium",
  })

  return (
    <time
      dateTime={currentTime.toISOString()}
      title={fullDateTime}
      aria-label={`Current time: ${formattedTime}`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 rounded-full border border-border/80 bg-background/85 dark:bg-card/80 backdrop-blur-md shadow-2xs text-xs font-mono text-muted-foreground select-none transition-colors hover:text-foreground hover:border-border ${className}`}
      {...props}
    >
      <ClockIcon className="size-3 md:size-3.5 text-muted-foreground/80 shrink-0" aria-hidden="true" />
      {showDate && !compact && (
        <>
          <span className="hidden lg:inline font-sans text-xs text-foreground/80 font-medium">
            {formattedDate}
          </span>
          <span className="hidden lg:inline text-border/80 font-mono text-[10px]" aria-hidden="true">
            ·
          </span>
        </>
      )}
      <span className="tabular-nums font-medium text-foreground tracking-tight">
        {formattedTime}
      </span>
    </time>
  )
}
