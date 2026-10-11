import * as React from "react"
import { CaptureBar } from "@/components/capture/capture-bar"
import { RecentCaptures } from "@/components/capture/recent-captures"
import { getRecentCaptures } from "@/lib/db/capture"
import { triggerBackgroundSync } from "@/lib/sync/engine"
import type { LocalItem } from "@/lib/db/schema"

export function CapturePage() {
  const [recentItems, setRecentItems] = React.useState<LocalItem[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  const loadRecentCaptures = React.useCallback(async () => {
    try {
      const items = await getRecentCaptures(5)
      setRecentItems(items)
    } catch (err) {
      console.error("Failed to load recent captures:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    let ignore = false
    getRecentCaptures(5)
      .then((items) => {
        if (!ignore) {
          setRecentItems(items)
        }
      })
      .catch((err) => {
        console.error("Failed to load recent captures:", err)
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [])

  const handleCaptureSuccess = React.useCallback(() => {
    // Immediately reload the recent captures from IndexedDB
    loadRecentCaptures()
    // Schedule background synchronization without blocking the capture workflow
    triggerBackgroundSync()
  }, [loadRecentCaptures])

  return (
    <div className="w-full max-w-4xl lg:max-w-5xl mx-auto py-6 md:py-10 space-y-8">
      {/* Visual hierarchy: Capture is dominant per DP-02 */}
      <header className="space-y-2 text-center md:text-left">
        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl lg:text-4xl tracking-tight text-foreground">
          What do you want to remember?
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xl">
          Quickly capture links, ideas, tasks, or anything else. Saved locally first.
        </p>
      </header>

      {/* Primary CaptureBar */}
      <CaptureBar onCaptureSuccess={handleCaptureSuccess} />

      {/* Recent Local Captures */}
      <RecentCaptures items={recentItems} isLoading={isLoading} />
    </div>
  )
}
