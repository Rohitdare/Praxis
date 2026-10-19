import { Link } from "react-router-dom"
import { FileText, Link as LinkIcon } from "lucide-react"
import type { LocalItem } from "@/lib/db/schema"
import { formatRelativeTime } from "@/lib/inbox/service"

export interface RecentCapturesProps {
  items: LocalItem[]
  isLoading?: boolean
  onSelectCapture?: (id: string) => void
}

function isLikelyUrl(text: string): boolean {
  return /^https?:\/\//i.test(text.trim())
}

export function RecentCaptures({ items, isLoading, onSelectCapture }: RecentCapturesProps) {
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
        className="font-heading text-xs font-bold uppercase tracking-wider text-muted-foreground/90"
      >
        Recent captures
      </h2>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground/80 py-6 text-center border border-dashed border-border/80 rounded-xl bg-muted/10">
          No captures yet. Anything you type above will be saved locally.
        </p>
      ) : (
        <ul className="divide-y divide-border/50 rounded-xl border border-border/80 bg-card/70 overflow-hidden shadow-2xs">
          {items.map((item) => {
            const isUrl = isLikelyUrl(item.raw_input)
            const titleText = item.title?.trim()
            const rawText = item.raw_input?.trim()
            const contentText = item.content?.trim()
            const displayTitle =
              titleText && titleText !== "Untitled Note"
                ? titleText
                : rawText && rawText !== "Untitled Note" && rawText !== "New note"
                ? rawText
                : contentText
                ? contentText.split("\n")[0].slice(0, 80)
                : titleText || rawText || "Untitled Note"
            return (
              <li key={item.id} className="transition-colors">
                <Link
                  to={`/items/${item.id}`}
                  onClick={() => onSelectCapture?.(item.id)}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 cursor-pointer select-none"
                  aria-label={`Open capture: ${displayTitle}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {isUrl ? (
                      <LinkIcon
                        className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0"
                        aria-label="Link capture"
                      />
                    ) : (
                      <FileText
                        className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0"
                        aria-label="Note capture"
                      />
                    )}
                    <span className="text-xs text-foreground truncate font-normal group-hover:text-foreground transition-colors">
                      {displayTitle}
                    </span>
                  </div>

                  <time
                    dateTime={item.captured_at}
                    className="text-[11px] text-muted-foreground shrink-0 tabular-nums"
                  >
                    {formatRelativeTime(item.captured_at)}
                  </time>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
