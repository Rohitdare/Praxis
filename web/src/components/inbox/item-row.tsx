import * as React from "react"
import {
  Calendar,
  CheckSquare,
  CloudOff,
  FileText,
  HelpCircle,
  Lightbulb,
  Link2,
  Trash2,
} from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import type { InboxItem } from "@/lib/inbox/service"
import { formatRelativeTime } from "@/lib/inbox/service"

export interface ItemRowProps {
  item: InboxItem
  isSelected?: boolean
  isDeleting?: boolean
  onSelect?: (id: string) => void
  onDelete?: (id: string) => Promise<void> | void
  className?: string
}

function getItemTypeIcon(type: InboxItem["type"]) {
  switch (type) {
    case "resource":
      return <Link2 className="size-3.5 text-blue-500 shrink-0" aria-hidden="true" />
    case "idea":
      return <Lightbulb className="size-3.5 text-amber-500 shrink-0" aria-hidden="true" />
    case "task":
      return <CheckSquare className="size-3.5 text-emerald-500 shrink-0" aria-hidden="true" />
    case "event":
      return <Calendar className="size-3.5 text-purple-500 shrink-0" aria-hidden="true" />
    case "note":
      return <FileText className="size-3.5 text-sky-500 shrink-0" aria-hidden="true" />
    case "unclassified":
    default:
      return <HelpCircle className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
  }
}

function getItemTypeLabel(type: InboxItem["type"]): string {
  switch (type) {
    case "resource":
      return "Resource"
    case "idea":
      return "Idea"
    case "task":
      return "Task"
    case "event":
      return "Event"
    case "note":
      return "Note"
    case "unclassified":
    default:
      return "Note"
  }
}

export function ItemRow({
  item,
  isSelected = false,
  isDeleting = false,
  onSelect,
  onDelete,
  className,
}: ItemRowProps) {
  const [internalDeleting, setInternalDeleting] = React.useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isDeleting || internalDeleting || !onDelete) {
      return
    }
    setInternalDeleting(true)
    try {
      await onDelete(item.id)
    } finally {
      setInternalDeleting(false)
    }
  }

  const busy = isDeleting || internalDeleting

  return (
    <div
      role="article"
      tabIndex={0}
      data-selected={isSelected}
      onClick={() => onSelect?.(item.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onSelect?.(item.id)
        }
      }}
      className={cn(
        "group relative flex items-start justify-between gap-4 p-3.5 sm:p-4 rounded-xl border border-border/60 bg-card/60 transition-all outline-none",
        "hover:bg-muted/30 hover:border-border focus-visible:ring-2 focus-visible:ring-ring/50 shadow-2xs",
        isSelected && "bg-secondary/70 border-foreground/30 shadow-xs",
        busy && "opacity-40 pointer-events-none",
        className
      )}
    >
      <div className="flex items-start gap-3.5 min-w-0 flex-1">
        <div className="mt-0.5 p-1.5 rounded-lg bg-muted/60 text-muted-foreground group-hover:bg-background transition-colors border border-border/40 shrink-0">
          {getItemTypeIcon(item.type)}
        </div>

        <div className="space-y-1.5 min-w-0 flex-1">
          <p className="text-sm font-normal text-foreground leading-relaxed break-words whitespace-pre-wrap">
            {item.raw_input}
          </p>

          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <span className="font-medium text-foreground/80">{getItemTypeLabel(item.type)}</span>
            <span aria-hidden="true" className="text-muted-foreground/40">·</span>
            <time dateTime={item.captured_at}>{formatRelativeTime(item.captured_at)}</time>

            {!item.synced && (
              <>
                <span aria-hidden="true" className="text-muted-foreground/40">·</span>
                <span
                  className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium"
                  title="Saved offline — will sync later"
                >
                  <CloudOff className="size-3" aria-hidden="true" />
                  <span>Offline</span>
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 flex items-center self-center pl-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={busy}
          onClick={handleDelete}
          aria-label="Delete item"
          className="text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-70 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
