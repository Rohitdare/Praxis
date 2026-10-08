import * as React from "react"
import { CaptureBar } from "@/components/capture/capture-bar"
import { RecentCaptures } from "@/components/capture/recent-captures"
import { getRecentCaptures } from "@/lib/db/capture"
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
  }, [loadRecentCaptures])

  return (
    <div className="w-full max-w-2xl mx-auto py-6 md:py-12 space-y-8">
      {/* Visual hierarchy: Capture is dominant per DP-02 */}
      <header className="space-y-2 text-center md:text-left">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
          What do you want to remember?
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground">
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
