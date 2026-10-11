import * as React from "react"
import { Calendar, Check, Clock, ExternalLink, Flag, Trash2 } from "lucide-react"
import { NavLink } from "react-router-dom"
import { Button } from "@/components/ui/button"
import type { PlannerTask } from "@/lib/planner/types"

interface TaskItemRowProps {
  task: PlannerTask
  onToggleComplete: (task: PlannerTask) => Promise<void>
  onDelete: (taskId: string) => Promise<void>
  onCarryForward?: (taskId: string) => Promise<void>
  isCarryForwardEnabled?: boolean
  disabled?: boolean
}

export function TaskItemRow({
  task,
  onToggleComplete,
  onDelete,
  onCarryForward,
  isCarryForwardEnabled = false,
  disabled = false,
}: TaskItemRowProps) {
  const [isPending, setIsPending] = React.useState(false)

  const isDone = task.status === "done"

  const handleCheckboxClick = async () => {
    if (disabled || isPending) return
    setIsPending(true)
    try {
      await onToggleComplete(task)
    } finally {
      setIsPending(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (disabled || isPending) return
    setIsPending(true)
    try {
      await onDelete(task.id)
    } finally {
      setIsPending(false)
    }
  }

  const handleCarryForward = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onCarryForward || disabled || isPending) return
    setIsPending(true)
    try {
      await onCarryForward(task.id)
    } finally {
      setIsPending(false)
    }
  }

  // Format due time if time is specified
  const formatTime = (iso?: string | null) => {
    if (!iso) return null
    try {
      const d = new Date(iso)
      if (isNaN(d.getTime())) return null
      // If time is 00:00:00 or 12:00:00 without explicit user time, omit
      const hours = d.getHours()
      const mins = d.getMinutes()
      if (hours === 0 && mins === 0) return null
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    } catch {
      return null
    }
  }

  const timeString = formatTime(task.dueAt)

  const priorityStyle =
    task.priority === "high"
      ? "text-rose-500 bg-rose-500/10 border-rose-500/20"
      : task.priority === "low"
      ? "text-slate-400 bg-muted/40 border-border/40"
      : "text-amber-500 bg-amber-500/10 border-amber-500/20"

  return (
    <div
      className={`group relative flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
        isDone
          ? "border-border/40 bg-muted/20 opacity-70"
          : task.isOverdue
          ? "border-rose-500/30 bg-rose-500/[0.02] hover:border-rose-500/40"
          : "border-border/70 bg-card/40 hover:bg-card/70 hover:border-border"
      } ${isPending ? "opacity-50 pointer-events-none" : ""}`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Completion Checkbox */}
        <button
          type="button"
          role="checkbox"
          aria-checked={isDone}
          aria-label={`Mark task "${task.title}" as ${isDone ? "incomplete" : "complete"}`}
          onClick={handleCheckboxClick}
          disabled={disabled || isPending}
          className={`size-5 rounded-md border flex items-center justify-center shrink-0 transition-colors focus-visible:ring-2 focus-visible:ring-ring outline-none ${
            isDone
              ? "bg-primary border-primary text-primary-foreground"
              : "border-border bg-background/80 hover:border-primary/60"
          }`}
        >
          {isDone && <Check className="size-3.5 stroke-[3]" />}
        </button>

        {/* Task Title & Details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-sm font-medium tracking-tight truncate ${
                isDone ? "line-through text-muted-foreground" : "text-foreground"
              }`}
            >
              {task.title}
            </span>

            {/* Priority Indicator */}
            {task.priority !== "normal" && (
              <span
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-medium border ${priorityStyle}`}
              >
                <Flag className="size-2.5" />
                <span className="capitalize">{task.priority}</span>
              </span>
            )}

            {/* Overdue Badge */}
            {task.isOverdue && !isDone && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                Overdue
              </span>
            )}

            {/* Time Badge */}
            {timeString && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="size-3 shrink-0" />
                <span>{timeString}</span>
              </span>
            )}
          </div>

          {task.content && (
            <p className="text-xs text-muted-foreground truncate mt-0.5 max-w-md">
              {task.content}
            </p>
          )}
        </div>
      </div>

      {/* Row Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Carry Forward action if enabled or overdue */}
        {(isCarryForwardEnabled || task.isOverdue) && onCarryForward && !isDone && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCarryForward}
            className="h-7 px-2 text-[11px] font-medium rounded-lg text-primary gap-1 border-primary/30 hover:bg-primary/10"
            title="Carry forward to today"
            aria-label={`Carry forward ${task.title} to today`}
          >
            <Calendar className="size-3" />
            <span className="hidden sm:inline">Carry Forward</span>
          </Button>
        )}

        {/* Link to detail page */}
        <NavLink
          to={`/items/${task.id}`}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Open task details"
          aria-label={`Open details for ${task.title}`}
        >
          <ExternalLink className="size-3.5" />
        </NavLink>

        {/* Delete action */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="size-7 p-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete task"
          aria-label={`Delete task ${task.title}`}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
