import * as React from "react"
import { Calendar, Check, CheckSquare, FileText, Inbox, Link2, Sparkles, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { captureItem, classifyInputLocally, type CaptureResult, type CaptureCategory } from "@/lib/db/capture"
import { useAuth } from "@/lib/auth/auth-context"

export interface CaptureBarProps {
  onCaptureSuccess?: (result: CaptureResult) => void
}

interface CategoryOption {
  id: CaptureCategory
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const CATEGORIES: CategoryOption[] = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "note", label: "Note", icon: FileText },
  { id: "task", label: "Task", icon: CheckSquare },
  { id: "event", label: "Event", icon: Calendar },
  { id: "resource", label: "Resource", icon: Link2 },
]

export function CaptureBar({ onCaptureSuccess }: CaptureBarProps) {
  const { user } = useAuth()
  const [input, setInput] = React.useState("")
  const [selectedCategory, setSelectedCategory] = React.useState<CaptureCategory | null>(null)
  const [isFocused, setIsFocused] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [feedback, setFeedback] = React.useState<{ text: string; isOffline: boolean } | null>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const handleCategoryClick = (cat: CaptureCategory) => {
    setSelectedCategory((prev) => (prev === cat ? null : cat))
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }

    const trimmed = input.trim()
    if (!trimmed || isSaving) {
      return
    }

    setIsSaving(true)
    try {
      const result = await captureItem({
        rawInput: input,
        userId: user?.id,
        category: selectedCategory ?? undefined,
      })

      // Microcopy per design.md §12:
      // Online: "Saved"
      // Offline: "Saved offline — will sync later"
      const message = result.isOffline
        ? "Saved offline — will sync later"
        : "Saved"

      setFeedback({ text: message, isOffline: result.isOffline })
      setInput("")
      setSelectedCategory(null)

      if (onCaptureSuccess) {
        onCaptureSuccess(result)
      }

      // Re-focus the input for rapid subsequent captures
      textareaRef.current?.focus()

      // Auto-clear feedback after 3 seconds
      setTimeout(() => {
        setFeedback((prev) => (prev?.text === message ? null : prev))
      }, 3000)
    } catch (err) {
      console.error("Local capture failed:", err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Desktop keyboard shortcut: Enter submits without Shift
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const hasContent = input.trim().length > 0

  // Deterministic local smart capture suggestion preview
  const smartClassification = React.useMemo(() => {
    if (!hasContent) return null
    const res = classifyInputLocally(input)
    if (res.type === "unclassified" && (!res.suggestedTags || res.suggestedTags.length === 0)) {
      return null
    }
    return res
  }, [input, hasContent])

  return (
    <div className="w-full space-y-3">
      <form onSubmit={handleSubmit} className="w-full">
        <div
          className={`relative rounded-xl border bg-card/80 transition-all duration-150 ${
            isFocused
              ? "border-foreground/35 ring-2 ring-foreground/5 shadow-xs"
              : "border-border hover:border-foreground/20"
          }`}
        >
          <label htmlFor="capture-input" className="sr-only">
            Capture input
          </label>
          <textarea
            id="capture-input"
            ref={textareaRef}
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            placeholder="Paste a link, idea, task, event or anything..."
            className="w-full resize-none bg-transparent px-4 py-3.5 text-base md:text-sm text-foreground placeholder:text-muted-foreground outline-none leading-relaxed font-sans"
            aria-label="Capture input"
          />

          {/* Compact category selector buttons */}
          <div
            className="flex items-center gap-1 sm:gap-1.5 px-3 py-1.5 border-t border-border/40 overflow-x-auto scrollbar-none"
            role="group"
            aria-label="Capture destination category"
          >
            {CATEGORIES.map(({ id, label, icon: Icon }) => {
              const isSelected = selectedCategory === id
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={isSaving}
                  onClick={() => handleCategoryClick(id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all outline-none shrink-0 cursor-pointer",
                    "focus-visible:ring-2 focus-visible:ring-ring/50 select-none",
                    isSelected
                      ? "bg-secondary text-foreground font-semibold border border-border/80 shadow-2xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent",
                    isSaving && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-between px-3 pb-2.5 pt-1.5 border-t border-border/50 gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {smartClassification && (!selectedCategory || selectedCategory === "inbox") ? (
                <div
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary/80 border border-border/60 text-[11px] font-medium text-foreground/80 animate-in fade-in duration-150 max-w-[160px] sm:max-w-none truncate"
                  title="Smart capture suggestion"
                >
                  <Sparkles className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span className="capitalize shrink-0">{smartClassification.type}</span>
                  {smartClassification.suggestedTags?.map((tag) => (
                    <span key={tag} className="text-muted-foreground font-normal truncate">
                      · {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-[11px] text-muted-foreground hidden md:inline">
                  Press <kbd className="font-mono bg-muted/80 px-1 py-0.5 rounded text-[10px] text-foreground/70">Enter</kbd> to save, <kbd className="font-mono bg-muted/80 px-1 py-0.5 rounded text-[10px] text-foreground/70">Shift+Enter</kbd> for new line
                </span>
              )}
            </div>

            <Button
              type="submit"
              size="sm"
              disabled={!hasContent || isSaving}
              className="min-h-[38px] sm:min-h-[36px] min-w-[68px] sm:min-w-[72px] font-medium transition-all shadow-2xs hover:shadow-xs shrink-0"
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </form>

      {/* Confirmation feedback status */}
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-md w-fit transition-all duration-150 ${
            feedback.isOffline
              ? "bg-secondary text-secondary-foreground border border-border"
              : "bg-primary/10 text-primary font-medium"
          }`}
        >
          {feedback.isOffline ? (
            <WifiOff className="size-3.5 text-muted-foreground shrink-0" />
          ) : (
            <Check className="size-3.5 text-primary shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}
    </div>
  )
}
