import * as React from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import {
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Lock,
  Save,
  WifiOff,
} from "lucide-react"
import { useAuth } from "@/lib/auth/auth-context"
import { Button } from "@/components/ui/button"
import { fetchItemDetail, updateItemClassification } from "@/lib/items/service"
import {
  type ClassificationType,
  type FormValidationErrors,
  type ItemDetailRecord,
  type UpdateItemPayload,
  validateItemPayload,
} from "@/lib/items/types"
import { TypeSelector } from "@/components/items/type-selector"
import { TaskFieldsComponent } from "@/components/items/task-fields"
import { ResourceFieldsComponent } from "@/components/items/resource-fields"
import { EventFieldsComponent } from "@/components/items/event-fields"

export function ItemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [isLoading, setIsLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [record, setRecord] = React.useState<ItemDetailRecord | null>(null)

  // Form edit states
  const [title, setTitle] = React.useState("")
  const [content, setContent] = React.useState("")
  const [type, setType] = React.useState<ClassificationType>("note")
  const [taskFields, setTaskFields] = React.useState({
    due_at: null as string | null,
    priority: "normal" as "low" | "normal" | "high",
    completed_at: null as string | null,
  })
  const [resourceFields, setResourceFields] = React.useState({
    url: "",
    resource_status: "unread" as "unread" | "reading" | "completed",
  })
  const [eventFields, setEventFields] = React.useState(() => ({
    start_at: new Date().toISOString(),
    end_at: null as string | null,
    all_day: false,
  }))

  const [isSaving, setIsSaving] = React.useState(false)
  const [saveSuccess, setSaveSuccess] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [validationErrors, setValidationErrors] = React.useState<FormValidationErrors>({})

  const isOnline = typeof navigator === "undefined" || navigator.onLine

  // 1. Fetch item detail on mount or id change
  React.useEffect(() => {
    let ignore = false

    async function loadItem() {
      if (!id || !user?.id) return
      setIsLoading(true)
      setLoadError(null)

      try {
        const data = await fetchItemDetail(id, user.id)
        if (ignore) return

        setRecord(data)
        setTitle(data.item.title || "")
        setContent(data.item.content || "")
        setType(data.item.type)

        if (data.task) {
          setTaskFields({
            due_at: data.task.due_at,
            priority: data.task.priority,
            completed_at: data.task.completed_at,
          })
        }

        if (data.resource) {
          setResourceFields({
            url: data.resource.url,
            resource_status: data.resource.resource_status,
          })
        } else if (data.item.raw_input.startsWith("http://") || data.item.raw_input.startsWith("https://")) {
          // Pre-populate URL if raw input was a link
          setResourceFields((prev) => ({ ...prev, url: data.item.raw_input.trim() }))
        }

        if (data.event) {
          setEventFields({
            start_at: data.event.start_at,
            end_at: data.event.end_at,
            all_day: data.event.all_day,
          })
        }
      } catch (err) {
        if (!ignore) {
          setLoadError(err instanceof Error ? err.message : "Failed to load item")
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    void loadItem()

    return () => {
      ignore = true
    }
  }, [id, user?.id])

  // 2. Save handler
  const handleSave = React.useCallback(async () => {
    if (!id || !user?.id || isSaving || !isOnline) return

    setSaveError(null)
    setSaveSuccess(false)

    const payload: UpdateItemPayload = {
      title: title.trim(),
      content: content.trim(),
      type,
      task: type === "task" ? taskFields : undefined,
      resource: type === "resource" ? resourceFields : undefined,
      event: type === "event" ? eventFields : undefined,
    }

    const errors = validateItemPayload(payload)
    setValidationErrors(errors)
    if (Object.keys(errors).length > 0) {
      return
    }

    setIsSaving(true)
    try {
      const updated = await updateItemClassification(id, user.id, payload)
      setRecord(updated)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save changes")
    } finally {
      setIsSaving(false)
    }
  }, [id, user, isSaving, isOnline, title, content, type, taskFields, resourceFields, eventFields])

  // 3. Keyboard shortcuts: Esc to back, Cmd/Ctrl+Enter to save
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        navigate("/inbox")
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault()
        void handleSave()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [navigate, handleSave])

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full max-w-2xl mx-auto py-10 space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs animate-pulse">
          <ArrowLeft className="size-3.5" /> Loading item...
        </div>
        <div className="p-8 rounded-lg border border-border bg-card/50 space-y-4 animate-pulse">
          <div className="h-5 w-1/3 bg-muted rounded" />
          <div className="h-24 w-full bg-muted/60 rounded" />
          <div className="h-10 w-full bg-muted/40 rounded" />
        </div>
      </div>
    )
  }

  // Not found or error loading state
  if (loadError || !record) {
    return (
      <div className="w-full max-w-2xl mx-auto py-12 text-center space-y-4">
        <div className="p-6 rounded-lg border border-border bg-card space-y-3">
          <HelpCircle className="size-8 text-muted-foreground mx-auto" />
          <h2 className="text-sm font-semibold text-foreground">Item Not Found</h2>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {loadError || "This item does not exist or you do not have permission to access it."}
          </p>
          <div className="pt-2">
            <Button asChild size="sm" variant="outline" className="text-xs">
              <Link to="/inbox">
                <ArrowLeft className="size-3.5 mr-1" /> Return to Inbox
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-3xl lg:max-w-4xl mx-auto py-6 md:py-8 space-y-6">
      {/* Top Header & Navigation Bar */}
      <header className="flex items-center justify-between gap-4 border-b border-border/50 pb-4">
        <div className="flex items-center gap-3">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground -ml-2 h-8 px-2.5 rounded-lg"
          >
            <Link to="/inbox" title="Return to Inbox (Esc)">
              <ArrowLeft className="size-3.5 mr-1" />
              Inbox
            </Link>
          </Button>
          <span className="text-muted-foreground/40 text-xs">/</span>
          <span className="text-xs font-mono text-muted-foreground truncate max-w-[120px] sm:max-w-[200px]">
            {record.item.id.slice(0, 8)}...
          </span>
        </div>

        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium animate-in fade-in">
              <CheckCircle2 className="size-3.5" /> Saved
            </span>
          )}
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !isOnline}
            className="text-xs inline-flex items-center gap-1.5 shadow-2xs hover:shadow-xs rounded-lg font-medium"
            aria-label="Save changes"
          >
            {isSaving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </header>

      {/* Offline Mode Banner (ADR-02) */}
      {!isOnline && (
        <div
          role="alert"
          className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2.5"
        >
          <WifiOff className="size-4 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold">Offline: Read-only mode</p>
            <p className="text-[11px] leading-relaxed text-amber-700/90 dark:text-amber-300/90">
              In accordance with ADR-02, item editing and classification require an active internet
              connection. Connect to the internet to save changes.
            </p>
          </div>
        </div>
      )}

      {/* Save Error Alert */}
      {saveError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/10 text-xs text-destructive space-y-1"
        >
          <p className="font-semibold">Unable to save item</p>
          <p className="text-[11px]">{saveError}</p>
        </div>
      )}

      {/* Core Item Form */}
      <div className="space-y-5">
        {/* Classification Type Selector */}
        <TypeSelector
          currentType={type}
          onChange={(newType) => {
            setType(newType)
            setValidationErrors({})
          }}
          disabled={!isOnline || isSaving}
        />

        {/* Title Field */}
        <div className="space-y-1.5">
          <label htmlFor="item-title" className="text-xs font-medium text-foreground block">
            Title
          </label>
          <input
            id="item-title"
            type="text"
            placeholder="Add a concise title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!isOnline || isSaving}
            className={`w-full px-3.5 py-2.5 rounded-lg border text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 transition-all ${
              validationErrors.title
                ? "border-destructive focus-visible:ring-destructive"
                : "border-input bg-card/60"
            }`}
          />
          {validationErrors.title && (
            <p className="text-[11px] text-destructive">{validationErrors.title}</p>
          )}
        </div>

        {/* Type-Specific Extension Fields */}
        {type === "task" && (
          <TaskFieldsComponent
            fields={taskFields}
            onChange={setTaskFields}
            disabled={!isOnline || isSaving}
          />
        )}

        {type === "resource" && (
          <ResourceFieldsComponent
            fields={resourceFields}
            onChange={setResourceFields}
            disabled={!isOnline || isSaving}
            error={validationErrors.url}
          />
        )}

        {type === "event" && (
          <EventFieldsComponent
            fields={eventFields}
            onChange={setEventFields}
            disabled={!isOnline || isSaving}
            error={validationErrors.eventDates}
          />
        )}

        {/* Content / Markdown Notes Field */}
        <div className="space-y-1.5">
          <label htmlFor="item-content" className="text-xs font-medium text-foreground block">
            Notes & Content (Markdown)
          </label>
          <textarea
            id="item-content"
            rows={5}
            placeholder="Add detailed notes or Markdown formatted thoughts..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={!isOnline || isSaving}
            className="w-full px-3.5 py-2.5 rounded-lg border border-input bg-card/60 text-xs md:text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 resize-y transition-all font-sans"
          />
        </div>
      </div>

      {/* Immutable Raw Input Provenance (ADR-06) */}
      <section className="p-4.5 rounded-xl border border-border/80 bg-card/60 space-y-2.5 text-xs shadow-2xs">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="font-heading font-bold text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Lock className="size-3" /> Original Capture (Immutable — ADR-06)
          </span>
          <span className="text-[11px] tabular-nums">
            {new Date(record.item.captured_at).toLocaleString([], {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        </div>
        <p className="font-mono text-xs text-foreground/90 bg-muted/40 p-3 rounded-lg border border-border/60 break-words whitespace-pre-wrap select-all">
          {record.item.raw_input}
        </p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          The original capture is preserved permanently to provide ground-truth provenance for audit
          records and future AI classification.
        </p>
      </section>
    </div>
  )
}
