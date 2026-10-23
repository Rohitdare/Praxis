import { db } from "@/lib/db/index"
import type { LocalItem, OutboxRecord } from "@/lib/db/schema"

export type WishlistCategory =
  | "Electronics"
  | "Clothing"
  | "Books"
  | "Home"
  | "Software"
  | "Other"

export const WISHLIST_CATEGORIES: WishlistCategory[] = [
  "Electronics",
  "Clothing",
  "Books",
  "Home",
  "Software",
  "Other",
]

export type WishlistPriority = "Low" | "Medium" | "High"

export const WISHLIST_PRIORITIES: WishlistPriority[] = ["Low", "Medium", "High"]

export type WishlistStatus = "Want" | "Planning to Buy" | "Purchased"

export const WISHLIST_STATUSES: WishlistStatus[] = ["Want", "Planning to Buy", "Purchased"]

export type WishlistSortOption =
  | "recently_added"
  | "price_low_high"
  | "price_high_low"
  | "priority"
  | "target_date"

export interface WishlistItem {
  id: string
  userId: string
  name: string
  url?: string
  estimatedPrice?: number
  targetPrice?: number
  currency: string // default "INR"
  priority: WishlistPriority
  category: WishlistCategory
  status: WishlistStatus
  notes?: string
  addedDate: string // YYYY-MM-DD
  targetDate?: string // YYYY-MM-DD
  purchasedDate?: string // YYYY-MM-DD
  createdAt: string
  updatedAt: string
}

export interface WishlistFilters {
  search?: string
  category?: string
  priority?: string
  status?: string
  hidePurchased?: boolean
  sortBy?: WishlistSortOption
}

export interface WishlistSummaries {
  totalItems: number
  wantCount: number
  planningCount: number
  purchasedCount: number
  totalEstimatedCost: number
  totalEstimatedUnpurchased: number
  totalPurchasedCost: number
  totalPurchased: number
}

/**
 * Format currency values with INR (₹) as the default.
 */
export function formatCurrency(amount: number, currency: string = "INR"): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount)
  } catch {
    return `₹${amount}`
  }
}

/**
 * Fetch wishlist items for a given user with optional filtering and sorting.
 */
export async function fetchUserWishlist(
  userId: string,
  filters?: WishlistFilters
): Promise<WishlistItem[]> {
  if (!userId) return []

  const items = await db.local_items
    .where("user_id")
    .equals(userId)
    .filter((i) => Boolean(i.ai_tags?.includes("Wishlist") && !i.deleted_at))
    .toArray()

  let wishlist: WishlistItem[] = []
  for (const item of items) {
    try {
      const payload = JSON.parse(item.content || "{}")
      wishlist.push({
        id: item.id,
        userId: item.user_id || userId,
        name: item.title || payload.name || "Untitled Item",
        url: payload.url || undefined,
        estimatedPrice:
          payload.estimatedPrice !== undefined && payload.estimatedPrice !== null
            ? Number(payload.estimatedPrice)
            : undefined,
        targetPrice:
          payload.targetPrice !== undefined && payload.targetPrice !== null
            ? Number(payload.targetPrice)
            : undefined,
        currency: payload.currency || "INR",
        priority: (payload.priority || "Medium") as WishlistPriority,
        category: (payload.category || "Other") as WishlistCategory,
        status: (payload.status || "Want") as WishlistStatus,
        notes: payload.notes || undefined,
        addedDate: payload.addedDate || item.created_at.slice(0, 10),
        targetDate: payload.targetDate || undefined,
        purchasedDate: payload.purchasedDate || undefined,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      })
    } catch {
      // skip corrupted entries
    }
  }

  // Apply filters
  if (filters) {
    if (filters.hidePurchased) {
      wishlist = wishlist.filter((item) => item.status !== "Purchased")
    }

    if (filters.status && filters.status !== "all") {
      wishlist = wishlist.filter((item) => item.status === filters.status)
    }

    if (filters.category && filters.category !== "all") {
      wishlist = wishlist.filter((item) => item.category === filters.category)
    }

    if (filters.priority && filters.priority !== "all") {
      wishlist = wishlist.filter((item) => item.priority === filters.priority)
    }

    if (filters.search?.trim()) {
      const q = filters.search.toLowerCase().trim()
      wishlist = wishlist.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.notes?.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.url?.toLowerCase().includes(q)
      )
    }

    // Apply sorting
    const sortBy = filters.sortBy || "recently_added"
    wishlist.sort((a, b) => {
      switch (sortBy) {
        case "price_low_high":
          return (a.estimatedPrice || 0) - (b.estimatedPrice || 0)
        case "price_high_low":
          return (b.estimatedPrice || 0) - (a.estimatedPrice || 0)
        case "priority": {
          const priorityWeight: Record<WishlistPriority, number> = {
            High: 3,
            Medium: 2,
            Low: 1,
          }
          return priorityWeight[b.priority] - priorityWeight[a.priority]
        }
        case "target_date": {
          if (!a.targetDate && !b.targetDate) return 0
          if (!a.targetDate) return 1
          if (!b.targetDate) return -1
          return a.targetDate.localeCompare(b.targetDate)
        }
        case "recently_added":
        default:
          return b.createdAt.localeCompare(a.createdAt)
      }
    })
  } else {
    // Default sort: recently added descending
    wishlist.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  return wishlist
}

