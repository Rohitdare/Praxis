import * as React from "react"
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Trash2,
  Save,
  X,
  WifiOff,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { useAuth } from "@/lib/auth/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DateTimeSelector } from "@/components/ui/date-time-picker"
import {
  fetchCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  validateEventDates,
  type CalendarEventRecord,
} from "@/lib/calendar/service"
import {
  getUserTimezone,
  getDateKeyInTimezone,
  formatTimeInTimezone,
  isoToLocalDatetimeString,
  localDatetimeStringToUtcIso,
} from "@/lib/calendar/timezone"

interface DayCell {
  date: Date
  dateKey: string
  dayNumber: number
  isCurrentMonth: boolean
  isToday: boolean
}

export function CalendarPage() {
  const { user } = useAuth()
  const userId = user?.id

  const timezone = React.useMemo(() => getUserTimezone(), [])
  const isOnline = typeof navigator === "undefined" || navigator.onLine

  // Navigation state: current month/year view
  const [viewDate, setViewDate] = React.useState<Date>(() => new Date())
  const [selectedDateKey, setSelectedDateKey] = React.useState<string>(() =>
    getDateKeyInTimezone(new Date(), timezone)
  )

  const [events, setEvents] = React.useState<CalendarEventRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  // Dialog / Edit state
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingEvent, setEditingEvent] = React.useState<CalendarEventRecord | null>(null)
  const [pendingEventId, setPendingEventId] = React.useState<string>(() => crypto.randomUUID())
  const [formTitle, setFormTitle] = React.useState("")
  const [formContent, setFormContent] = React.useState("")
  const [formStart, setFormStart] = React.useState("")
  const [formEnd, setFormEnd] = React.useState("")
  const [formAllDay, setFormAllDay] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)

  // Load events
  const loadEvents = React.useCallback(async () => {
    if (!userId) return
    setIsLoading(true)
    setLoadError(null)
    try {
      const data = await fetchCalendarEvents(userId)
      setEvents(data)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load calendar events")
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  React.useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  // Month navigation helpers
  const handlePrevMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const handleToday = () => {
    const today = new Date()
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDateKey(getDateKeyInTimezone(today, timezone))
  }

  const [todayKey] = React.useState(() => getDateKeyInTimezone(new Date(), timezone))

  // Generate month grid cells
  const monthCells = React.useMemo<DayCell[]>(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()

    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)
    const daysInMonth = lastDayOfMonth.getDate()
    const startingDayOfWeek = firstDayOfMonth.getDay() // 0 = Sunday

    const cells: DayCell[] = []

    // Previous month trailing days
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i)
      const dateKey = getDateKeyInTimezone(date, timezone)
      cells.push({
        date,
        dateKey,
        dayNumber: prevMonthLastDay - i,
        isCurrentMonth: false,
        isToday: dateKey === todayKey,
      })
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const dateKey = getDateKeyInTimezone(date, timezone)
      cells.push({
        date,
        dateKey,
        dayNumber: day,
        isCurrentMonth: true,
        isToday: dateKey === todayKey,
      })
    }

    // Next month leading days to complete full rows (multiple of 7)
    const totalRemaining = (7 - (cells.length % 7)) % 7
    for (let i = 1; i <= totalRemaining; i++) {
      const date = new Date(year, month + 1, i)
      const dateKey = getDateKeyInTimezone(date, timezone)
      cells.push({
        date,
        dateKey,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dateKey === todayKey,
      })
    }

    return cells
  }, [viewDate, timezone, todayKey])

  // Events indexed by dateKey in user's timezone
  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, CalendarEventRecord[]>()
    for (const event of events) {
      const key = getDateKeyInTimezone(event.startAt, timezone)
      const list = map.get(key) || []
      list.push(event)
      map.set(key, list)
    }
    return map
  }, [events, timezone])

  // Events on currently selected date
  const selectedDayEvents = React.useMemo(() => {
    return eventsByDate.get(selectedDateKey) || []
  }, [eventsByDate, selectedDateKey])

  // Open Create Dialog for a given date
  const openCreateDialog = (targetDateKey?: string) => {
    const dateKey = targetDateKey || selectedDateKey
    setEditingEvent(null)
    setPendingEventId(crypto.randomUUID())
    setFormTitle("")
    setFormContent("")
    setFormAllDay(false)
    setFormStart(`${dateKey}T09:00`)
    setFormEnd(`${dateKey}T10:00`)
    setFormError(null)
    setDialogOpen(true)
  }

  // Open Edit Dialog for an event
  const openEditDialog = (event: CalendarEventRecord) => {
    setEditingEvent(event)
    setFormTitle(event.title)
    setFormContent(event.content || "")
    setFormAllDay(event.allDay)
    setFormStart(isoToLocalDatetimeString(event.startAt, timezone))
    setFormEnd(event.endAt ? isoToLocalDatetimeString(event.endAt, timezone) : "")
    setFormError(null)
    setDialogOpen(true)
  }

  // Save Event (Create or Update)
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitle.trim()) {
      setFormError("Event title cannot be empty")
      return
    }

    if (!formStart) {
      setFormError("Start date and time is required")
      return
    }

    // Convert local datetime strings to UTC ISO
    const startUtc = localDatetimeStringToUtcIso(formStart, timezone)
    const endUtc = formEnd ? localDatetimeStringToUtcIso(formEnd, timezone) : null

    const dateValidationError = validateEventDates(startUtc, endUtc)
    if (dateValidationError) {
      setFormError(dateValidationError)
      return
    }

    setIsSubmitting(true)
    setFormError(null)

    try {
      if (editingEvent) {
        const updated = await updateCalendarEvent({
          itemId: editingEvent.itemId,
          title: formTitle,
          content: formContent || null,
          startAt: startUtc,
          endAt: endUtc,
          allDay: formAllDay,
        })
        setEvents((prev) => prev.map((ev) => (ev.itemId === updated.itemId ? updated : ev)))
      } else {
        if (!userId) throw new Error("Authenticated user required")
        const created = await createCalendarEvent({
          userId,
          title: formTitle,
          content: formContent || null,
          startAt: startUtc,
          endAt: endUtc,
          allDay: formAllDay,
          itemId: pendingEventId,
        })
        setEvents((prev) => [...prev, created])
      }
      setDialogOpen(false)
    } catch (err) {
      console.error("Failed to save calendar event:", err)
      setFormError(err instanceof Error ? err.message : "Failed to save event")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Soft Delete Event
  const handleDeleteEvent = async () => {
    if (!editingEvent) return
    const confirmed = window.confirm("Are you sure you want to delete this event?")
    if (!confirmed) return

    setIsDeleting(true)
    setFormError(null)
    try {
      await deleteCalendarEvent(editingEvent.itemId)
      setEvents((prev) => prev.filter((ev) => ev.itemId !== editingEvent.itemId))
      setDialogOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to delete event")
    } finally {
      setIsDeleting(false)
    }
  }

  const monthYearTitle = viewDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  return (
    <div className="w-full max-w-5xl lg:max-w-6xl mx-auto py-2 md:py-4 space-y-6">
      {/* Offline banner */}
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 p-3 text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-md"
        >
          <WifiOff className="size-4 shrink-0" />
          <span>
            Offline Mode — Viewing cached calendar events. Creating and editing events are disabled
            until you reconnect.
          </span>
        </div>
      )}

      {/* Page Header and Month Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 pb-3 border-b border-border/50">
        <div>
          <h1 className="font-heading font-extrabold text-2xl md:text-3xl tracking-tight text-foreground flex items-center gap-2.5">
            <CalendarIcon className="size-5 text-muted-foreground shrink-0" />
            Calendar
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            View and organize events ({timezone})
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-between sm:justify-end w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToday}
            className="text-xs font-medium rounded-lg h-8 px-2.5 border-border/80 min-h-[32px]"
          >
            Today
          </Button>
          <div className="flex items-center border border-border/80 rounded-lg bg-card/50 overflow-hidden">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Previous month"
              className="p-2 sm:p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="font-heading font-bold px-2 sm:px-3 py-1 text-xs select-none min-w-[100px] sm:min-w-[130px] text-center text-foreground">
              {monthYearTitle}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Next month"
              className="p-2 sm:p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <Button
            size="sm"
            onClick={() => openCreateDialog()}
            disabled={!isOnline}
            className="text-xs gap-1 sm:gap-1.5 shadow-2xs hover:shadow-xs rounded-lg font-medium h-8 px-2.5 sm:px-3 min-h-[32px]"
            title={!isOnline ? "Event creation is disabled while offline" : "Create Event"}
          >
            <Plus className="size-3.5" />
            <span className="hidden xs:inline sm:inline">Create Event</span>
            <span className="inline xs:hidden sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="size-6 animate-spin text-primary" />
          <span className="text-xs">Loading calendar events...</span>
        </div>
      )}

      {/* Error state */}
      {loadError && !isLoading && (
        <div className="p-4 border border-destructive/20 bg-destructive/5 text-destructive rounded-md text-xs flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          <span>{loadError}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void loadEvents()}
            className="ml-auto text-xs underline h-auto p-0"
          >
            Retry
          </Button>
        </div>
      )}

      {!isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Month Calendar Grid (Takes 2 cols on lg) */}
          <div className="lg:col-span-2 border border-border/80 rounded-xl bg-card/60 overflow-hidden shadow-2xs">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-border/70 bg-muted/30 text-center font-heading font-semibold text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground py-2 sm:py-2.5">
              <span><span className="inline sm:hidden">S</span><span className="hidden sm:inline">Sun</span></span>
              <span><span className="inline sm:hidden">M</span><span className="hidden sm:inline">Mon</span></span>
              <span><span className="inline sm:hidden">T</span><span className="hidden sm:inline">Tue</span></span>
              <span><span className="inline sm:hidden">W</span><span className="hidden sm:inline">Wed</span></span>
              <span><span className="inline sm:hidden">T</span><span className="hidden sm:inline">Thu</span></span>
              <span><span className="inline sm:hidden">F</span><span className="hidden sm:inline">Fri</span></span>
              <span><span className="inline sm:hidden">S</span><span className="hidden sm:inline">Sat</span></span>
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 divide-x divide-y divide-border/50">
              {monthCells.map((cell) => {
                const dayEvents = eventsByDate.get(cell.dateKey) || []
                const isSelected = cell.dateKey === selectedDateKey

                return (
                  <button
                    key={cell.dateKey}
                    type="button"
                    onClick={() => setSelectedDateKey(cell.dateKey)}
                    className={`min-h-[52px] sm:min-h-[88px] p-1 sm:p-2 flex flex-col text-left transition-all relative ${
                      cell.isCurrentMonth
                        ? "bg-card/40 hover:bg-muted/30"
                        : "bg-muted/10 text-muted-foreground/50 hover:bg-muted/20"
                    } ${isSelected ? "ring-2 ring-foreground/30 ring-inset z-10 bg-secondary/60" : ""}`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`text-xs font-medium inline-flex items-center justify-center size-5 sm:size-6 rounded-full transition-all ${
                          cell.isToday
                            ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                            : cell.isCurrentMonth
                            ? "text-foreground font-medium"
                            : "text-muted-foreground/50"
                        }`}
                      >
                        {cell.dayNumber}
                      </span>
                      {dayEvents.length > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-secondary text-secondary-foreground border border-border/60 hidden sm:inline-block tabular-nums">
                          {dayEvents.length}
                        </span>
                      )}
                    </div>

                    {/* Mobile event indicator dots */}
                    <div className="flex sm:hidden items-center justify-center gap-0.5 mt-1 flex-wrap w-full">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <span
                          key={ev.itemId}
                          className="size-1 rounded-full bg-primary"
                          title={ev.title}
                        />
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-[8px] text-muted-foreground leading-none font-bold">
                          +
                        </span>
                      )}
                    </div>

                    {/* Desktop compact event pills preview */}
                    <div className="hidden sm:block mt-1.5 space-y-1 overflow-hidden w-full">
                      {dayEvents.slice(0, 2).map((ev) => (
                        <div
                          key={ev.itemId}
                          className="text-[10px] truncate px-1.5 py-0.5 rounded-md bg-secondary text-foreground font-medium border border-border/40"
                          title={ev.title}
                        >
                          {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-[9px] text-muted-foreground pl-1 font-medium">
                          +{dayEvents.length - 2} more
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Compact Selected Day View (Takes 1 col on lg) */}
          <div className="border border-border/80 rounded-xl bg-card/60 p-4.5 flex flex-col space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h2 className="font-heading font-bold text-sm tracking-tight text-foreground">
                  Events on {selectedDateKey}
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {selectedDayEvents.length} event{selectedDayEvents.length === 1 ? "" : "s"}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openCreateDialog(selectedDateKey)}
                disabled={!isOnline}
                className="text-xs gap-1"
                title={!isOnline ? "Event creation disabled offline" : "Add event"}
              >
                <Plus className="size-3" />
                <span>Add</span>
              </Button>
            </div>

            {/* List of day events */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {selectedDayEvents.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground space-y-2">
                  <p className="text-xs">No events scheduled for this day.</p>
                  {isOnline && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openCreateDialog(selectedDateKey)}
                      className="text-xs text-primary"
                    >
                      + Create event on this day
                    </Button>
                  )}
                </div>
              ) : (
                selectedDayEvents.map((ev) => (
                  <div
                    key={ev.itemId}
                    onClick={() => openEditDialog(ev)}
                    className="p-3 border border-border/80 rounded-md hover:bg-muted/40 transition-colors cursor-pointer space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {ev.title}
                      </span>
                      {ev.allDay ? (
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          All Day
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0">
                          <Clock className="size-3" />
                          {formatTimeInTimezone(ev.startAt, timezone)}
                        </span>
                      )}
                    </div>
                    {ev.content && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {ev.content}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Event Create / Edit Dialog Modal */}
      {dialogOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg shadow-lg max-w-md w-full p-5 sm:p-6 space-y-4 max-h-[92dvh] overflow-y-auto safe-area-pb">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-semibold text-foreground">
                {editingEvent ? "Edit Event" : "Create Event"}
              </h2>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-md flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEvent} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Title <span className="text-destructive">*</span>
                </label>
                <Input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Planning session, Dentist appointment"
                  required
                  disabled={isSubmitting || !isOnline}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Description / Notes
                </label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Optional details or agenda..."
                  rows={3}
                  disabled={isSubmitting || !isOnline}
                  className="w-full text-xs p-2 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allDayCheckbox"
                  checked={formAllDay}
                  onChange={(e) => setFormAllDay(e.target.checked)}
                  disabled={isSubmitting || !isOnline}
                  className="rounded border-input text-primary focus:ring-primary"
                />
                <label htmlFor="allDayCheckbox" className="text-xs text-foreground cursor-pointer">
                  All-day event
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DateTimeSelector
                  dateId="startDateTimeInput"
                  timeId="startTimeInput"
                  dateLabel="Start Date"
                  timeLabel="Start Time"
                  ariaLabel="Start Date & Time"
                  value={formStart}
                  onChange={setFormStart}
                  hideTime={formAllDay}
                  required
                  disabled={isSubmitting || !isOnline}
                  defaultTime="09:00"
                />

                <DateTimeSelector
                  dateId="endDateTimeInput"
                  timeId="endTimeInput"
                  dateLabel="End Date"
                  timeLabel="End Time"
                  ariaLabel="End Date & Time"
                  value={formEnd}
                  onChange={setFormEnd}
                  hideTime={formAllDay}
                  disabled={isSubmitting || !isOnline}
                  defaultTime="10:00"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                {editingEvent ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDeleteEvent}
                    disabled={isDeleting || isSubmitting || !isOnline}
                    className="text-destructive hover:bg-destructive/10 text-xs gap-1"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Delete</span>
                  </Button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDialogOpen(false)}
                    disabled={isSubmitting}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmitting || !isOnline}
                    className="text-xs gap-1.5"
                  >
                    {isSubmitting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    <span>Save Event</span>
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
