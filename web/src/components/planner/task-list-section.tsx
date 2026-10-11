import * as React from "react"
import { CheckCircle2, ChevronDown, ChevronRight, Inbox } from "lucide-react"
import { TaskItemRow } from "./task-item-row"
import type { PlannerTask } from "@/lib/planner/types"

interface TaskListSectionProps {
  tasks: PlannerTask[]
  overdueTasks?: PlannerTask[]
  onToggleComplete: (task: PlannerTask) => Promise<void>
  onDelete: (taskId: string) => Promise<void>
  onCarryForward?: (taskId: string) => Promise<void>
  disabled?: boolean
}

export function TaskListSection({
  tasks,
  overdueTasks = [],
  onToggleComplete,
  onDelete,
  onCarryForward,
  disabled = false,
}: TaskListSectionProps) {
  const [isCompletedOpen, setIsCompletedOpen] = React.useState(true)

  const activeTasks = tasks.filter((t) => t.status === "active")
  const completedTasks = tasks.filter((t) => t.status === "done")

  // Sort active tasks: high priority first, then normal, then low
  const priorityOrder: Record<string, number> = { high: 0, normal: 1, low: 2 }
  const sortedActive = [...activeTasks].sort((a, b) => {
    const prioDiff = (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1)
    if (prioDiff !== 0) return prioDiff
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })

  if (tasks.length === 0 && overdueTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-2xl border border-dashed border-border/80 bg-muted/10 space-y-2">
        <div className="size-10 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground">
          <Inbox className="size-5" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">No tasks planned for this day</h3>
        <p className="text-xs text-muted-foreground max-w-xs">
          Use the quick-add input above to schedule tasks and build your daily focus.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overdue Tasks Section if any */}
      {overdueTasks.length > 0 && (
        <section className="space-y-2" aria-label="Overdue tasks">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-600 dark:text-amber-400 px-1">
            <span>Overdue from earlier ({overdueTasks.length})</span>
          </div>

          <div className="space-y-1.5">
            {overdueTasks.map((task) => (
              <TaskItemRow
                key={task.id}
                task={task}
                onToggleComplete={onToggleComplete}
                onDelete={onDelete}
                onCarryForward={onCarryForward}
                disabled={disabled}
              />
            ))}
          </div>
        </section>
      )}

      {/* Active Tasks Section */}
      {sortedActive.length > 0 && (
        <section className="space-y-2" aria-label="Active tasks">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-1">
            <span>To Do ({sortedActive.length})</span>
          </div>

          <div className="space-y-1.5">
            {sortedActive.map((task) => (
              <TaskItemRow
                key={task.id}
                task={task}
                onToggleComplete={onToggleComplete}
                onDelete={onDelete}
                onCarryForward={onCarryForward}
                disabled={disabled}
              />
            ))}
          </div>
        </section>
      )}

      {/* Completed Tasks Collapsible Section */}
      {completedTasks.length > 0 && (
        <section className="space-y-2 pt-2" aria-label="Completed tasks">
          <button
            type="button"
            onClick={() => setIsCompletedOpen(!isCompletedOpen)}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground px-1 py-1 rounded-md transition-colors"
            aria-expanded={isCompletedOpen}
          >
            {isCompletedOpen ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            <CheckCircle2 className="size-3.5 text-emerald-500" />
            <span>Completed ({completedTasks.length})</span>
          </button>

          {isCompletedOpen && (
            <div className="space-y-1.5 animate-in fade-in duration-150">
              {completedTasks.map((task) => (
                <TaskItemRow
                  key={task.id}
                  task={task}
                  onToggleComplete={onToggleComplete}
                  onDelete={onDelete}
                  disabled={disabled}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