/**
 * Save a wishlist item (create or update).
 */
export async function saveWishlistItem(
  item: Omit<WishlistItem, "createdAt" | "updatedAt"> & {
    createdAt?: string
    updatedAt?: string
  }
): Promise<WishlistItem> {
  const now = new Date().toISOString()
  const itemId = item.id || crypto.randomUUID()
  const createdAt = item.createdAt || now
  const updatedAt = now

  const payloadContent = JSON.stringify({
    name: item.name,
    url: item.url || undefined,
    estimatedPrice: item.estimatedPrice,
    targetPrice: item.targetPrice,
    currency: item.currency || "INR",
    priority: item.priority || "Medium",
    category: item.category || "Other",
    status: item.status || "Want",
    notes: item.notes || undefined,
    addedDate: item.addedDate || createdAt.slice(0, 10),
    targetDate: item.targetDate || undefined,
    purchasedDate: item.purchasedDate || undefined,
  })

  const rawInput = `Wishlist: ${item.name} (${item.category}${
    item.estimatedPrice ? ` - ${formatCurrency(item.estimatedPrice, item.currency)}` : ""
  })`

  const localItem: LocalItem = {
    id: itemId,
    user_id: item.userId,
    raw_input: rawInput,
    title: item.name,
    content: payloadContent,
    type: "resource",
    status: item.status === "Purchased" ? "done" : "active",
    captured_at: createdAt,
    created_at: createdAt,
    updated_at: updatedAt,
    deleted_at: null,
    ai_tags: ["Wishlist"],
    synced: false,
  }

  const existing = await db.local_items.get(itemId)

  const outboxRecord: OutboxRecord = {
    id: crypto.randomUUID(),
    item_id: itemId,
    user_id: item.userId,
    operation: existing ? "update" : "insert",
    payload: localItem,
    status: "pending",
    created_at: now,
    updated_at: now,
    retry_count: 0,
    last_error: null,
  }

  await db.transaction("rw", [db.local_items, db.outbox], async () => {
    await db.local_items.put(localItem)
    await db.outbox.put(outboxRecord)
  })

  return {
    ...item,
    id: itemId,
    currency: item.currency || "INR",
    priority: item.priority || "Medium",
    category: item.category || "Other",
    status: item.status || "Want",
    addedDate: item.addedDate || createdAt.slice(0, 10),
    createdAt,
    updatedAt,
  }
}

