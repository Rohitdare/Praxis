import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { db } from "@/lib/db/index"
import {
  archiveAccount,
  calculateExpenseSummaries,
  deleteExpense,
  fetchMonthlyBudget,
  fetchUserAccounts,
  fetchUserExpenses,
  formatCurrency,
  generateExpenseCsv,
  saveAccount,
  saveExpense,
  saveMonthlyBudget,
  type ExpenseItem,
} from "@/lib/planner/expense-service"
import { ExpenseTrackerView } from "@/components/planner/expense-tracker-view"
import { isFeatureDefaultEnabled } from "@/lib/features/registry"

describe("Praxis Optional Module: Expense Tracker", () => {
  const testUserId = "user-expense-test-123"
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
    it("expense_tracker is disabled by default in feature registry", () => {
      expect(isFeatureDefaultEnabled("expense_tracker")).toBe(false)
    })
  })

  describe("2. Payment Accounts Management", () => {
    it("auto-initializes default starter accounts (Cash & Primary Bank) when user has none", async () => {
      const accounts = await fetchUserAccounts(testUserId)
      expect(accounts.length).toBe(2)
      const names = accounts.map((a) => a.name)
      expect(names).toContain("Cash")
      expect(names).toContain("Primary Bank")
    })

    it("allows creating and editing payment accounts", async () => {
      const newAccount = await saveAccount({
        id: crypto.randomUUID(),
        userId: testUserId,
        name: "HDFC Salary",
        bankName: "HDFC Bank",
        type: "Bank Account",
        color: "emerald",
        icon: "landmark",
        openingBalance: 50000,
        isArchived: false,
        createdAt: new Date().toISOString(),
      })

      const accounts = await fetchUserAccounts(testUserId)
      const found = accounts.find((a) => a.id === newAccount.id)
      expect(found).toBeDefined()
      expect(found?.name).toBe("HDFC Salary")
      expect(found?.color).toBe("emerald")

      // Update account name
      await saveAccount({
        ...found!,
        name: "HDFC Savings Main",
      })

      const updatedAccounts = await fetchUserAccounts(testUserId)
      const updatedFound = updatedAccounts.find((a) => a.id === newAccount.id)
      expect(updatedFound?.name).toBe("HDFC Savings Main")
    })

    it("safe archival marks account archived without deleting historical data", async () => {
      const account = await saveAccount({
        id: "acc-to-archive",
        userId: testUserId,
        name: "Old Credit Card",
        type: "Credit Card",
        color: "rose",
        icon: "credit-card",
        openingBalance: 0,
        isArchived: false,
        createdAt: new Date().toISOString(),
      })

      // Link an expense to it
      await saveExpense({
        id: "exp-1",
        userId: testUserId,
        amount: 1500,
        currency: "INR",
        category: "Shopping",
        accountId: account.id,
        accountName: account.name,
        date: "2026-10-23",
      })

      // Archive account
      await archiveAccount(account.id, testUserId, true)

      const accounts = await fetchUserAccounts(testUserId)
      const archivedAcc = accounts.find((a) => a.id === account.id)
      expect(archivedAcc?.isArchived).toBe(true)

      // Expense remains completely intact with account association
      const expenses = await fetchUserExpenses(testUserId)
      expect(expenses.length).toBe(1)
      expect(expenses[0].accountId).toBe("acc-to-archive")
      expect(expenses[0].accountName).toBe("Old Credit Card")
    })
  })

  describe("3. Quick Expense Entry & CRUD", () => {
    it("creates an expense with required fields and outbox sync entry", async () => {
      const exp = await saveExpense({
        id: crypto.randomUUID(),
        userId: testUserId,
        amount: 250.5,
        currency: "INR",
        category: "Food",
        accountId: "acc-cash",
        accountName: "Cash",
        description: "Lunch at cafe",
        date: "2026-10-23",
        time: "13:30",
        notes: "Splits with team",
      })

      expect(exp.amount).toBe(250.5)
      expect(exp.category).toBe("Food")
      expect(exp.accountName).toBe("Cash")

      const items = await fetchUserExpenses(testUserId)
      expect(items.length).toBe(1)
      expect(items[0].description).toBe("Lunch at cafe")

      // Verify outbox replication record
      const outboxEntries = await db.outbox.toArray()
      expect(outboxEntries.length).toBe(1)
      expect(outboxEntries[0].operation).toBe("insert")
      expect(outboxEntries[0].item_id).toBe(exp.id)
    })

    it("edits and soft-deletes an expense", async () => {
      const exp = await saveExpense({
        id: "exp-edit-test",
        userId: testUserId,
        amount: 100,
        currency: "INR",
        category: "Travel",
        accountId: "acc-cash",
        accountName: "Cash",
        date: "2026-10-23",
      })

      // Edit
      await saveExpense({
        ...exp,
        amount: 150,
        description: "Updated cab fare",
      })

      const afterEdit = await fetchUserExpenses(testUserId)
      expect(afterEdit[0].amount).toBe(150)
      expect(afterEdit[0].description).toBe("Updated cab fare")

      // Delete
      await deleteExpense("exp-edit-test", testUserId)
      const afterDelete = await fetchUserExpenses(testUserId)
      expect(afterDelete.length).toBe(0)

      // Verify delete operation in outbox
      const outbox = await db.outbox.where("item_id").equals("exp-edit-test").toArray()
      const deleteRecord = outbox.find((o) => o.operation === "delete")
      expect(deleteRecord).toBeDefined()
    })
  })

  describe("4. Analytics, Summaries & Monthly Budget", () => {
    it("calculates daily, weekly, monthly summaries and category breakdowns", () => {
      const refDate = new Date("2026-10-23T12:00:00") // Friday
      const sampleExpenses: ExpenseItem[] = [
        {
          id: "1",
          userId: testUserId,
          amount: 500,
          currency: "INR",
          category: "Food",
          accountId: "acc-1",
          accountName: "Cash",
          date: "2026-10-23", // Today
          createdAt: "2026-10-23T10:00:00Z",
        },
        {
          id: "2",
          userId: testUserId,
          amount: 300,
          currency: "INR",
          category: "Travel",
          accountId: "acc-1",
          accountName: "Cash",
          date: "2026-10-23", // Today
          createdAt: "2026-10-23T11:00:00Z",
        },
        {
          id: "3",
          userId: testUserId,
          amount: 1200,
          currency: "INR",
          category: "Shopping",
          accountId: "acc-2",
          accountName: "Bank",
          date: "2026-10-20", // Earlier this week
          createdAt: "2026-10-20T10:00:00Z",
        },
        {
          id: "4",
          userId: testUserId,
          amount: 2000,
          currency: "INR",
          category: "Bills",
          accountId: "acc-2",
          accountName: "Bank",
          date: "2026-10-02", // Earlier this month
          createdAt: "2026-10-02T10:00:00Z",
        },
      ]

      const summaries = calculateExpenseSummaries(sampleExpenses, 5000, refDate)

      // Today: 500 + 300 = 800
      expect(summaries.todayTotal).toBe(800)
      expect(summaries.todayCount).toBe(2)

      // This week (Monday Oct 19 to Friday Oct 23): 500 + 300 + 1200 = 2000
      expect(summaries.weekTotal).toBe(2000)

      // This month (October 2026): 800 + 1200 + 2000 = 4000
      expect(summaries.monthTotal).toBe(4000)
      expect(summaries.monthCount).toBe(4)

      // Budget progress: 4000 / 5000 = 80%
      expect(summaries.budgetProgress.percentUsed).toBe(80)
      expect(summaries.budgetProgress.remaining).toBe(1000)

      // Category breakdown
      expect(summaries.categoryBreakdown.length).toBe(4)
      const billsCat = summaries.categoryBreakdown.find((c) => c.category === "Bills")
      expect(billsCat?.amount).toBe(2000)
      expect(billsCat?.percentage).toBe(50) // 2000 / 4000 = 50%
    })

    it("saves and retrieves monthly budget", async () => {
      await saveMonthlyBudget(testUserId, "2026-10", 35000)
      const bgt = await fetchMonthlyBudget(testUserId, "2026-10")
      expect(bgt).toBeDefined()
      expect(bgt?.budgetAmount).toBe(35000)
    })
  })

  describe("5. CSV Export & Currency Formatter", () => {
    it("formats Indian Rupee (INR) with ₹ symbol", () => {
      const formatted = formatCurrency(12500)
      expect(formatted).toContain("12,500")
      expect(formatted).toMatch(/₹|Rs/)
    })

    it("generates proper CSV content escaping commas and quotes", () => {
      const expenses: ExpenseItem[] = [
        {
          id: "1",
          userId: testUserId,
          amount: 450,
          currency: "INR",
          category: "Food",
          accountId: "acc-1",
          accountName: "HDFC, Savings", // contains comma
          description: 'Lunch "Special" Cafe', // contains quotes
          date: "2026-10-23",
          time: "12:30",
          notes: "Good food, fast delivery",
          createdAt: "2026-10-23T12:30:00Z",
        },
      ]

      const csv = generateExpenseCsv(expenses)
      expect(csv).toContain("Date,Time,Amount,Currency,Category,Payment Account,Description,Notes")
      expect(csv).toContain('"HDFC, Savings"')
      expect(csv).toContain('"Lunch ""Special"" Cafe"')
      expect(csv).toContain('"Good food, fast delivery"')
    })
  })

  describe("6. Cross-User Isolation & Data Persistence", () => {
    it("ensures user cannot read another user's expenses or accounts", async () => {
      // User A creates expense
      await saveExpense({
        id: "exp-user-a",
        userId: testUserId,
        amount: 999,
        currency: "INR",
        category: "Shopping",
        accountId: "acc-a",
        accountName: "User A Bank",
        date: "2026-10-23",
      })

      // User B creates expense
      await saveExpense({
        id: "exp-user-b",
        userId: otherUserId,
        amount: 111,
        currency: "INR",
        category: "Food",
        accountId: "acc-b",
        accountName: "User B Cash",
        date: "2026-10-23",
      })

      const userAExpenses = await fetchUserExpenses(testUserId)
      const userBExpenses = await fetchUserExpenses(otherUserId)

      expect(userAExpenses.length).toBe(1)
      expect(userAExpenses[0].id).toBe("exp-user-a")

      expect(userBExpenses.length).toBe(1)
      expect(userBExpenses[0].id).toBe("exp-user-b")
    })
  })

  describe("7. UI Quick Expense Entry Flow", () => {
    it("renders quick expense card with amount, categories, and one-click account selector", async () => {
      render(<ExpenseTrackerView userId={testUserId} selectedDate="2026-10-23" />)

      await waitFor(() => {
        expect(screen.getByText("Quick Expense")).toBeInTheDocument()
      })

      // Verify categories exist
      expect(screen.getByRole("button", { name: "Food" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Travel" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Shopping" })).toBeInTheDocument()

      // Verify auto-initialized accounts appear as chips
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Cash/i })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /Primary Bank/i })).toBeInTheDocument()
      })

      // Enter amount
      const amountInput = screen.getByLabelText("Expense Amount")
      await userEvent.type(amountInput, "450")

      // Select Travel category
      const travelBtn = screen.getByRole("button", { name: "Travel" })
      await userEvent.click(travelBtn)

      // One click to select Primary Bank account
      const bankChip = screen.getByRole("button", { name: /Primary Bank/i })
      await userEvent.click(bankChip)

      // Submit
      const saveBtn = screen.getByRole("button", { name: "Save Expense" })
      await userEvent.click(saveBtn)

      // Expense appears in history list
      await waitFor(() => {
        expect(screen.getByText("Travel Expense")).toBeInTheDocument()
      })
    })
  })
})
