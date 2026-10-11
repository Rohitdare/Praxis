import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface DateTimeSelectorProps {
  /** Combined local datetime string in "YYYY-MM-DDTHH:mm" format or empty string */
  value?: string | null
  /** Callback fired with new "YYYY-MM-DDTHH:mm" or "" */
  onChange: (value: string) => void
  /** Label for the date input (e.g. "Start Date", "Due Date") */
  dateLabel?: string
  /** Label for the time input (e.g. "Start Time", "Due Time") */
  timeLabel?: string
  /** Accessible label applied to the primary date input for backwards compatibility */
  ariaLabel?: string
  /** HTML id for the date input */
  dateId?: string
  /** HTML id for the time input */
  timeId?: string
  /** Whether the field is required */
  required?: boolean
  /** Whether the inputs are disabled */
  disabled?: boolean
  /** Whether to hide the time input (e.g. for all-day events) */
  hideTime?: boolean
  /** Default time to apply when selecting date first (e.g. "09:00", "10:00", "17:00") */
  defaultTime?: string
  /** Additional container classes */
  className?: string
}

function parseDateTime(val?: string | null): { date: string; time: string } {
  if (!val) return { date: "", time: "" }
  if (val.includes("T")) {
    const [d, rest] = val.split("T")
    const t = rest ? rest.slice(0, 5) : ""
    return { date: d || "", time: t || "" }
  }
  return { date: val.slice(0, 10), time: "" }
}

export function DateTimeSelector({
  value,
  onChange,
  dateLabel = "Date",
  timeLabel = "Time",
  ariaLabel,
  dateId,
  timeId,
  required = false,
  disabled = false,
  hideTime = false,
  defaultTime = "09:00",
  className,
}: DateTimeSelectorProps) {
  const generatedId = React.useId()
  const effectiveDateId = dateId || `${generatedId}-date`
  const effectiveTimeId = timeId || `${generatedId}-time`
  const { date, time } = parseDateTime(value)

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value
    if (!newDate) {
      onChange("")
      return
    }

    // Support combined ISO/datetime string if passed directly by tests or automated agents
    if (newDate.includes("T")) {
      onChange(newDate.slice(0, 16))
      return
    }

    if (hideTime) {
      onChange(`${newDate}T${defaultTime || "00:00"}`)
      return
    }

    const effectiveTime = time || defaultTime || "09:00"
    onChange(`${newDate}T${effectiveTime}`)
  }

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value
    const effectiveDate =
      date || new Date().toISOString().slice(0, 10)

    if (!newTime) {
      onChange(`${effectiveDate}T00:00`)
      return
    }

    onChange(`${effectiveDate}T${newTime}`)
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Date input (top) */}
      <div className="space-y-1">
        <label
          htmlFor={effectiveDateId}
          className="text-xs font-medium text-foreground block"
        >
          {dateLabel} {required && <span className="text-destructive">*</span>}
        </label>
        <Input
          id={effectiveDateId}
          type="date"
          aria-label={ariaLabel}
          value={date}
          onChange={handleDateChange}
          required={required}
          disabled={disabled}
          className="text-xs w-full [color-scheme:light] dark:[color-scheme:dark]"
        />
      </div>

      {/* Time input (moved downwards below Date) */}
      {!hideTime && (
        <div className="space-y-1">
          <label
            htmlFor={effectiveTimeId}
            className="text-xs font-medium text-foreground block"
          >
            {timeLabel} {required && <span className="text-destructive">*</span>}
          </label>
          <Input
            id={effectiveTimeId}
            type="time"
            value={time}
            onChange={handleTimeChange}
            required={required}
            disabled={disabled}
            className="text-xs w-full [color-scheme:light] dark:[color-scheme:dark]"
          />
        </div>
      )}
    </div>
  )
}