/**
 * Quick status updater (e.g. mark as Purchased, Want, or Planning to Buy).
 */
export async function updateWishlistStatus(
  itemId: string,
  userId: string,
  status: WishlistStatus
): Promise<WishlistItem | null> {
  const existing = await db.local_items.get(itemId)
  if (!existing || existing.user_id !== userId) return null

  let payload: Record<string, any> = {}
  try {
    payload = JSON.parse(existing.content || "{}")
  } catch {
    // skip
  }

  const now = new Date().toISOString()
  const todayDateStr = now.slice(0, 10)

  payload.status = status
  if (status === "Purchased") {
    payload.purchasedDate = todayDateStr
  } else {
    payload.purchasedDate = undefined
  }

  const updatedItem: LocalItem = {
    ...existing,
    content: JSON.stringify(payload),
    status: status === "Purchased" ? "done" : "active",
    updated_at: now,
    synced: false,
  }

  const outboxRecord: OutboxRecord = {
    id: crypto.randomUUID(),
    item_id: itemId,
    user_id: userId,
    operation: "update",
    payload: updatedItem,
    status: "pending",
    created_at: now,
    updated_at: now,
    retry_count: 0,
    last_error: null,
  }

  await db.transaction("rw", [db.local_items, db.outbox], async () => {
    await db.local_items.put(updatedItem)
    await db.outbox.put(outboxRecord)
  })

  return {
    id: itemId,
    userId,
    name: existing.title || payload.name || "Untitled Item",
    url: payload.url,
    estimatedPrice: payload.estimatedPrice,
    targetPrice: payload.targetPrice,
    currency: payload.currency || "INR",
    priority: payload.priority || "Medium",
    category: payload.category || "Other",
    status,
    notes: payload.notes,
    addedDate: payload.addedDate || existing.created_at.slice(0, 10),
    targetDate: payload.targetDate,
    purchasedDate: payload.purchasedDate,
    createdAt: existing.created_at,
    updatedAt: now,
  }
}

/**
 * Soft-delete a wishlist item.
 */
export async function deleteWishlistItem(itemId: string, userId: string): Promise<void> {
  const existing = await db.local_items.get(itemId)
  if (!existing || existing.user_id !== userId) return

  const now = new Date().toISOString()
  const updatedItem: LocalItem = {
    ...existing,
    deleted_at: now,
    updated_at: now,
    synced: false,
  }

  const outboxRecord: OutboxRecord = {
    id: crypto.randomUUID(),
    item_id: itemId,
    user_id: userId,
    operation: "delete",
    payload: updatedItem,
    status: "pending",
    created_at: now,
    updated_at: now,
    retry_count: 0,
    last_error: null,
  }

  await db.transaction("rw", [db.local_items, db.outbox], async () => {
    await db.local_items.put(updatedItem)
    await db.outbox.put(outboxRecord)
  })
}

/**
 * Calculate wishlist summaries and metrics.
 */
export function calculateWishlistSummaries(items: WishlistItem[]): WishlistSummaries {
  let wantCount = 0
  let planningCount = 0
  let purchasedCount = 0
  let totalEstimatedCost = 0
  let totalPurchasedCost = 0

  for (const item of items) {
    if (item.status === "Purchased") {
      purchasedCount++
      if (item.estimatedPrice) {
        totalPurchasedCost += item.estimatedPrice
      }
    } else {
      if (item.status === "Want") wantCount++
      if (item.status === "Planning to Buy") planningCount++
      if (item.estimatedPrice) {
        totalEstimatedCost += item.estimatedPrice
      }
    }
  }

  return {
    totalItems: items.length,
    wantCount,
    planningCount,
    purchasedCount,
    totalEstimatedCost,
    totalEstimatedUnpurchased: totalEstimatedCost,
    totalPurchasedCost,
    totalPurchased: totalPurchasedCost,
  }
}
