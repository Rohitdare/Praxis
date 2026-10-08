import { FileText, Link as LinkIcon } from "lucide-react"
import type { LocalItem } from "@/lib/db/schema"

export interface RecentCapturesProps {
  items: LocalItem[]
  isLoading?: boolean
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffSec < 60) {
    return "Just now"
  }
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) {
    return `${diffMin}m ago`
  }
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function isLikelyUrl(text: string): boolean {
  return /^https?:\/\//i.test(text.trim())
}

export function RecentCaptures({ items, isLoading }: RecentCapturesProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 pt-6" aria-label="Loading recent captures">
        <div className="h-4 w-28 bg-muted rounded animate-pulse" />
        <div className="space-y-2">
          <div className="h-10 bg-muted/50 rounded-lg animate-pulse" />
          <div className="h-10 bg-muted/50 rounded-lg animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <section className="space-y-3 pt-6 text-left" aria-labelledby="recent-captures-heading">
      <h2
        id="recent-captures-heading"
        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        Recent captures
      </h2>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground/80 py-4 text-center border border-dashed border-border/80 rounded-lg">
          No captures yet. Anything you type above will be saved locally.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-lg border border-border bg-card/40 overflow-hidden">
          {items.map((item) => {
            const isUrl = isLikelyUrl(item.raw_input)
            return (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {isUrl ? (
                    <LinkIcon className="size-3.5 text-muted-foreground shrink-0" aria-label="Link capture" />
                  ) : (
                    <FileText className="size-3.5 text-muted-foreground shrink-0" aria-label="Note capture" />
                  )}
                  <span className="text-xs text-foreground truncate font-normal">
                    {item.raw_input}
                  </span>
                </div>

                <time
                  dateTime={item.captured_at}
                  className="text-[11px] text-muted-foreground shrink-0 tabular-nums"
                >
                  {formatRelativeTime(item.captured_at)}
                </time>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
