import type { EventFields } from "@/lib/items/types"
import { DateTimeSelector } from "@/components/ui/date-time-picker"

interface EventFieldsProps {
  fields: EventFields
  onChange: (fields: EventFields) => void
  disabled?: boolean
  error?: string
}

export function EventFieldsComponent({
  fields,
  onChange,
  disabled,
  error,
}: EventFieldsProps) {
  const formatDatetimeForInput = (iso?: string | null) => {
    if (!iso) return ""
    try {
      const d = new Date(iso)
      if (isNaN(d.getTime())) return ""
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    } catch {
      return ""
    }
  }

  const handleStartChange = (val: string) => {
    onChange({
      ...fields,
      start_at: val ? new Date(val).toISOString() : "",
    })
  }

  const handleEndChange = (val: string) => {
    onChange({
      ...fields,
      end_at: val ? new Date(val).toISOString() : null,
    })
  }

  return (
    <div className="p-4 rounded-lg border border-border/80 bg-muted/20 space-y-4 text-xs">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Start Date & Time */}
        <DateTimeSelector
          dateId="event-start-time"
          timeId="event-start-clock"
          dateLabel="Start Date"
          timeLabel="Start Time"
          ariaLabel="Start Time"
          value={formatDatetimeForInput(fields.start_at)}
          onChange={handleStartChange}
          hideTime={fields.all_day}
          required
          disabled={disabled}
          defaultTime="09:00"
        />

        {/* End Date & Time */}
        <DateTimeSelector
          dateId="event-end-time"
          timeId="event-end-clock"
          dateLabel="End Date"
          timeLabel="End Time (optional)"
          ariaLabel="End Time (optional)"
          value={formatDatetimeForInput(fields.end_at)}
          onChange={handleEndChange}
          hideTime={fields.all_day}
          disabled={disabled}
          defaultTime="10:00"
        />
      </div>

      {error && <p className="text-[11px] text-destructive">{error}</p>}

      {/* All day toggle */}
      <div className="flex items-center gap-2 pt-1 border-t border-border/40">
        <input
          id="event-all-day"
          type="checkbox"
          checked={fields.all_day}
          onChange={(e) => onChange({ ...fields, all_day: e.target.checked })}
          disabled={disabled}
          className="size-4 rounded border-input text-primary focus:ring-ring disabled:opacity-50"
        />
        <label htmlFor="event-all-day" className="font-medium text-foreground cursor-pointer select-none">
          All-day event
        </label>
      </div>
    </div>
  )
}
