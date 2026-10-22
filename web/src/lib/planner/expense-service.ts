import { db } from "@/lib/db/index"
import type { LocalItem, OutboxRecord } from "@/lib/db/schema"

export type ExpenseCategory =
  | "Food"
  | "Travel"
  | "Shopping"
  | "Bills"
  | "Education"
  | "Health"
  | "Entertainment"
  | "Other"

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Food",
  "Travel",
  "Shopping",
  "Bills",
  "Education",
  "Health",
  "Entertainment",
  "Other",
]

export type AccountType =
  | "Bank Account"
  | "Cash"
  | "Credit Card"
  | "UPI/Wallet"
  | "Other"

export const ACCOUNT_TYPES: AccountType[] = [
  "Bank Account",
  "Cash",
  "Credit Card",
  "UPI/Wallet",
  "Other",
]

export const ACCOUNT_COLORS = [
  "blue",
  "emerald",
  "purple",
  "amber",
  "rose",
  "indigo",
  "slate",
] as const

export const ACCOUNT_ICONS = [
  "landmark",
  "wallet",
  "credit-card",
  "banknote",
  "smartphone",
] as const

export interface PaymentAccount {
  id: string
  userId: string
  name: string
  bankName?: string
  type: AccountType
  color: string // "blue" | "emerald" | "purple" | "amber" | "rose" | "indigo" | "slate"
  icon: string // "landmark" | "wallet" | "credit-card" | "banknote" | "smartphone"
  openingBalance: number
  isArchived: boolean
  createdAt: string
}

export interface ExpenseItem {
  id: string
  userId: string
  amount: number
  currency?: string // default "INR"
  category: ExpenseCategory
  accountId: string
  accountName: string
  description?: string
  date: string // YYYY-MM-DD
  time?: string // HH:mm
  notes?: string
  createdAt: string
}

export interface MonthlyBudget {
  id: string
  userId: string
  monthKey: string // YYYY-MM
  budgetAmount: number
  createdAt: string
}

export interface ExpenseSummaries {
  todayTotal: number
  todayCount: number
  weekTotal: number
  weekCount: number
  monthTotal: number
  monthCount: number
  categoryBreakdown: { category: ExpenseCategory; amount: number; percentage: number }[]
  accountBreakdown: { accountId: string; accountName: string; amount: number }[]
  budgetProgress: {
    budgetAmount: number
    monthTotal: number
    remaining: number
    percentUsed: number
  }
}

/**
 * Format currency values with INR (₹) as the default.
 */
export function formatCurrency(amount: number, currency: string = "INR"): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `₹${amount.toFixed(2)}`
  }
}

/**
 * Fetch payment accounts for a given user.
 * Initializes default starter accounts if user has none.
 */
