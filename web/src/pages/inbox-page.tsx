import * as React from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/lib/auth/auth-context"
import { useSync } from "@/lib/sync/sync-context"
import { InboxFilters } from "@/components/inbox/inbox-filters"
import { InboxEmptyState } from "@/components/inbox/inbox-empty-state"
import { InboxList } from "@/components/inbox/inbox-list"
import {
  countInboxItemsByFilter,
  fetchInboxItems,
  filterInboxItems,
  softDeleteItem,
  type InboxFilterType,
  type InboxItem,
} from "@/lib/inbox/service"

export function InboxPage() {
  const { user } = useAuth()
  const { syncState } = useSync()
  const navigate = useNavigate()

  const [items, setItems] = React.useState<InboxItem[]>([])
  const [filter, setFilter] = React.useState<InboxFilterType>("all")
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [deletingIds, setDeletingIds] = React.useState<Set<string>>(new Set())
  const [hasFetchError, setHasFetchError] = React.useState(false)

  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true

  const userId = user?.id

  // Load items on mount, user change, or when sync transitions to synced
  const loadItems = React.useCallback(async () => {
    try {
      const result = await fetchInboxItems({
        userId,
        isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      })
      setItems(result.items)
      setHasFetchError(!!result.error)
    } catch {
      setHasFetchError(true)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  React.useEffect(() => {
    void loadItems()
  }, [loadItems])

  // Re-fetch when browser comes back online
  React.useEffect(() => {
    const handleOnline = () => {
      void loadItems()
    }
    window.addEventListener("online", handleOnline)
    return () => window.removeEventListener("online", handleOnline)
  }, [loadItems])

  // Re-fetch when outbox sync finishes
  React.useEffect(() => {
    if (syncState.status === "synced" && syncState.pendingCount === 0) {
      void loadItems()
    }
  }, [syncState.status, syncState.pendingCount, loadItems])

  const handleDelete = async (id: string) => {
    // 1. Optimistic removal from UI list
    setDeletingIds((prev) => new Set(prev).add(id))
    const previousItems = items
    setItems((prev) => prev.filter((item) => item.id !== id))

    try {
      // 2. Perform soft delete in IndexedDB + outbox
      await softDeleteItem(id)
    } catch (err) {
      console.error("Failed to soft-delete item:", err)
      // Rollback on unexpected failure
      setItems(previousItems)
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const filteredItems = filterInboxItems(items, filter)
  const filterCounts = countInboxItemsByFilter(items)

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Header with Title and Item Count */}
      <div className="flex items-baseline justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="font-heading font-extrabold text-2xl md:text-3xl tracking-tight text-foreground">
            Inbox
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Triage newly captured notes, links, and ideas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isOnline && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium border border-amber-500/20">
              Offline mode
            </span>
          )}
          {hasFetchError && isOnline && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium border border-border/60">
              Local cache
            </span>
          )}
          <span className="text-xs font-medium text-muted-foreground tabular-nums bg-muted/50 px-2.5 py-0.5 rounded-full border border-border/60">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        </div>
      </div>

      {/* Filter Chips Bar */}
      {items.length > 0 && (
        <InboxFilters
          currentFilter={filter}
          counts={filterCounts}
          onFilterChange={(newFilter) => setFilter(newFilter)}
        />
      )}

      {/* Content Stream */}
      {isLoading ? (
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground animate-pulse">Loading inbox...</p>
        </div>
      ) : items.length === 0 ? (
        <InboxEmptyState isFiltered={false} />
      ) : filteredItems.length === 0 ? (
        <InboxEmptyState isFiltered={true} onClearFilter={() => setFilter("all")} />
      ) : (
        <InboxList
          items={filteredItems}
          selectedId={selectedId}
          deletingIds={deletingIds}
          onSelect={(id) => {
            setSelectedId(id)
            navigate(`/items/${id}`)
          }}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
