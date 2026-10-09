import { ItemRow } from "./item-row"
import type { InboxItem } from "@/lib/inbox/service"

export interface InboxListProps {
  items: InboxItem[]
  selectedId?: string | null
  deletingIds?: Set<string>
  onSelect?: (id: string) => void
  onDelete: (id: string) => Promise<void> | void
}

export function InboxList({
  items,
  selectedId,
  deletingIds,
  onSelect,
  onDelete,
}: InboxListProps) {
  return (
    <ul
      id="inbox-item-list"
      role="list"
      aria-label="Captured items list"
      className="divide-y divide-border/40 rounded-xl border border-border/40 bg-card/40 overflow-hidden"
    >
      {items.map((item) => (
        <li key={item.id} className="p-0">
          <ItemRow
            item={item}
            isSelected={selectedId === item.id}
            isDeleting={deletingIds?.has(item.id)}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        </li>
      ))}
    </ul>
  )
}
