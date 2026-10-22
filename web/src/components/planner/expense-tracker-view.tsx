import * as React from "react"
import {
  Archive,
  ArchiveRestore,
  Banknote,
  Car,
  Check,
  CreditCard,
  Download,
  Edit2,
  Film,
  GraduationCap,
  HeartPulse,
  Landmark,
  Plus,
  Receipt,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Smartphone,
  Tag,
  Trash2,
  Utensils,
  Wallet,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  ACCOUNT_COLORS,
  ACCOUNT_ICONS,
  ACCOUNT_TYPES,
  EXPENSE_CATEGORIES,
  archiveAccount,
  calculateExpenseSummaries,
  deleteAccount,
  deleteExpense,
  downloadExpenseCsv,
  fetchMonthlyBudget,
  fetchUserAccounts,
  fetchUserExpenses,
  formatCurrency,
  saveAccount,
  saveExpense,
  saveMonthlyBudget,
  type AccountType,
  type ExpenseCategory,
  type ExpenseItem,
  type PaymentAccount,
} from "@/lib/planner/expense-service"

interface ExpenseTrackerViewProps {
  userId: string
  selectedDate?: string
}

// Category icon helper
function getCategoryIcon(category: ExpenseCategory, className = "size-4") {
  switch (category) {
    case "Food":
      return <Utensils className={className} />
    case "Travel":
      return <Car className={className} />
    case "Shopping":
      return <ShoppingBag className={className} />
    case "Bills":
      return <Receipt className={className} />
    case "Education":
      return <GraduationCap className={className} />
    case "Health":
      return <HeartPulse className={className} />
    case "Entertainment":
      return <Film className={className} />
    case "Other":
    default:
      return <Tag className={className} />
  }
}

// Account icon helper
function getAccountIcon(iconName: string, className = "size-3.5") {
  switch (iconName) {
    case "wallet":
      return <Wallet className={className} />
    case "credit-card":
      return <CreditCard className={className} />
    case "banknote":
      return <Banknote className={className} />
    case "smartphone":
      return <Smartphone className={className} />
    case "landmark":
    default:
      return <Landmark className={className} />
  }
}

// Account color styling helper
function getAccountColorClasses(color: string, isSelected = false) {
  switch (color) {
    case "emerald":
      return isSelected
        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 ring-1 ring-emerald-500/30"
        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
    case "purple":
      return isSelected
        ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/40 ring-1 ring-purple-500/30"
        : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 hover:bg-purple-500/20"
    case "amber":
      return isSelected
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 ring-1 ring-amber-500/30"
        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
    case "rose":
      return isSelected
        ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40 ring-1 ring-rose-500/30"
        : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
    case "indigo":
      return isSelected
        ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/40 ring-1 ring-indigo-500/30"
        : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20"
    case "slate":
      return isSelected
        ? "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/40 ring-1 ring-slate-500/30"
        : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20 hover:bg-slate-500/20"
    case "blue":
    default:
      return isSelected
        ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/40 ring-1 ring-blue-500/30"
        : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500/20"
  }
}

