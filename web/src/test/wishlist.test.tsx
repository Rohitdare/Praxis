import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { db } from "@/lib/db/index"
import {
  calculateWishlistSummaries,
  deleteWishlistItem,
  fetchUserWishlist,
  formatCurrency,
  saveWishlistItem,
  updateWishlistStatus,
  type WishlistItem,
} from "@/lib/planner/wishlist-service"
import { WishlistView } from "@/components/planner/wishlist-view"
import { isFeatureDefaultEnabled } from "@/lib/features/registry"

describe("Praxis Optional Module: Wishlist", () => {
  const testUserId = "user-wishlist-test-123"
  const otherUserId = "user-other-456"

  beforeEach(async () => {
    await db.local_items.clear()
    await db.outbox.clear()
  })

  afterEach(async () => {
    await db.local_items.clear()
    await db.outbox.clear()
  })

  describe("1. Feature Registration & Default State", () => {
    it("wishlist is disabled by default in feature registry", () => {
      expect(isFeatureDefaultEnabled("wishlist")).toBe(false)
    })
  })

  describe("2. Wishlist Service Operations & Calculations", () => {
    it("creates a minimal wishlist item with name only", async () => {
      const created = await saveWishlistItem({
        id: crypto.randomUUID(),
        userId: testUserId,
        name: "Mechanical Keyboard",
        priority: "Medium",
        category: "Electronics",
        status: "Want",
        currency: "INR",
        addedDate: "2026-10-23",
      })

      expect(created.id).toBeDefined()
      expect(created.name).toBe("Mechanical Keyboard")
      expect(created.priority).toBe("Medium")
      expect(created.category).toBe("Electronics")
      expect(created.status).toBe("Want")

      const items = await fetchUserWishlist(testUserId)
      expect(items).toHaveLength(1)
      expect(items[0].name).toBe("Mechanical Keyboard")

      // Check Dexie local_items and outbox
      const localItem = await db.local_items.get(created.id)
      expect(localItem).toBeDefined()
      expect(localItem?.ai_tags).toContain("Wishlist")
      expect(localItem?.type).toBe("resource")

      const outboxEntries = await db.outbox.toArray()
      expect(outboxEntries).toHaveLength(1)
      expect(outboxEntries[0].item_id).toBe(created.id)
      expect(outboxEntries[0].operation).toBe("insert")
    })

    it("creates a full wishlist item with all optional fields", async () => {
      await saveWishlistItem({
        id: crypto.randomUUID(),
        userId: testUserId,
        name: "Noise-Cancelling Headphones",
        url: "https://example.com/headphones",
        estimatedPrice: 19999,
        targetPrice: 15000,
        priority: "High",
        category: "Electronics",
        status: "Planning to Buy",
        currency: "INR",
        notes: "Wait for the festival discount",
        addedDate: "2026-10-23",
        targetDate: "2026-11-15",
      })

      const items = await fetchUserWishlist(testUserId)
      expect(items).toHaveLength(1)
      const item = items[0]
      expect(item.name).toBe("Noise-Cancelling Headphones")
      expect(item.url).toBe("https://example.com/headphones")
      expect(item.estimatedPrice).toBe(19999)
      expect(item.targetPrice).toBe(15000)
      expect(item.priority).toBe("High")
      expect(item.notes).toBe("Wait for the festival discount")
      expect(item.targetDate).toBe("2026-11-15")
    })

    it("updates an existing wishlist item and tracks update operation in outbox", async () => {
      const initial = await saveWishlistItem({
        id: "wishlist-item-1",
        userId: testUserId,
        name: "Ergonomic Chair",
        estimatedPrice: 12000,
        priority: "Low",
        category: "Home",
        status: "Want",
        currency: "INR",
        addedDate: "2026-10-23",
      })

      // Edit item
      await saveWishlistItem({
        ...initial,
        estimatedPrice: 10500,
        priority: "High",
        status: "Planning to Buy",
      })

      const items = await fetchUserWishlist(testUserId)
      expect(items[0].estimatedPrice).toBe(10500)
      expect(items[0].priority).toBe("High")
      expect(items[0].status).toBe("Planning to Buy")

      // Outbox should contain update entry
      const outbox = await db.outbox.toArray()
      const updateEntry = outbox.find((o) => o.operation === "update")
      expect(updateEntry).toBeDefined()
      expect(updateEntry?.item_id).toBe("wishlist-item-1")
    })

    it("soft-deletes a wishlist item", async () => {
      await saveWishlistItem({
        id: "wishlist-del-1",
        userId: testUserId,
        name: "Item to Delete",
        priority: "Low",
        category: "Other",
        status: "Want",
        currency: "INR",
        addedDate: "2026-10-23",
      })

      await deleteWishlistItem("wishlist-del-1", testUserId)

      const activeItems = await fetchUserWishlist(testUserId)
      expect(activeItems).toHaveLength(0)

      // In local_items, soft-deleted flag is set
      const rawInDb = await db.local_items.get("wishlist-del-1")
      expect(rawInDb?.deleted_at).not.toBeNull()

      const outbox = await db.outbox.toArray()
      const deleteEntry = outbox.find((o) => o.operation === "delete")
      expect(deleteEntry).toBeDefined()
    })

    it("cycles status and marks item as purchased", async () => {
      await saveWishlistItem({
        id: "item-status-1",
        userId: testUserId,
        name: "Running Shoes",
        estimatedPrice: 4500,
        priority: "Medium",
        category: "Clothing",
        status: "Want",
        currency: "INR",
        addedDate: "2026-10-23",
      })

      await updateWishlistStatus("item-status-1", testUserId, "Purchased")

      const items = await fetchUserWishlist(testUserId)
      expect(items[0].status).toBe("Purchased")
    })

    it("accurately calculates total estimated cost and category counts", () => {
      const items: WishlistItem[] = [
        {
          id: "1",
          userId: testUserId,
          name: "Item 1",
          estimatedPrice: 5000,
          priority: "High",
          category: "Electronics",
          status: "Want",
          currency: "INR",
          addedDate: "2026-10-01",
          createdAt: "2026-10-01T00:00:00.000Z",
          updatedAt: "2026-10-01T00:00:00.000Z",
        },
        {
          id: "2",
          userId: testUserId,
          name: "Item 2",
          estimatedPrice: 3000,
          priority: "Medium",
          category: "Books",
          status: "Planning to Buy",
          currency: "INR",
          addedDate: "2026-10-05",
          createdAt: "2026-10-05T00:00:00.000Z",
          updatedAt: "2026-10-05T00:00:00.000Z",
        },
        {
          id: "3",
          userId: testUserId,
          name: "Item 3",
          estimatedPrice: 2000,
          priority: "Low",
          category: "Clothing",
          status: "Purchased",
          currency: "INR",
          addedDate: "2026-10-10",
          createdAt: "2026-10-10T00:00:00.000Z",
          updatedAt: "2026-10-10T00:00:00.000Z",
        },
        {
          id: "4",
          userId: testUserId,
          name: "Item 4",
          priority: "Low",
          category: "Other",
          status: "Want",
          currency: "INR",
          addedDate: "2026-10-12",
          createdAt: "2026-10-12T00:00:00.000Z",
          updatedAt: "2026-10-12T00:00:00.000Z",
        },
      ]

      const summary = calculateWishlistSummaries(items)
      // Unpurchased items are 1, 2, and 4 (5000 + 3000 = 8000)
      expect(summary.totalEstimatedUnpurchased).toBe(8000)
      expect(summary.wantCount).toBe(2)
      expect(summary.planningCount).toBe(1)
      expect(summary.purchasedCount).toBe(1)
      expect(summary.totalPurchased).toBe(2000)
      expect(summary.totalItems).toBe(4)
    })

    it("formats Indian Rupee (INR ₹) numbers cleanly", () => {
      expect(formatCurrency(0)).toBe("₹0")
      expect(formatCurrency(1500)).toBe("₹1,500")
      expect(formatCurrency(250000)).toBe("₹2,50,000")
    })

    it("strictly isolates items between different users", async () => {
      await saveWishlistItem({
        id: "userA-item",
        userId: testUserId,
        name: "User A Private Wish",
        priority: "High",
        category: "Software",
        status: "Want",
        currency: "INR",
        addedDate: "2026-10-23",
      })

      await saveWishlistItem({
        id: "userB-item",
        userId: otherUserId,
        name: "User B Private Wish",
        priority: "Medium",
        category: "Books",
        status: "Want",
        currency: "INR",
        addedDate: "2026-10-23",
      })

      const userAItems = await fetchUserWishlist(testUserId)
      expect(userAItems).toHaveLength(1)
      expect(userAItems[0].name).toBe("User A Private Wish")

      const userBItems = await fetchUserWishlist(otherUserId)
      expect(userBItems).toHaveLength(1)
      expect(userBItems[0].name).toBe("User B Private Wish")
    })
  })

  describe("3. WishlistView Interactive Component", () => {
    it("renders the Wishlist view with quick-add form, summary metrics, and items", async () => {
      const user = userEvent.setup()

      render(<WishlistView userId={testUserId} selectedDate="2026-10-23" />)

      // Form elements
      expect(screen.getByPlaceholderText("What do you want to buy? *")).toBeInTheDocument()
      expect(screen.getByPlaceholderText("Est. Price (₹)")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Save to Wishlist" })).toBeInTheDocument()

      // Quick add an item
      await user.type(screen.getByPlaceholderText("What do you want to buy? *"), "Kindle Paperwhite")
      await user.type(screen.getByPlaceholderText("Est. Price (₹)"), "14999")
      await user.click(screen.getByRole("button", { name: "Save to Wishlist" }))

      // Item appears in list
      expect(await screen.findByText("Kindle Paperwhite")).toBeInTheDocument()
      const priceBadges = await screen.findAllByText("₹14,999")
      expect(priceBadges.length).toBeGreaterThanOrEqual(2)

      // Summary updates
      expect(screen.getByText("Total Estimated Cost")).toBeInTheDocument()
    })

    it("toggles item status directly between Want and Purchased", async () => {
      const user = userEvent.setup()

      // Prepopulate an item
      await saveWishlistItem({
        id: "toggle-item-1",
        userId: testUserId,
        name: "Coffee Grinder",
        estimatedPrice: 3200,
        priority: "Medium",
        category: "Home",
        status: "Want",
        currency: "INR",
        addedDate: "2026-10-23",
      })

      render(<WishlistView userId={testUserId} selectedDate="2026-10-23" />)

      expect(await screen.findByText("Coffee Grinder")).toBeInTheDocument()

      // Click "Mark as purchased" button
      const purchaseBtn = screen.getByRole("button", { name: "Mark Coffee Grinder as purchased" })
      await user.click(purchaseBtn)

      // Status should update to Purchased and button should become "Mark as unpurchased"
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Mark Coffee Grinder as unpurchased" })
        ).toBeInTheDocument()
      })
    })

    it("filters items by search term and category", async () => {
      const user = userEvent.setup()

      await saveWishlistItem({
        id: "f-1",
        userId: testUserId,
        name: "Sony Alpha Camera",
        priority: "High",
        category: "Electronics",
        status: "Want",
        currency: "INR",
        addedDate: "2026-10-23",
      })

      await saveWishlistItem({
        id: "f-2",
        userId: testUserId,
        name: "Woolen Sweater",
        priority: "Low",
        category: "Clothing",
        status: "Want",
        currency: "INR",
        addedDate: "2026-10-23",
      })

      render(<WishlistView userId={testUserId} selectedDate="2026-10-23" />)

      expect(await screen.findByText("Sony Alpha Camera")).toBeInTheDocument()
      expect(screen.getByText("Woolen Sweater")).toBeInTheDocument()

      // Search for "Camera"
      const searchInput = screen.getByPlaceholderText("Search wishlist...")
      await user.type(searchInput, "Camera")

      expect(screen.getByText("Sony Alpha Camera")).toBeInTheDocument()
      expect(screen.queryByText("Woolen Sweater")).not.toBeInTheDocument()

      // Clear search
      await user.clear(searchInput)
      expect(screen.getByText("Woolen Sweater")).toBeInTheDocument()

      // Filter by category "Clothing"
      const categorySelect = screen.getByLabelText("Filter by Category")
      await user.selectOptions(categorySelect, "Clothing")

      expect(screen.queryByText("Sony Alpha Camera")).not.toBeInTheDocument()
      expect(screen.getByText("Woolen Sweater")).toBeInTheDocument()
    })

    it("sorts items by price high-to-low and low-to-high", async () => {
      const user = userEvent.setup()

      await saveWishlistItem({
        id: "s-1",
        userId: testUserId,
        name: "Budget Book",
        estimatedPrice: 500,
        priority: "Low",
        category: "Books",
        status: "Want",
        currency: "INR",
        addedDate: "2026-10-20",
      })

      await saveWishlistItem({
        id: "s-2",
        userId: testUserId,
        name: "Expensive Laptop",
        estimatedPrice: 95000,
        priority: "High",
        category: "Electronics",
        status: "Want",
        currency: "INR",
        addedDate: "2026-10-21",
      })

      render(<WishlistView userId={testUserId} selectedDate="2026-10-23" />)

      expect(await screen.findByText("Budget Book")).toBeInTheDocument()

      const sortSelect = screen.getByLabelText("Sort wishlist items")
      await user.selectOptions(sortSelect, "price_high_low")

      const itemsHigh = screen.getAllByRole("heading", { level: 3 })
      expect(itemsHigh[0]).toHaveTextContent("Expensive Laptop")
      expect(itemsHigh[1]).toHaveTextContent("Budget Book")

      await user.selectOptions(sortSelect, "price_low_high")
      const itemsLow = screen.getAllByRole("heading", { level: 3 })
      expect(itemsLow[0]).toHaveTextContent("Budget Book")
      expect(itemsLow[1]).toHaveTextContent("Expensive Laptop")
    })

    it("opens external URL safely in new tab", async () => {
      await saveWishlistItem({
        id: "link-item-1",
        userId: testUserId,
        name: "External Product",
        url: "https://praxis.app/ref",
        priority: "Medium",
        category: "Other",
        status: "Want",
        currency: "INR",
        addedDate: "2026-10-23",
      })

      render(<WishlistView userId={testUserId} selectedDate="2026-10-23" />)

      const link = await screen.findByRole("link", { name: "View product link" })
      expect(link).toHaveAttribute("href", "https://praxis.app/ref")
      expect(link).toHaveAttribute("target", "_blank")
      expect(link).toHaveAttribute("rel", "noopener noreferrer")
    })

    it("opens edit modal and saves changes", async () => {
      const user = userEvent.setup()

      await saveWishlistItem({
        id: "edit-test-1",
        userId: testUserId,
        name: "Original Name",
        estimatedPrice: 1000,
        priority: "Low",
        category: "Other",
        status: "Want",
        currency: "INR",
        addedDate: "2026-10-23",
      })

      render(<WishlistView userId={testUserId} selectedDate="2026-10-23" />)

      const editBtn = await screen.findByRole("button", { name: "Edit Original Name" })
      await user.click(editBtn)

      // Dialog opens
      expect(screen.getByRole("dialog")).toBeInTheDocument()
      expect(screen.getByText("Edit Wishlist Item")).toBeInTheDocument()

      const nameInput = screen.getByLabelText("Item Name *")
      await user.clear(nameInput)
      await user.type(nameInput, "Updated Name")

      const saveChangesBtn = screen.getByRole("button", { name: "Save Changes" })
      await user.click(saveChangesBtn)

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
        expect(screen.getByText("Updated Name")).toBeInTheDocument()
      })
    })

    it("confirms and deletes wishlist item via modal", async () => {
      const user = userEvent.setup()

      await saveWishlistItem({
        id: "del-modal-1",
        userId: testUserId,
        name: "Item To Remove",
        priority: "Low",
        category: "Other",
        status: "Want",
        currency: "INR",
        addedDate: "2026-10-23",
      })

      render(<WishlistView userId={testUserId} selectedDate="2026-10-23" />)

      const delBtn = await screen.findByRole("button", { name: "Delete Item To Remove" })
      await user.click(delBtn)

      // Confirmation dialog opens
      expect(screen.getByRole("dialog")).toBeInTheDocument()
      expect(screen.getByText("Delete Wishlist Item?")).toBeInTheDocument()

      const confirmBtn = screen.getByRole("button", { name: "Delete Item" })
      await user.click(confirmBtn)

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
        expect(screen.queryByText("Item To Remove")).not.toBeInTheDocument()
      })
    })
  })
})
