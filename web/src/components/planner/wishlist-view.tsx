import * as React from "react"
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Circle,
  Code,
  Edit2,
  ExternalLink,
  Heart,
  Home,
  Laptop,
  Plus,
  Search,
  Shirt,
  SlidersHorizontal,
  Tag,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  WISHLIST_CATEGORIES,
  WISHLIST_PRIORITIES,
  WISHLIST_STATUSES,
  calculateWishlistSummaries,
  deleteWishlistItem,
  fetchUserWishlist,
  formatCurrency,
  saveWishlistItem,
  updateWishlistStatus,
  type WishlistCategory,
  type WishlistItem,
  type WishlistPriority,
  type WishlistSortOption,
  type WishlistStatus,
} from "@/lib/planner/wishlist-service"

interface WishlistViewProps {
  userId: string
  selectedDate?: string
}

// Category icon helper
function getCategoryIcon(category: WishlistCategory, className = "size-4") {
  switch (category) {
    case "Electronics":
      return <Laptop className={className} />
    case "Clothing":
      return <Shirt className={className} />
    case "Books":
      return <BookOpen className={className} />
    case "Home":
      return <Home className={className} />
    case "Software":
      return <Code className={className} />
    case "Other":
    default:
      return <Tag className={className} />
  }
}

// Priority badge styling
function getPriorityBadgeClass(priority: WishlistPriority) {
  switch (priority) {
    case "High":
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
    case "Medium":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
    case "Low":
    default:
      return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30"
  }
}

// Status badge styling
function getStatusBadgeClass(status: WishlistStatus) {
  switch (status) {
    case "Purchased":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
    case "Planning to Buy":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
    case "Want":
    default:
      return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30"
  }
}

