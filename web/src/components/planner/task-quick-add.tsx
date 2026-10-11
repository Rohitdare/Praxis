import * as React from "react"
import { AlertCircle, Flag, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { TaskPriority } from "@/lib/planner/types"

interface TaskQuickAddProps {
  currentDate: string // YYYY-MM-DD
  onAddTask: (title: string, priority: TaskPriority, dueAt: string | null) => Promise<void>
  disabled?: boolean
}

export function TaskQuickAdd({ currentDate, onAddTask, disabled }: TaskQuickAddProps) {
  const [title, setTitle] = React.useState("")
  const [priority, setPriority] = React.useState<TaskPriority>("normal")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [timeVal, setTimeVal] = React.useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return

    setIsSubmitting(true)
    setError(null)

    try {
      let dueAt: string | null = null
      if (timeVal) {
        dueAt = new Date(`${currentDate}T${timeVal}:00`).toISOString()
      } else {
        dueAt = new Date(`${currentDate}T12:00:00`).toISOString()
      }

      await onAddTask(trimmed, priority, dueAt)
      setTitle("")
      setTimeVal("")
      setPriority("normal")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add task")
    } finally {
      setIsSubmitting(false)
    }
  }

  const cyclePriority = () => {
    setPriority((prev) => {
      if (prev === "normal") return "high"
      if (prev === "high") return "low"
      return "normal"
    })
  }

  const priorityColor =
    priority === "high"
      ? "text-rose-500 hover:text-rose-600 bg-rose-500/10"
      : priority === "low"
      ? "text-slate-400 hover:text-slate-500 bg-muted/40"
      : "text-amber-500 hover:text-amber-600 bg-amber-500/10"

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 rounded-xl border border-border/80 bg-card/60 backdrop-blur-xs shadow-2xs focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
        <Input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task for today..."
          disabled={disabled || isSubmitting}
          className="border-0 shadow-none focus-visible:ring-0 bg-transparent text-sm h-9 sm:h-8 px-2 flex-1 min-w-0"
          aria-label="New task title"
        />

        <div className="flex items-center gap-1 shrink-0 pr-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={cyclePriority}
            className={`h-8 sm:h-7 px-2 text-xs font-medium rounded-lg gap-1 min-h-[32px] sm:min-h-0 ${priorityColor}`}
            title={`Priority: ${priority} (click to change)`}
            aria-label={`Priority: ${priority}`}
          >
            <Flag className="size-3" />
            <span className="capitalize hidden sm:inline">{priority}</span>
          </Button>

          <Button
            type="submit"
            size="sm"
            disabled={!title.trim() || disabled || isSubmitting}
            className="h-8 sm:h-7 px-3 sm:px-2.5 rounded-lg text-xs gap-1 font-medium shadow-2xs min-h-[32px] sm:min-h-0"
            aria-label="Add task"
          >
            <Plus className="size-3.5" />
            <span>Add</span>
          </Button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-1.5 text-xs text-destructive px-2 animate-in fade-in duration-150"
        >
          <AlertCircle className="size-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </form>
  )
}
