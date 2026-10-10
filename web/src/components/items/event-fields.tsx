import type { EventFields } from "@/lib/items/types"

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

  return (
    <div className="p-4 rounded-lg border border-border/80 bg-muted/20 space-y-4 text-xs">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Start Date */}
        <div className="space-y-1.5">
          <label htmlFor="event-start-time" className="font-medium text-foreground block">
            Start Time <span className="text-destructive">*</span>
          </label>
          <input
            id="event-start-time"
            type="datetime-local"
            value={formatDatetimeForInput(fields.start_at)}
            onChange={(e) =>
              onChange({
                ...fields,
                start_at: e.target.value ? new Date(e.target.value).toISOString() : "",
              })
            }
            disabled={disabled}
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          />
        </div>

        {/* End Date */}
        <div className="space-y-1.5">
          <label htmlFor="event-end-time" className="font-medium text-foreground block">
            End Time (optional)
          </label>
          <input
            id="event-end-time"
            type="datetime-local"
            value={formatDatetimeForInput(fields.end_at)}
            onChange={(e) =>
              onChange({
                ...fields,
                end_at: e.target.value ? new Date(e.target.value).toISOString() : null,
              })
            }
            disabled={disabled}
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          />
        </div>
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
