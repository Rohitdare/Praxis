import * as React from "react"
import { AlertCircle, ArrowRight, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"

interface RolloverBannerProps {
  overdueCount: number
  onCarryAllForward: () => Promise<void>
  disabled?: boolean
}

export function RolloverBanner({
  overdueCount,
  onCarryAllForward,
  disabled = false,
}: RolloverBannerProps) {
  const [isRollingOver, setIsRollingOver] = React.useState(false)

  if (overdueCount <= 0) return null

  const handleCarryAll = async () => {
    setIsRollingOver(true)
    try {
      await onCarryAllForward()
    } finally {
      setIsRollingOver(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.04] text-xs">
      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
        <AlertCircle className="size-4 shrink-0" />
        <span className="font-medium">
          You have {overdueCount} unfinished task{overdueCount > 1 ? "s" : ""} from previous days.
        </span>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || isRollingOver}
        onClick={handleCarryAll}
        className="h-7 px-2.5 rounded-lg text-xs font-medium border-amber-500/30 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300 gap-1 shrink-0"
      >
        <Calendar className="size-3" />
        <span>Carry all to today</span>
        <ArrowRight className="size-3" />
      </Button>
    </div>
  )
}