export async function fetchUserAccounts(userId: string): Promise<PaymentAccount[]> {
  if (!userId) return []

  const items = await db.local_items
    .where("user_id")
    .equals(userId)
    .filter((i) => Boolean(i.ai_tags?.includes("PaymentAccount") && !i.deleted_at))
    .toArray()

  const accounts: PaymentAccount[] = []
  for (const item of items) {
    try {
      const payload = JSON.parse(item.content || "{}")
      accounts.push({
        id: item.id,
        userId: item.user_id || userId,
        name: item.title || payload.name || "Account",
        bankName: payload.bankName || undefined,
        type: (payload.type || "Bank Account") as AccountType,
        color: payload.color || "blue",
        icon: payload.icon || "landmark",
        openingBalance: Number(payload.openingBalance || 0),
        isArchived: Boolean(payload.isArchived),
        createdAt: item.created_at,
      })
    } catch {
      // skip corrupted
    }
  }

  // Auto-initialize default starter accounts if none exist
  if (accounts.length === 0) {
    const defaultCash = await saveAccount({
      id: crypto.randomUUID(),
      userId,
      name: "Cash",
      type: "Cash",
      color: "amber",
      icon: "banknote",
      openingBalance: 0,
      isArchived: false,
      createdAt: new Date().toISOString(),
    })

    const defaultBank = await saveAccount({
      id: crypto.randomUUID(),
      userId,
      name: "Primary Bank",
      bankName: "Bank",
      type: "Bank Account",
      color: "blue",
      icon: "landmark",
      openingBalance: 0,
      isArchived: false,
      createdAt: new Date().toISOString(),
    })

    return [defaultCash, defaultBank]
  }

  return accounts.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Create or update a payment account.
 */
export async function saveAccount(account: PaymentAccount): Promise<PaymentAccount> {
  const now = new Date().toISOString()
  const accountId = account.id || crypto.randomUUID()
  const createdAt = account.createdAt || now

  const payloadContent = JSON.stringify({
    name: account.name,
    bankName: account.bankName || "",
    type: account.type,
    color: account.color,
    icon: account.icon,
    openingBalance: account.openingBalance,
    isArchived: account.isArchived,
  })

  const rawInput = `Payment Account: ${account.name} (${account.type})`

  const localItem: LocalItem = {
    id: accountId,
    user_id: account.userId,
    raw_input: rawInput,
    title: account.name,
    content: payloadContent,
    type: "note",
    status: account.isArchived ? "archived" : "active",
    captured_at: createdAt,
    created_at: createdAt,
    updated_at: now,
    deleted_at: null,
    ai_tags: ["PaymentAccount"],
    synced: false,
  }

  const existing = await db.local_items.get(accountId)

  const outboxRecord: OutboxRecord = {
    id: crypto.randomUUID(),
    item_id: accountId,
    user_id: account.userId,
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
    ...account,
    id: accountId,
    createdAt,
  }
}

/**
 * Archive or unarchive a payment account.
 */
export async function archiveAccount(
  accountId: string,
  userId: string,
  isArchived: boolean = true
): Promise<void> {
  const existing = await db.local_items.get(accountId)
  if (!existing || existing.user_id !== userId) return

  let payload: Record<string, any> = {}
  try {
    payload = JSON.parse(existing.content || "{}")
  } catch {
    // empty
  }

  payload.isArchived = isArchived
  const now = new Date().toISOString()

  const updatedItem: LocalItem = {
    ...existing,
    content: JSON.stringify(payload),
    status: isArchived ? "archived" : "active",
    updated_at: now,
    synced: false,
  }

  const outboxRecord: OutboxRecord = {
    id: crypto.randomUUID(),
    item_id: accountId,
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
}

/**
 * Soft-delete a payment account.
 */
export async function deleteAccount(accountId: string, userId: string): Promise<void> {
  const existing = await db.local_items.get(accountId)
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
    item_id: accountId,
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
 * Fetch expenses for a user with optional filtering.
 */
export async function fetchUserExpenses(
  userId: string,
  filters?: {
    date?: string
    startDate?: string
    endDate?: string
    category?: ExpenseCategory
    accountId?: string
    search?: string
  }
): Promise<ExpenseItem[]> {
  if (!userId) return []

  const items = await db.local_items
    .where("user_id")
    .equals(userId)
    .filter((i) => Boolean(i.ai_tags?.includes("Expense") && !i.deleted_at))
    .toArray()

  let expenses: ExpenseItem[] = []
  for (const item of items) {
    try {
      const payload = JSON.parse(item.content || "{}")
      expenses.push({
        id: item.id,
        userId: item.user_id || userId,
        amount: Number(payload.amount || 0),
        currency: payload.currency || "INR",
        category: (payload.category || "Other") as ExpenseCategory,
        accountId: payload.accountId || "",
        accountName: payload.accountName || "Unknown Account",
        description: payload.description || item.title || undefined,
        date: payload.date || item.created_at.slice(0, 10),
        time: payload.time || undefined,
        notes: payload.notes || undefined,
        createdAt: item.created_at,
      })
    } catch {
      // skip corrupted
    }
  }

  // Sort descending by date and time
  expenses.sort((a, b) => {
    const dateTimeA = `${a.date}T${a.time || "00:00"}`
    const dateTimeB = `${b.date}T${b.time || "00:00"}`
    return dateTimeB.localeCompare(dateTimeA)
  })

  // Apply filters
  if (filters) {
    if (filters.date) {
      expenses = expenses.filter((e) => e.date === filters.date)
    }
    if (filters.startDate) {
      expenses = expenses.filter((e) => e.date >= filters.startDate!)
    }
    if (filters.endDate) {
      expenses = expenses.filter((e) => e.date <= filters.endDate!)
    }
    if (filters.category) {
      expenses = expenses.filter((e) => e.category === filters.category)
    }
    if (filters.accountId) {
      expenses = expenses.filter((e) => e.accountId === filters.accountId)
    }
    if (filters.search) {
      const q = filters.search.toLowerCase()
      expenses = expenses.filter(
        (e) =>
          e.description?.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.accountName.toLowerCase().includes(q) ||
          e.notes?.toLowerCase().includes(q)
      )
    }
  }

  return expenses
}

/**
 * Save an expense (create or update).
 */
export async function saveExpense(
  expense: Omit<ExpenseItem, "createdAt"> & { createdAt?: string }
): Promise<ExpenseItem> {
  const now = new Date().toISOString()
  const expenseId = expense.id || crypto.randomUUID()
  const createdAt = expense.createdAt || now

  const payloadContent = JSON.stringify({
    amount: expense.amount,
    currency: expense.currency || "INR",
    category: expense.category,
    accountId: expense.accountId,
    accountName: expense.accountName,
    description: expense.description || "",
    date: expense.date,
    time: expense.time || "",
    notes: expense.notes || "",
  })

  const rawInput = `Expense: ${formatCurrency(expense.amount, expense.currency)} for ${expense.category} (${expense.accountName})`

  const localItem: LocalItem = {
    id: expenseId,
    user_id: expense.userId,
    raw_input: rawInput,
    title: expense.description || `${expense.category} Expense`,
    content: payloadContent,
    type: "note",
    status: "active",
    captured_at: createdAt,
    created_at: createdAt,
    updated_at: now,
    deleted_at: null,
    ai_tags: ["Expense"],
    synced: false,
  }

  const existing = await db.local_items.get(expenseId)

  const outboxRecord: OutboxRecord = {
    id: crypto.randomUUID(),
    item_id: expenseId,
    user_id: expense.userId,
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
    ...expense,
    id: expenseId,
    createdAt,
  }
}

/**
 * Soft-delete an expense.
 */
export async function deleteExpense(expenseId: string, userId: string): Promise<void> {
  const existing = await db.local_items.get(expenseId)
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
    item_id: expenseId,
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
 * Fetch monthly budget for a specific month (YYYY-MM).
 */
export async function fetchMonthlyBudget(
  userId: string,
  monthKey: string
): Promise<MonthlyBudget | null> {
  if (!userId) return null

  const items = await db.local_items
    .where("user_id")
    .equals(userId)
    .filter(
      (i) =>
        Boolean(i.ai_tags?.includes("MonthlyBudget") && !i.deleted_at) &&
        i.title === `budget_${monthKey}`
    )
    .toArray()

  if (items.length === 0) return null

  const item = items[0]
  try {
    const payload = JSON.parse(item.content || "{}")
    return {
      id: item.id,
      userId: item.user_id || userId,
      monthKey,
      budgetAmount: Number(payload.budgetAmount || 0),
      createdAt: item.created_at,
    }
  } catch {
    return null
  }
}

/**
 * Save monthly budget for a user and monthKey (YYYY-MM).
 */
export async function saveMonthlyBudget(
  userId: string,
  monthKey: string,
  budgetAmount: number
): Promise<MonthlyBudget> {
  const now = new Date().toISOString()
  const existing = await fetchMonthlyBudget(userId, monthKey)
  const budgetId = existing?.id || crypto.randomUUID()

  const payloadContent = JSON.stringify({
    monthKey,
    budgetAmount,
  })

  const localItem: LocalItem = {
    id: budgetId,
    user_id: userId,
    raw_input: `Monthly Budget for ${monthKey}: ${budgetAmount}`,
    title: `budget_${monthKey}`,
    content: payloadContent,
    type: "note",
    status: "active",
    captured_at: existing?.createdAt || now,
    created_at: existing?.createdAt || now,
    updated_at: now,
    deleted_at: null,
    ai_tags: ["MonthlyBudget"],
    synced: false,
  }

  const outboxRecord: OutboxRecord = {
    id: crypto.randomUUID(),
    item_id: budgetId,
    user_id: userId,
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
    id: budgetId,
    userId,
    monthKey,
    budgetAmount,
    createdAt: existing?.createdAt || now,
  }
}

/**
 * Calculate spending summaries, category breakdowns, and budget progress.
 */
export function calculateExpenseSummaries(
  expenses: ExpenseItem[],
  budgetAmount: number = 0,
  referenceDate: Date = new Date()
): ExpenseSummaries {
  const todayStr = referenceDate.toLocaleDateString("en-CA") // YYYY-MM-DD
  const currentMonthKey = todayStr.slice(0, 7) // YYYY-MM

  // Calculate week start date (Monday)
  const dayOfWeek = referenceDate.getDay() // 0 = Sun, 1 = Mon ...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(referenceDate)
  monday.setDate(referenceDate.getDate() + diffToMonday)
  const mondayStr = monday.toLocaleDateString("en-CA")

  let todayTotal = 0
  let todayCount = 0
  let weekTotal = 0
  let weekCount = 0
  let monthTotal = 0
  let monthCount = 0

  const catMap: Partial<Record<ExpenseCategory, number>> = {}
  const accMap: Record<string, { accountName: string; amount: number }> = {}

  for (const exp of expenses) {
    const expDate = exp.date

    // Today
    if (expDate === todayStr) {
      todayTotal += exp.amount
      todayCount += 1
    }

    // Week
    if (expDate >= mondayStr && expDate <= todayStr) {
      weekTotal += exp.amount
      weekCount += 1
    }

    // Month
    if (expDate.startsWith(currentMonthKey)) {
      monthTotal += exp.amount
      monthCount += 1

      // Category breakdown for current month
      catMap[exp.category] = (catMap[exp.category] || 0) + exp.amount

      // Account breakdown
      if (!accMap[exp.accountId]) {
        accMap[exp.accountId] = { accountName: exp.accountName, amount: 0 }
      }
      accMap[exp.accountId].amount += exp.amount
    }
  }

  // Convert category map to sorted array with percentages
  const categoryBreakdown = Object.entries(catMap)
    .map(([cat, amount]) => ({
      category: cat as ExpenseCategory,
      amount: amount || 0,
      percentage: monthTotal > 0 ? Math.round(((amount || 0) / monthTotal) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  const accountBreakdown = Object.entries(accMap).map(([id, info]) => ({
    accountId: id,
    accountName: info.accountName,
    amount: info.amount,
  }))

  const remaining = budgetAmount > 0 ? budgetAmount - monthTotal : 0
  const percentUsed =
    budgetAmount > 0 ? Math.min(100, Math.round((monthTotal / budgetAmount) * 100)) : 0

  return {
    todayTotal,
    todayCount,
    weekTotal,
    weekCount,
    monthTotal,
    monthCount,
    categoryBreakdown,
    accountBreakdown,
    budgetProgress: {
      budgetAmount,
      monthTotal,
      remaining,
      percentUsed,
    },
  }
}

/**
 * Generate CSV string from expenses.
 */
export function generateExpenseCsv(expenses: ExpenseItem[]): string {
  const headers = ["Date", "Time", "Amount", "Currency", "Category", "Payment Account", "Description", "Notes"]

  const rows = expenses.map((e) => {
    const escape = (val: string | number | undefined) => {
      const s = String(val ?? "")
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`
      }
      return s
    }

    return [
      escape(e.date),
      escape(e.time || ""),
      escape(e.amount),
      escape(e.currency || "INR"),
      escape(e.category),
      escape(e.accountName),
      escape(e.description || ""),
      escape(e.notes || ""),
    ].join(",")
  })

  return [headers.join(","), ...rows].join("\n")
}

/**
 * Trigger CSV download in browser.
 */
export function downloadExpenseCsv(expenses: ExpenseItem[], filename = "praxis-expenses.csv"): void {
  const csvContent = generateExpenseCsv(expenses)
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute("download", filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