export function ExpenseTrackerView({ userId, selectedDate }: ExpenseTrackerViewProps) {
  const currentMonthKey = (selectedDate || new Date().toISOString().slice(0, 10)).slice(0, 7)

  // Data states
  const [expenses, setExpenses] = React.useState<ExpenseItem[]>([])
  const [accounts, setAccounts] = React.useState<PaymentAccount[]>([])
  const [budgetAmount, setBudgetAmount] = React.useState<number>(0)
  const [isLoading, setIsLoading] = React.useState(true)

  // Sub-view mode
  const [viewMode, setViewMode] = React.useState<"expenses" | "accounts">("expenses")

  // Quick Expense Entry Form States
  const [amount, setAmount] = React.useState<string>("")
  const [category, setCategory] = React.useState<ExpenseCategory>("Food")
  const [selectedAccountId, setSelectedAccountId] = React.useState<string>("")
  const [description, setDescription] = React.useState<string>("")
  const [entryDate, setEntryDate] = React.useState<string>(() =>
    selectedDate || new Date().toLocaleDateString("en-CA")
  )
  const [entryTime, setEntryTime] = React.useState<string>(() => {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  })
  const [notes, setNotes] = React.useState<string>("")
  const [showDetails, setShowDetails] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Editing Expense State
  const [editingExpense, setEditingExpense] = React.useState<ExpenseItem | null>(null)
  const [deletingExpenseId, setDeletingExpenseId] = React.useState<string | null>(null)

  // Budget Edit State
  const [isEditingBudget, setIsEditingBudget] = React.useState(false)
  const [tempBudgetInput, setTempBudgetInput] = React.useState("")

  // Filters & Search
  const [searchQuery, setSearchQuery] = React.useState("")
  const [filterCategory, setFilterCategory] = React.useState<string>("all")
  const [filterAccountId, setFilterAccountId] = React.useState<string>("all")
  const [filterDateRange, setFilterDateRange] = React.useState<"all" | "today" | "week" | "month">("all")

  // Account Management States
  const [isAddingAccount, setIsAddingAccount] = React.useState(false)
  const [accountName, setAccountName] = React.useState("")
  const [bankName, setBankName] = React.useState("")
  const [accountType, setAccountType] = React.useState<AccountType>("Bank Account")
  const [accountColor, setAccountColor] = React.useState("blue")
  const [accountIcon, setAccountIcon] = React.useState("landmark")
  const [openingBalance, setOpeningBalance] = React.useState("0")
  const [editingAccount, setEditingAccount] = React.useState<PaymentAccount | null>(null)
  const [deletingAccountId, setDeletingAccountId] = React.useState<string | null>(null)

  // Synchronize entryDate with selectedDate when changed from header
  React.useEffect(() => {
    if (selectedDate) {
      setEntryDate(selectedDate)
    }
  }, [selectedDate])

  // Load Data
  const loadData = React.useCallback(async () => {
    if (!userId) return
    setIsLoading(true)
    try {
      const [accs, exps, bgt] = await Promise.all([
        fetchUserAccounts(userId),
        fetchUserExpenses(userId),
        fetchMonthlyBudget(userId, currentMonthKey),
      ])
      setAccounts(accs)
      setExpenses(exps)
      if (bgt) {
        setBudgetAmount(bgt.budgetAmount)
      }

      // Default select first active account if not set
      const firstActive = accs.find((a) => !a.isArchived)
      if (firstActive && !selectedAccountId) {
        setSelectedAccountId(firstActive.id)
      }
    } finally {
      setIsLoading(false)
    }
  }, [userId, currentMonthKey, selectedAccountId])

  React.useEffect(() => {
    void loadData()
  }, [loadData])

  // Active (non-archived) accounts for quick selector
  const activeAccounts = React.useMemo(
    () => accounts.filter((a) => !a.isArchived),
    [accounts]
  )

  // Summaries calculation
  const summaries = React.useMemo(
    () => calculateExpenseSummaries(expenses, budgetAmount, new Date(entryDate)),
    [expenses, budgetAmount, entryDate]
  )

  // Filtered Expenses
  const filteredExpenses = React.useMemo(() => {
    let result = [...expenses]
    const todayStr = new Date().toLocaleDateString("en-CA")
    const currentMonthPrefix = todayStr.slice(0, 7)

    // Calculate monday of current week
    const now = new Date()
    const day = now.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const monday = new Date(now)
    monday.setDate(now.getDate() + diff)
    const mondayStr = monday.toLocaleDateString("en-CA")

    // Date range filter
    if (filterDateRange === "today") {
      result = result.filter((e) => e.date === todayStr)
    } else if (filterDateRange === "week") {
      result = result.filter((e) => e.date >= mondayStr && e.date <= todayStr)
    } else if (filterDateRange === "month") {
      result = result.filter((e) => e.date.startsWith(currentMonthPrefix))
    }

    // Category filter
    if (filterCategory !== "all") {
      result = result.filter((e) => e.category === filterCategory)
    }

    // Account filter
    if (filterAccountId !== "all") {
      result = result.filter((e) => e.accountId === filterAccountId)
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (e) =>
          e.description?.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.accountName.toLowerCase().includes(q) ||
          e.notes?.toLowerCase().includes(q)
      )
    }

    return result
  }, [expenses, filterDateRange, filterCategory, filterAccountId, searchQuery])

  // Handle Quick Expense Creation
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    const numAmount = parseFloat(amount)
    if (!amount || isNaN(numAmount) || numAmount <= 0 || !selectedAccountId || !userId || isSubmitting) {
      return
    }

    const selectedAcc = accounts.find((a) => a.id === selectedAccountId)
    if (!selectedAcc) return

    setIsSubmitting(true)
    try {
      const newExp = await saveExpense({
        id: crypto.randomUUID(),
        userId,
        amount: numAmount,
        currency: "INR",
        category,
        accountId: selectedAcc.id,
        accountName: selectedAcc.name,
        description: description.trim() || undefined,
        date: entryDate,
        time: entryTime,
        notes: notes.trim() || undefined,
      })

      setExpenses((prev) => [newExp, ...prev])
      setAmount("")
      setDescription("")
      setNotes("")
      setShowDetails(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Update Expense
  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingExpense || !userId) return
    const numAmount = Number(editingExpense.amount)
    if (isNaN(numAmount) || numAmount <= 0) return

    const selectedAcc = accounts.find((a) => a.id === editingExpense.accountId)
    const updated = await saveExpense({
      ...editingExpense,
      accountName: selectedAcc?.name || editingExpense.accountName,
    })

    setExpenses((prev) => prev.map((exp) => (exp.id === updated.id ? updated : exp)))
    setEditingExpense(null)
  }

  // Handle Delete Expense
  const handleConfirmDeleteExpense = async () => {
    if (!deletingExpenseId || !userId) return
    await deleteExpense(deletingExpenseId, userId)
    setExpenses((prev) => prev.filter((exp) => exp.id !== deletingExpenseId))
    setDeletingExpenseId(null)
  }

  // Handle Save Monthly Budget
  const handleSaveBudget = async () => {
    const val = parseFloat(tempBudgetInput)
    if (isNaN(val) || val < 0 || !userId) return
    await saveMonthlyBudget(userId, currentMonthKey, val)
    setBudgetAmount(val)
    setIsEditingBudget(false)
  }

  // Handle Account Form Submit
  const handleSaveAccountForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accountName.trim() || !userId) return

    const numBal = parseFloat(openingBalance) || 0
    const accToSave: PaymentAccount = {
      id: editingAccount?.id || crypto.randomUUID(),
      userId,
      name: accountName.trim(),
      bankName: bankName.trim() || undefined,
      type: accountType,
      color: accountColor,
      icon: accountIcon,
      openingBalance: numBal,
      isArchived: editingAccount?.isArchived || false,
      createdAt: editingAccount?.createdAt || new Date().toISOString(),
    }

    const saved = await saveAccount(accToSave)
    setAccounts((prev) => {
      const idx = prev.findIndex((a) => a.id === saved.id)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = saved
        return copy
      }
      return [...prev, saved]
    })

    // Reset account form
    setIsAddingAccount(false)
    setEditingAccount(null)
    setAccountName("")
    setBankName("")
    setOpeningBalance("0")
  }

  // Handle Archive Account
  const handleToggleArchiveAccount = async (acc: PaymentAccount) => {
    if (!userId) return
    const nextState = !acc.isArchived
    await archiveAccount(acc.id, userId, nextState)
    setAccounts((prev) =>
      prev.map((a) => (a.id === acc.id ? { ...a, isArchived: nextState } : a))
    )
  }

  // Handle Delete Account
  const handleConfirmDeleteAccount = async () => {
    if (!deletingAccountId || !userId) return
    await deleteAccount(deletingAccountId, userId)
    setAccounts((prev) => prev.filter((a) => a.id !== deletingAccountId))
    setDeletingAccountId(null)
  }

  // CSV Export action
  const handleExportCsv = () => {
    const filename = `praxis-expenses-${currentMonthKey}.csv`
    downloadExpenseCsv(filteredExpenses, filename)
  }

  return (
    <div className="space-y-6">
      {/* Top Banner: Quick Summary & Budget Progress */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Today's Spending */}
        <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-card/60 shadow-2xs space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Today
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-heading font-extrabold text-foreground">
              {formatCurrency(summaries.todayTotal)}
            </span>
            <span className="text-xs text-muted-foreground">
              {summaries.todayCount} {summaries.todayCount === 1 ? "expense" : "expenses"}
            </span>
          </div>
        </div>

        {/* This Week's Spending */}
        <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-card/60 shadow-2xs space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            This Week
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-heading font-extrabold text-foreground">
              {formatCurrency(summaries.weekTotal)}
            </span>
            <span className="text-xs text-muted-foreground">
              {summaries.weekCount} {summaries.weekCount === 1 ? "expense" : "expenses"}
            </span>
          </div>
        </div>

        {/* This Month & Budget */}
        <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-card/60 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              This Month
            </span>
            <button
              type="button"
              onClick={() => {
                setTempBudgetInput(String(budgetAmount || ""))
                setIsEditingBudget(true)
              }}
              className="text-[11px] text-primary hover:underline font-medium"
            >
              {budgetAmount > 0 ? "Edit Budget" : "Set Budget"}
            </button>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-heading font-extrabold text-foreground">
              {formatCurrency(summaries.monthTotal)}
            </span>
            {budgetAmount > 0 && (
              <span className="text-xs text-muted-foreground">
                of {formatCurrency(budgetAmount)}
              </span>
            )}
          </div>

          {/* Budget progress bar */}
          {budgetAmount > 0 && (
            <div className="space-y-1 pt-1">
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    summaries.budgetProgress.percentUsed > 90
                      ? "bg-destructive"
                      : summaries.budgetProgress.percentUsed > 75
                      ? "bg-amber-500"
                      : "bg-primary"
                  }`}
                  style={{ width: `${Math.min(100, summaries.budgetProgress.percentUsed)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{summaries.budgetProgress.percentUsed}% used</span>
                <span>
                  {summaries.budgetProgress.remaining >= 0
                    ? `${formatCurrency(summaries.budgetProgress.remaining)} remaining`
                    : `${formatCurrency(Math.abs(summaries.budgetProgress.remaining))} over budget`}
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Edit Budget Inline Dialog */}
      {isEditingBudget && (
        <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Set Monthly Budget ({currentMonthKey})
            </h4>
            <button
              type="button"
              onClick={() => setIsEditingBudget(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-semibold">
                ₹
              </span>
              <input
                type="number"
                min="0"
                step="any"
                value={tempBudgetInput}
                onChange={(e) => setTempBudgetInput(e.target.value)}
                placeholder="e.g. 25000"
                className="w-full pl-7 pr-3 py-1.5 text-sm bg-card border border-border/80 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary font-mono"
              />
            </div>
            <Button size="sm" onClick={handleSaveBudget} className="rounded-lg text-xs">
              Save Budget
            </Button>
          </div>
        </div>
      )}

      {/* Quick Expense Entry Card (Mobile-First, Minimal Clicks) */}
      <section className="p-4 sm:p-5 rounded-xl border border-border/80 bg-card/70 shadow-2xs space-y-4">
        <header className="flex items-center justify-between">
          <h2 className="text-sm font-heading font-bold text-foreground flex items-center gap-2">
            <Plus className="size-4 text-primary" />
            <span>Quick Expense</span>
          </h2>
          <span className="text-[11px] text-muted-foreground">
            {entryDate}
          </span>
        </header>

        <form onSubmit={handleCreateExpense} className="space-y-3.5">
          {/* Prominent Amount Input & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="relative sm:col-span-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg sm:text-xl font-bold text-foreground/80 pointer-events-none">
                ₹
              </span>
              <input
                type="number"
                step="any"
                required
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                aria-label="Expense Amount"
                className="w-full pl-8 pr-3 py-2 sm:py-2.5 text-lg sm:text-xl font-heading font-extrabold bg-background border border-border/80 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-primary/40 tracking-tight"
              />
            </div>

            <div className="sm:col-span-2">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What was this for? (Optional description)"
                aria-label="Expense Description"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-background border border-border/80 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/60"
              />
            </div>
          </div>

          {/* Category Chips: Instant Selection */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">Category</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {EXPENSE_CATEGORIES.map((cat) => {
                const isSelected = category === cat
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-2xs font-semibold"
                        : "bg-background text-muted-foreground border-border/70 hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    {getCategoryIcon(cat, "size-3.5")}
                    <span>{cat}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Payment Account Chips: One-Click Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">
                Payment Account (One-click)
              </span>
              {activeAccounts.length === 0 && (
                <span className="text-[11px] text-destructive">
                  No active accounts found
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {activeAccounts.map((acc) => {
                const isSelected = selectedAccountId === acc.id
                const colorClasses = getAccountColorClasses(acc.color, isSelected)
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setSelectedAccountId(acc.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${colorClasses}`}
                    title={acc.bankName ? `${acc.name} (${acc.bankName})` : acc.name}
                  >
                    {getAccountIcon(acc.icon, "size-3.5")}
                    <span>{acc.name}</span>
                    {isSelected && <Check className="size-3 stroke-[2.5]" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Optional Secondary Fields Toggle */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <SlidersHorizontal className="size-3" />
              <span>{showDetails ? "Hide extra details" : "Change date, time, or add notes"}</span>
            </button>

            {showDetails && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2.5 mt-2 border-t border-border/50">
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-background border border-border/80 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    value={entryTime}
                    onChange={(e) => setEntryTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-background border border-border/80 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes"
                    className="w-full px-2.5 py-1.5 text-xs bg-background border border-border/80 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="pt-1 flex items-center justify-end">
            <Button
              type="submit"
              disabled={!amount || parseFloat(amount) <= 0 || !selectedAccountId || isSubmitting}
              className="rounded-xl px-5 py-2 text-xs font-semibold shadow-2xs min-h-[38px] w-full sm:w-auto"
            >
              {isSubmitting ? "Saving..." : "Save Expense"}
            </Button>
          </div>
        </form>
      </section>

      {/* Navigation & Section Toggle: Expenses History vs Accounts */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2">
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/60">
          <button
            type="button"
            onClick={() => setViewMode("expenses")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              viewMode === "expenses"
                ? "bg-card text-foreground font-semibold shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Expenses History ({expenses.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode("accounts")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              viewMode === "accounts"
                ? "bg-card text-foreground font-semibold shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Accounts ({accounts.length})
          </button>
        </div>

        {viewMode === "expenses" && expenses.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="text-xs rounded-lg gap-1.5 h-8 px-2.5"
            title="Download CSV report"
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        )}
      </div>

      {/* VIEW MODE 1: EXPENSES HISTORY & BREAKDOWNS */}
      {viewMode === "expenses" && (
        <div className="space-y-4">
          {/* Category Breakdown Bars (if month has expenses) */}
          {summaries.categoryBreakdown.length > 0 && (
            <div className="p-4 rounded-xl border border-border/70 bg-card/50 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Top Categories This Month
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {formatCurrency(summaries.monthTotal)} total
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {summaries.categoryBreakdown.slice(0, 4).map((item) => (
                  <div
                    key={item.category}
                    className="p-2 rounded-lg bg-background border border-border/60 space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        {getCategoryIcon(item.category, "size-3 text-primary")}
                        {item.category}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{item.percentage}%</span>
                    </div>
                    <div className="font-heading font-bold text-xs text-foreground">
                      {formatCurrency(item.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters Bar: Search, Category, Account, Date Range */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-xl border border-border/60 bg-muted/20">
            {/* Search input */}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search expenses, notes, accounts..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border/70 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Date range filter */}
            <select
              value={filterDateRange}
              onChange={(e) => setFilterDateRange(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs bg-background border border-border/70 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>

            {/* Category filter */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-background border border-border/70 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Categories</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Account filter */}
            <select
              value={filterAccountId}
              onChange={(e) => setFilterAccountId(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-background border border-border/70 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Accounts</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Expenses List */}
          {isLoading ? (
            <div className="flex h-36 items-center justify-center text-xs text-muted-foreground animate-pulse">
              Loading expenses...
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-dashed border-border/80 bg-card/30 space-y-2">
              <Receipt className="size-8 text-muted-foreground/40 mx-auto" />
              <p className="text-sm font-medium text-foreground">No expenses found</p>
              <p className="text-xs text-muted-foreground">
                {expenses.length === 0
                  ? "Enter your first expense above to start tracking your daily spending."
                  : "No expenses match your selected filters."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50 border border-border/70 rounded-xl bg-card/60 overflow-hidden shadow-2xs">
              {filteredExpenses.map((exp) => {
                const acc = accounts.find((a) => a.id === exp.accountId)
                const colorClasses = getAccountColorClasses(acc?.color || "blue")

                return (
                  <div
                    key={exp.id}
                    className="p-3.5 sm:px-4 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                  >
                    {/* Left: Category Icon + Description + Metadata */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-9 rounded-xl bg-secondary flex items-center justify-center shrink-0 text-foreground">
                        {getCategoryIcon(exp.category, "size-4 text-primary")}
                      </div>

                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-semibold text-foreground truncate">
                            {exp.description || `${exp.category} Expense`}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${colorClasses}`}
                          >
                            {getAccountIcon(acc?.icon || "landmark", "size-2.5")}
                            <span>{exp.accountName}</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                          <span>{exp.date}</span>
                          {exp.time && <span>• {exp.time}</span>}
                          {exp.notes && (
                            <span className="italic truncate max-w-[180px] sm:max-w-[280px]">
                              • {exp.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount + Edit/Delete Actions */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-heading font-extrabold text-sm sm:text-base text-foreground">
                        {formatCurrency(exp.amount, exp.currency)}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingExpense(exp)}
                          className="size-7 rounded-md p-0 inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                          title="Edit Expense"
                          aria-label={`Edit expense ${exp.description || exp.category}`}
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingExpenseId(exp.id)}
                          className="size-7 rounded-md p-0 inline-flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Delete Expense"
                          aria-label={`Delete expense ${exp.description || exp.category}`}
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
        </div>
      )}

      {/* VIEW MODE 2: ACCOUNT MANAGEMENT */}
      {viewMode === "accounts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-heading font-bold text-foreground">
                Payment Accounts
              </h3>
              <p className="text-xs text-muted-foreground">
                Manage bank accounts, cards, and cash wallets. Historical expenses remain linked even if an account is archived.
              </p>
            </div>

            <Button
              size="sm"
              onClick={() => {
                setEditingAccount(null)
                setAccountName("")
                setBankName("")
                setAccountType("Bank Account")
                setAccountColor("blue")
                setAccountIcon("landmark")
                setOpeningBalance("0")
                setIsAddingAccount(true)
              }}
              className="text-xs rounded-lg gap-1.5 h-8"
            >
              <Plus className="size-3.5" />
              <span>Add Account</span>
            </Button>
          </div>

          {/* Account Form Modal / Accordion */}
          {isAddingAccount && (
            <form
              onSubmit={handleSaveAccountForm}
              className="p-4 rounded-xl border border-primary/30 bg-card/90 space-y-3.5 shadow-xs"
            >
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  {editingAccount ? "Edit Payment Account" : "New Payment Account"}
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAddingAccount(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-foreground mb-1">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. HDFC Salary, SBI Savings, Cash"
                    className="w-full px-3 py-1.5 bg-background border border-border/80 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-foreground mb-1">
                    Bank / Provider Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. HDFC Bank, ICICI, State Bank"
                    className="w-full px-3 py-1.5 bg-background border border-border/80 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-foreground mb-1">
                    Account Type
                  </label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as AccountType)}
                    className="w-full px-3 py-1.5 bg-background border border-border/80 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary"
                  >
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-foreground mb-1">
                    Opening Balance
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-1.5 bg-background border border-border/80 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
              </div>

              {/* Color & Icon Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border/50">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-foreground">
                    Color Accent
                  </label>
                  <div className="flex items-center gap-2">
                    {ACCOUNT_COLORS.map((c: string) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setAccountColor(c)}
                        className={`size-6 rounded-full border-2 transition-all ${
                          c === "blue"
                            ? "bg-blue-500"
                            : c === "emerald"
                            ? "bg-emerald-500"
                            : c === "purple"
                            ? "bg-purple-500"
                            : c === "amber"
                            ? "bg-amber-500"
                            : c === "rose"
                            ? "bg-rose-500"
                            : c === "indigo"
                            ? "bg-indigo-500"
                            : "bg-slate-500"
                        } ${accountColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-foreground">
                    Icon
                  </label>
                  <div className="flex items-center gap-1.5">
                    {ACCOUNT_ICONS.map((ic: string) => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setAccountIcon(ic)}
                        className={`size-7 rounded-lg border flex items-center justify-center transition-all ${
                          accountIcon === ic
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border/70 hover:bg-muted"
                        }`}
                      >
                        {getAccountIcon(ic, "size-3.5")}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddingAccount(false)}
                  className="text-xs rounded-lg"
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="text-xs rounded-lg">
                  {editingAccount ? "Update Account" : "Save Account"}
                </Button>
              </div>
            </form>
          )}

          {/* Accounts Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {accounts.map((acc) => {
              const colorClasses = getAccountColorClasses(acc.color)
              const spentFromAcc = expenses
                .filter((e) => e.accountId === acc.id)
                .reduce((sum, e) => sum + e.amount, 0)

              return (
                <div
                  key={acc.id}
                  className={`p-4 rounded-xl border bg-card/70 space-y-2.5 transition-all shadow-2xs ${
                    acc.isArchived ? "opacity-60 border-border/40" : "border-border/80"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`size-8 rounded-lg border flex items-center justify-center shrink-0 ${colorClasses}`}
                      >
                        {getAccountIcon(acc.icon, "size-4")}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm text-foreground">
                            {acc.name}
                          </span>
                          {acc.isArchived && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                              Archived
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {acc.type} {acc.bankName && `• ${acc.bankName}`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAccount(acc)
                          setAccountName(acc.name)
                          setBankName(acc.bankName || "")
                          setAccountType(acc.type)
                          setAccountColor(acc.color)
                          setAccountIcon(acc.icon)
                          setOpeningBalance(String(acc.openingBalance || 0))
                          setIsAddingAccount(true)
                        }}
                        className="size-7 rounded-md p-0 inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                        title="Edit Account"
                      >
                        <Edit2 className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleArchiveAccount(acc)}
                        className="size-7 rounded-md p-0 inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                        title={acc.isArchived ? "Unarchive Account" : "Archive Account"}
                      >
                        {acc.isArchived ? (
                          <ArchiveRestore className="size-3.5" />
                        ) : (
                          <Archive className="size-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingAccountId(acc.id)}
                        className="size-7 rounded-md p-0 inline-flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Delete Account"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40 text-muted-foreground">
                    <span>Total Spent:</span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatCurrency(spentFromAcc)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* EDIT EXPENSE MODAL */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
          <form
            onSubmit={handleUpdateExpense}
            className="w-full max-w-md p-5 rounded-2xl border border-border/80 bg-card shadow-lg space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
              <h3 className="text-sm font-heading font-bold text-foreground">
                Edit Expense
              </h3>
              <button
                type="button"
                onClick={() => setEditingExpense(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-foreground mb-1">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={editingExpense.amount}
                  onChange={(e) =>
                    setEditingExpense({ ...editingExpense, amount: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 text-base font-bold bg-background border border-border/80 rounded-lg focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-foreground mb-1">
                  Category
                </label>
                <select
                  value={editingExpense.category}
                  onChange={(e) =>
                    setEditingExpense({
                      ...editingExpense,
                      category: e.target.value as ExpenseCategory,
                    })
                  }
                  className="w-full px-3 py-1.5 bg-background border border-border/80 rounded-lg focus:ring-1 focus:ring-primary"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-foreground mb-1">
                  Payment Account
                </label>
                <select
                  value={editingExpense.accountId}
                  onChange={(e) => {
                    const acc = accounts.find((a) => a.id === e.target.value)
                    setEditingExpense({
                      ...editingExpense,
                      accountId: e.target.value,
                      accountName: acc?.name || editingExpense.accountName,
                    })
                  }}
                  className="w-full px-3 py-1.5 bg-background border border-border/80 rounded-lg focus:ring-1 focus:ring-primary"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-foreground mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={editingExpense.description || ""}
                  onChange={(e) =>
                    setEditingExpense({ ...editingExpense, description: e.target.value })
                  }
                  className="w-full px-3 py-1.5 bg-background border border-border/80 rounded-lg focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-foreground mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={editingExpense.date}
                    onChange={(e) =>
                      setEditingExpense({ ...editingExpense, date: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-background border border-border/80 rounded-lg focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-foreground mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    value={editingExpense.time || ""}
                    onChange={(e) =>
                      setEditingExpense({ ...editingExpense, time: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-background border border-border/80 rounded-lg focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-foreground mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={editingExpense.notes || ""}
                  onChange={(e) =>
                    setEditingExpense({ ...editingExpense, notes: e.target.value })
                  }
                  className="w-full px-3 py-1.5 bg-background border border-border/80 rounded-lg focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingExpense(null)}
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

      {/* CONFIRM DELETE EXPENSE MODAL */}
      {deletingExpenseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
          <div className="w-full max-w-sm p-5 rounded-2xl border border-border/80 bg-card shadow-lg space-y-3">
            <h3 className="text-sm font-heading font-bold text-foreground">
              Delete Expense?
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to remove this expense record? This action will soft-delete the transaction.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeletingExpenseId(null)}
                className="text-xs rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleConfirmDeleteExpense}
                className="text-xs rounded-lg"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE ACCOUNT MODAL */}
      {deletingAccountId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
          <div className="w-full max-w-sm p-5 rounded-2xl border border-border/80 bg-card shadow-lg space-y-3">
            <h3 className="text-sm font-heading font-bold text-foreground">
              Delete Account?
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to delete this payment account? Consider archiving instead if you want to keep historical transaction references clean.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeletingAccountId(null)}
                className="text-xs rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleConfirmDeleteAccount}
                className="text-xs rounded-lg"
              >
                Delete Account
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
