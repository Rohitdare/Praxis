import * as React from "react"
import { Check, Sparkles, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { captureItem, classifyInputLocally, type CaptureResult } from "@/lib/db/capture"
import { useAuth } from "@/lib/auth/auth-context"

export interface CaptureBarProps {
  onCaptureSuccess?: (result: CaptureResult) => void
}

export function CaptureBar({ onCaptureSuccess }: CaptureBarProps) {
  const { user } = useAuth()
  const [input, setInput] = React.useState("")
  const [isFocused, setIsFocused] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [feedback, setFeedback] = React.useState<{ text: string; isOffline: boolean } | null>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

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
      })

      // Microcopy per design.md §12:
      // Online: "Saved"
      // Offline: "Saved offline — will sync later"
      const message = result.isOffline
        ? "Saved offline — will sync later"
        : "Saved"

      setFeedback({ text: message, isOffline: result.isOffline })
      setInput("")

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

          <div className="flex items-center justify-between px-3 pb-2.5 pt-1.5 border-t border-border/50 gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {smartClassification ? (
                <div
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary/80 border border-border/60 text-[11px] font-medium text-foreground/80 animate-in fade-in duration-150"
                  title="Smart capture suggestion"
                >
                  <Sparkles className="size-3 text-muted-foreground" aria-hidden="true" />
                  <span className="capitalize">{smartClassification.type}</span>
                  {smartClassification.suggestedTags?.map((tag) => (
                    <span key={tag} className="text-muted-foreground font-normal">
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
              className="min-h-[36px] min-w-[72px] font-medium transition-all shadow-2xs hover:shadow-xs"
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