export function WishlistView({ userId, selectedDate }: WishlistViewProps) {
  // Data states
  const [items, setItems] = React.useState<WishlistItem[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  // Quick-Add Form States
  const [name, setName] = React.useState("")
  const [estimatedPrice, setEstimatedPrice] = React.useState("")
  const [category, setCategory] = React.useState<WishlistCategory>("Other")
  const [priority, setPriority] = React.useState<WishlistPriority>("Medium")
  const [targetPrice, setTargetPrice] = React.useState("")
  const [url, setUrl] = React.useState("")
  const [targetDate, setTargetDate] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [showExtraFields, setShowExtraFields] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Filter & Search States
  const [searchQuery, setSearchQuery] = React.useState("")
  const [filterCategory, setFilterCategory] = React.useState<string>("all")
  const [filterPriority, setFilterPriority] = React.useState<string>("all")
  const [filterStatus, setFilterStatus] = React.useState<string>("all")
  const [hidePurchased, setHidePurchased] = React.useState(false)
  const [sortBy, setSortBy] = React.useState<WishlistSortOption>("recently_added")

  // Editing & Deleting Modals
  const [editingItem, setEditingItem] = React.useState<WishlistItem | null>(null)
  const [deletingItemId, setDeletingItemId] = React.useState<string | null>(null)

  // Load wishlist items
  const loadData = React.useCallback(async () => {
    if (!userId) return
    setIsLoading(true)
    try {
      const data = await fetchUserWishlist(userId)
      setItems(data)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  React.useEffect(() => {
    void loadData()
  }, [loadData])

  // Summaries calculation
  const summaries = React.useMemo(() => calculateWishlistSummaries(items), [items])

  // Filtered & Sorted items
  const displayedItems = React.useMemo(() => {
    let result = [...items]

    if (hidePurchased) {
      result = result.filter((i) => i.status !== "Purchased")
    }

    if (filterStatus !== "all") {
      result = result.filter((i) => i.status === filterStatus)
    }

    if (filterCategory !== "all") {
      result = result.filter((i) => i.category === filterCategory)
    }

    if (filterPriority !== "all") {
      result = result.filter((i) => i.priority === filterPriority)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.notes?.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          i.url?.toLowerCase().includes(q)
      )
    }

    // Sort items
    result.sort((a, b) => {
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

    return result
  }, [items, hidePurchased, filterStatus, filterCategory, filterPriority, searchQuery, sortBy])

  // Quick-Add submission
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !userId || isSubmitting) return

    setIsSubmitting(true)
    try {
      const numEstimated = estimatedPrice ? parseFloat(estimatedPrice) : undefined
      const numTarget = targetPrice ? parseFloat(targetPrice) : undefined

      const saved = await saveWishlistItem({
        id: crypto.randomUUID(),
        userId,
        name: name.trim(),
        url: url.trim() || undefined,
        estimatedPrice: numEstimated,
        targetPrice: numTarget,
        currency: "INR",
        priority,
        category,
        status: "Want",
        notes: notes.trim() || undefined,
        addedDate: selectedDate || new Date().toISOString().slice(0, 10),
        targetDate: targetDate || undefined,
      })

      setItems((prev) => [saved, ...prev])
      setName("")
      setEstimatedPrice("")
      setTargetPrice("")
      setUrl("")
      setTargetDate("")
      setNotes("")
      setShowExtraFields(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Quick Status Toggle (Want -> Planning to Buy -> Purchased)
  const handleTogglePurchased = async (item: WishlistItem) => {
    if (!userId) return
    const nextStatus: WishlistStatus = item.status === "Purchased" ? "Want" : "Purchased"
    const updated = await updateWishlistStatus(item.id, userId, nextStatus)
    if (updated) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)))
    }
  }

  const handleCycleStatus = async (item: WishlistItem) => {
    if (!userId) return
    let nextStatus: WishlistStatus = "Want"
    if (item.status === "Want") nextStatus = "Planning to Buy"
    else if (item.status === "Planning to Buy") nextStatus = "Purchased"
    else if (item.status === "Purchased") nextStatus = "Want"

    const updated = await updateWishlistStatus(item.id, userId, nextStatus)
    if (updated) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)))
    }
  }

  // Edit Submission
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem || !editingItem.name.trim() || !userId) return

    const saved = await saveWishlistItem(editingItem)
    setItems((prev) => prev.map((i) => (i.id === saved.id ? saved : i)))
    setEditingItem(null)
  }

  // Delete Confirmation
  const handleConfirmDelete = async () => {
    if (!deletingItemId || !userId) return
    await deleteWishlistItem(deletingItemId, userId)
    setItems((prev) => prev.filter((i) => i.id !== deletingItemId))
    setDeletingItemId(null)
  }

  return (
    <div className="space-y-6" data-testid="wishlist-view">
      {/* Top Banner: Metrics & Estimated Total Cost */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Estimated Total for Unpurchased */}
        <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-card/60 shadow-2xs space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Total Estimated Cost
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-heading font-extrabold text-foreground">
              {formatCurrency(summaries.totalEstimatedCost)}
            </span>
            <span className="text-xs text-muted-foreground">
              {summaries.wantCount + summaries.planningCount} unpurchased
            </span>
          </div>
        </div>

        {/* Priority Breakdown (Want vs Planning) */}
        <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-card/60 shadow-2xs space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Wishlist Items
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-heading font-extrabold text-foreground">
              {summaries.totalItems}
            </span>
            <span className="text-xs text-muted-foreground">
              {summaries.planningCount} planning to buy
            </span>
          </div>
        </div>

        {/* Purchased Items */}
        <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-card/60 shadow-2xs space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Purchased
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-heading font-extrabold text-foreground">
              {summaries.purchasedCount}
            </span>
            {summaries.totalPurchasedCost > 0 && (
              <span className="text-xs text-muted-foreground">
                {formatCurrency(summaries.totalPurchasedCost)} spent
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Quick Add Form Card */}
      <section className="p-4 sm:p-5 rounded-xl border border-border/80 bg-card/70 shadow-2xs space-y-4">
        <header className="flex items-center justify-between">
          <h2 className="text-sm font-heading font-bold text-foreground flex items-center gap-2">
            <Plus className="size-4 text-primary" />
            <span>Add to Wishlist</span>
          </h2>
          <span className="text-[11px] text-muted-foreground">
            Save items to purchase later
          </span>
        </header>

        <form onSubmit={handleAddItem} className="space-y-3.5">
          {/* Main required inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <div className="sm:col-span-2">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What do you want to buy? *"
                aria-label="Wishlist Item Name"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-background border border-border/80 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-primary/40 font-medium placeholder:text-muted-foreground/60"
              />
            </div>

            <div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={estimatedPrice}
                  onChange={(e) => setEstimatedPrice(e.target.value)}
                  placeholder="Est. Price (₹)"
                  aria-label="Estimated Price"
                  className="w-full pl-7 pr-3 py-2 sm:py-2.5 text-xs sm:text-sm bg-background border border-border/80 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-primary/40 font-mono placeholder:text-muted-foreground/60"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as WishlistCategory)}
                aria-label="Item Category"
                className="flex-1 px-2.5 py-2 sm:py-2.5 text-xs bg-background border border-border/80 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-primary/40"
              >
                {WISHLIST_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as WishlistPriority)}
                aria-label="Item Priority"
                className="w-24 px-2 py-2 sm:py-2.5 text-xs bg-background border border-border/80 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-primary/40"
              >
                {WISHLIST_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Secondary collapsible fields */}
          <div>
            <button
              type="button"
              onClick={() => setShowExtraFields(!showExtraFields)}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <SlidersHorizontal className="size-3" />
              <span>
                {showExtraFields ? "Hide extra details" : "Add URL, target price, target date, or notes"}
              </span>
            </button>

            {showExtraFields && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2.5 mt-2 border-t border-border/50 text-xs">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                    Product / Reference URL
                  </label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-2.5 py-1.5 bg-background border border-border/80 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                    Target / Sale Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    placeholder="Target (₹)"
                    className="w-full px-2.5 py-1.5 bg-background border border-border/80 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                    Target Date
                  </label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-background border border-border/80 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Specs, variant, or why you want it"
                    className="w-full px-2.5 py-1.5 bg-background border border-border/80 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-end pt-1">
            <Button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="rounded-xl px-5 py-2 text-xs font-semibold shadow-2xs min-h-[38px] w-full sm:w-auto"
            >
              {isSubmitting ? "Saving..." : "Save to Wishlist"}
            </Button>
          </div>
        </form>
      </section>

      {/* Search, Filters & Sorting Bar */}
      <section className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-xl border border-border/60 bg-muted/20">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search wishlist..."
            aria-label="Search wishlist"
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border/70 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Category Filter */}
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          aria-label="Filter by Category"
          className="px-2.5 py-1.5 text-xs bg-background border border-border/70 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary"
        >
          <option value="all">All Categories</option>
          {WISHLIST_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* Priority Filter */}
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          aria-label="Filter by Priority"
          className="px-2.5 py-1.5 text-xs bg-background border border-border/70 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary"
        >
          <option value="all">All Priorities</option>
          {WISHLIST_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          aria-label="Filter by Status"
          className="px-2.5 py-1.5 text-xs bg-background border border-border/70 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary"
        >
          <option value="all">All Statuses</option>
          {WISHLIST_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as WishlistSortOption)}
          aria-label="Sort wishlist items"
          className="px-2.5 py-1.5 text-xs bg-background border border-border/70 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary"
        >
          <option value="recently_added">Recently Added</option>
          <option value="price_low_high">Price: Low to High</option>
          <option value="price_high_low">Price: High to Low</option>
          <option value="priority">Priority: High to Low</option>
          <option value="target_date">Target Date</option>
        </select>

        {/* Hide Purchased Checkbox */}
        <label className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            checked={hidePurchased}
            onChange={(e) => setHidePurchased(e.target.checked)}
            className="rounded border-border text-primary focus:ring-primary size-3.5"
          />
          <span>Hide Purchased</span>
        </label>
      </section>

      {/* Wishlist Items List */}
      {isLoading ? (
        <div className="flex h-36 items-center justify-center text-xs text-muted-foreground animate-pulse">
          Loading wishlist...
        </div>
      ) : displayedItems.length === 0 ? (
        <div className="p-8 text-center rounded-xl border border-dashed border-border/80 bg-card/30 space-y-2">
          <Heart className="size-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm font-medium text-foreground">No wishlist items found</p>
          <p className="text-xs text-muted-foreground">
            {items.length === 0
              ? "Add your first item above to start tracking desired purchases, target prices, and priorities."
              : "No items match your active filters."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/50 border border-border/70 rounded-xl bg-card/60 overflow-hidden shadow-2xs">
          {displayedItems.map((item) => {
            const isPurchased = item.status === "Purchased"
            const priorityBadge = getPriorityBadgeClass(item.priority)
            const statusBadge = getStatusBadgeClass(item.status)

            return (
              <div
                key={item.id}
                className={`p-3.5 sm:px-4 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors ${
                  isPurchased ? "opacity-75 bg-muted/15" : ""
                }`}
              >
                {/* Left: Checkbox + Category Icon + Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => handleTogglePurchased(item)}
                    className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                    title={isPurchased ? "Mark as unpurchased" : "Mark as purchased"}
                    aria-label={
                      isPurchased
                        ? `Mark ${item.name} as unpurchased`
                        : `Mark ${item.name} as purchased`
                    }
                  >
                    {isPurchased ? (
                      <CheckCircle2 className="size-5 text-emerald-500 fill-emerald-500/20" />
                    ) : (
                      <Circle className="size-5" />
                    )}
                  </button>

                  <div className="size-9 rounded-xl bg-secondary flex items-center justify-center shrink-0 text-foreground">
                    {getCategoryIcon(item.category, "size-4 text-primary")}
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        className={`text-xs sm:text-sm font-semibold truncate ${
                          isPurchased
                            ? "line-through text-muted-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {item.name}
                      </h3>

                      {/* Safe URL Link */}
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
                          title="Open product link in new tab"
                          aria-label="View product link"
                        >
                          <ExternalLink className="size-3" />
                          <span>Link</span>
                        </a>
                      )}

                      {/* Priority pill */}
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${priorityBadge}`}
                      >
                        {item.priority}
                      </span>

                      {/* Status pill (Clickable to cycle) */}
                      <button
                        type="button"
                        onClick={() => handleCycleStatus(item)}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors hover:brightness-95 ${statusBadge}`}
                        title="Click to cycle status"
                      >
                        <span>{item.status}</span>
                      </button>
                    </div>

                    {/* Metadata & Notes */}
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                      <span>{item.category}</span>
                      {item.targetDate && (
                        <span className="inline-flex items-center gap-1">
                          • <Calendar className="size-3" /> Target: {item.targetDate}
                        </span>
                      )}
                      {item.notes && (
                        <span className="italic truncate max-w-[200px] sm:max-w-[320px]">
                          • {item.notes}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Prices + Action Buttons */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    {item.estimatedPrice !== undefined && (
                      <div
                        className={`font-heading font-extrabold text-sm sm:text-base ${
                          isPurchased ? "text-muted-foreground" : "text-foreground"
                        }`}
                      >
                        {formatCurrency(item.estimatedPrice, item.currency)}
                      </div>
                    )}
                    {item.targetPrice !== undefined && (
                      <div className="text-[10px] text-muted-foreground font-mono">
                        Target: {formatCurrency(item.targetPrice, item.currency)}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingItem(item)}
                      className="size-7 rounded-md p-0 inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                      title="Edit Item"
                      aria-label={`Edit ${item.name}`}
                    >
                      <Edit2 className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingItemId(item.id)}
                      className="size-7 rounded-md p-0 inline-flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Delete Item"
                      aria-label={`Delete ${item.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* EDIT ITEM MODAL */}
      {editingItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-wishlist-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs"
        >
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md p-5 rounded-2xl border border-border/80 bg-card shadow-lg space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
              <h3 id="edit-wishlist-title" className="text-sm font-heading font-bold text-foreground">
                Edit Wishlist Item
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label htmlFor="edit-item-name" className="block text-[11px] font-medium text-foreground mb-1">
                  Item Name *
                </label>
                <input
                  id="edit-item-name"
                  type="text"
                  required
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full px-3 py-1.5 bg-background border border-border/80 rounded-lg focus:ring-1 focus:ring-primary font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-foreground mb-1">
                    Category
                  </label>
                  <select
                    value={editingItem.category}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        category: e.target.value as WishlistCategory,
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-background border border-border/80 rounded-lg focus:ring-1 focus:ring-primary"
                  >
                    {WISHLIST_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-foreground mb-1">
                    Priority
                  </label>
                  <select
                    value={editingItem.priority}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        priority: e.target.value as WishlistPriority,
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-background border border-border/80 rounded-lg focus:ring-1 focus:ring-primary"
                  >
                    {WISHLIST_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-foreground mb-1">
                    Status
                  </label>
                  <select
                    value={editingItem.status}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        status: e.target.value as WishlistStatus,
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-background border border-border/80 rounded-lg focus:ring-1 focus:ring-primary"
                  >
                    {WISHLIST_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-foreground mb-1">
                    Estimated Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editingItem.estimatedPrice ?? ""}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        estimatedPrice: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-background border border-border/80 rounded-lg focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-foreground mb-1">
                    Target / Sale Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editingItem.targetPrice ?? ""}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        targetPrice: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-background border border-border/80 rounded-lg focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-foreground mb-1">
                    Target Date
                  </label>
                  <input
                    type="date"
                    value={editingItem.targetDate || ""}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, targetDate: e.target.value || undefined })
                    }
                    className="w-full px-2.5 py-1.5 bg-background border border-border/80 rounded-lg focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-foreground mb-1">
                  Reference URL
                </label>
                <input
                  type="url"
                  value={editingItem.url || ""}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, url: e.target.value || undefined })
                  }
                  placeholder="https://..."
                  className="w-full px-2.5 py-1.5 bg-background border border-border/80 rounded-lg focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-foreground mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={editingItem.notes || ""}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, notes: e.target.value || undefined })
                  }
                  className="w-full px-2.5 py-1.5 bg-background border border-border/80 rounded-lg focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingItem(null)}
                className="text-xs rounded-lg"
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" className="text-xs rounded-lg">
                Save Changes
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {deletingItemId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-wishlist-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs"
        >
          <div className="w-full max-w-sm p-5 rounded-2xl border border-border/80 bg-card shadow-lg space-y-3">
            <h3 id="delete-wishlist-title" className="text-sm font-heading font-bold text-foreground">
              Delete Wishlist Item?
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to remove this item from your wishlist? It will be safely soft-deleted.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeletingItemId(null)}
                className="text-xs rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleConfirmDelete}
                className="text-xs rounded-lg"
              >
                Delete Item
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
