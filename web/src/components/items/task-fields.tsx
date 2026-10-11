import type { TaskFields } from "@/lib/items/types"
import type { TaskPriority } from "@/lib/supabase/database.types"
import { DateTimeSelector } from "@/components/ui/date-time-picker"

interface TaskFieldsProps {
  fields: TaskFields
  onChange: (fields: TaskFields) => void
  disabled?: boolean
}

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
]

export function TaskFieldsComponent({ fields, onChange, disabled }: TaskFieldsProps) {
  // Format ISO date to yyyy-MM-ddThh:mm for input[type="datetime-local"]
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

  const handleDateChange = (val: string) => {
    onChange({
      ...fields,
      due_at: val ? new Date(val).toISOString() : null,
    })
  }

  const handlePriorityChange = (priority: TaskPriority) => {
    onChange({
      ...fields,
      priority,
    })
  }

  const handleCompletedChange = (checked: boolean) => {
    onChange({
      ...fields,
      completed_at: checked ? new Date().toISOString() : null,
    })
  }

  return (
    <div className="p-4 rounded-lg border border-border/80 bg-muted/20 space-y-4 text-xs">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Due Date & Time */}
        <DateTimeSelector
          dateId="task-due-date"
          timeId="task-due-time"
          dateLabel="Due Date"
          timeLabel="Due Time"
          ariaLabel="Due Date & Time"
          value={formatDatetimeForInput(fields.due_at)}
          onChange={handleDateChange}
          disabled={disabled}
          defaultTime="17:00"
        />

        {/* Priority Selector */}
        <div className="space-y-1.5">
          <label className="font-medium text-foreground block">Priority</label>
          <div className="flex gap-2">
            {PRIORITIES.map((p) => {
              const isSelected = fields.priority === p.value
              return (
                <button
                  key={p.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => handlePriorityChange(p.value)}
                  className={`flex-1 py-2 px-2 min-h-[36px] rounded-md border text-center font-medium transition-colors ${
                    isSelected
                      ? "bg-secondary text-secondary-foreground border-foreground/30 shadow-xs"
                      : "bg-background text-muted-foreground border-border hover:bg-accent"
                  } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Completion status */}
      <div className="flex items-center gap-2 pt-1 border-t border-border/40">
        <input
          id="task-completed"
          type="checkbox"
          checked={!!fields.completed_at}
          onChange={(e) => handleCompletedChange(e.target.checked)}
          disabled={disabled}
          className="size-4 rounded border-input text-primary focus:ring-ring disabled:opacity-50"
        />
        <label htmlFor="task-completed" className="font-medium text-foreground cursor-pointer select-none">
          Mark as completed
        </label>
      </div>
    </div>
  )
}
