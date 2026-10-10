import { Calendar, CheckSquare, FileText, Globe } from "lucide-react"
import { type ClassificationType } from "@/lib/items/types"

interface TypeSelectorProps {
  currentType: ClassificationType
  onChange: (type: ClassificationType) => void
  disabled?: boolean
}

const TYPE_OPTIONS: { type: ClassificationType; label: string; icon: typeof FileText }[] = [
  { type: "note", label: "Note / Idea", icon: FileText },
  { type: "task", label: "Task", icon: CheckSquare },
  { type: "resource", label: "Resource", icon: Globe },
  { type: "event", label: "Event", icon: Calendar },
]

export function TypeSelector({ currentType, onChange, disabled }: TypeSelectorProps) {
  // Normalize "idea" or "unclassified" to note if selected, or match exact
  const normalizedType =
    currentType === "idea" || currentType === "unclassified" ? "note" : currentType

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground block">Classification</label>
      <div
        role="radiogroup"
        aria-label="Item Classification Type"
        className="grid grid-cols-2 sm:grid-cols-4 gap-2"
      >
        {TYPE_OPTIONS.map(({ type, label, icon: Icon }) => {
          const isSelected = normalizedType === type
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onChange(type)}
              className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground"
              } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <Icon className="size-3.5 shrink-0" />
              <span>{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
