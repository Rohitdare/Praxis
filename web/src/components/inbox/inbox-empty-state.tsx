import { Link } from "react-router-dom"
import { Inbox, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface InboxEmptyStateProps {
  isFiltered?: boolean
  onClearFilter?: () => void
}

export function InboxEmptyState({ isFiltered = false, onClearFilter }: InboxEmptyStateProps) {
  if (isFiltered) {
    return (
      <div className="py-12 px-4 text-center space-y-3">
        <p className="text-sm text-muted-foreground">No items in this category.</p>
        {onClearFilter && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearFilter}
            className="text-xs text-foreground/80 hover:text-foreground"
          >
            View all items
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="py-16 px-4 text-center space-y-4">
      <div className="mx-auto size-10 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
        <Inbox className="size-5" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          Nothing waiting. Capture something when you find it.
        </p>
        <p className="text-xs text-muted-foreground">
          Notes, links, and ideas captured from the capture bar will show up here.
        </p>
      </div>
      <div>
        <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs">
          <Link to="/capture">
            <Plus className="size-3.5" aria-hidden="true" />
            Capture something
          </Link>
        </Button>
      </div>
    </div>
  )
}
