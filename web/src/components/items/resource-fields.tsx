import { ExternalLink } from "lucide-react"
import type { ResourceFields } from "@/lib/items/types"
import type { ResourceStatus } from "@/lib/supabase/database.types"

interface ResourceFieldsProps {
  fields: ResourceFields
  onChange: (fields: ResourceFields) => void
  disabled?: boolean
  error?: string
}

const STATUSES: { value: ResourceStatus; label: string }[] = [
  { value: "unread", label: "Unread" },
  { value: "reading", label: "Reading" },
  { value: "completed", label: "Finished" },
]

export function ResourceFieldsComponent({
  fields,
  onChange,
  disabled,
  error,
}: ResourceFieldsProps) {
  return (
    <div className="p-4 rounded-lg border border-border/80 bg-muted/20 space-y-4 text-xs">
      {/* URL input */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="resource-url" className="font-medium text-foreground block">
            Resource Link / URL <span className="text-destructive">*</span>
          </label>
          {fields.url && (
            <a
              href={fields.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              Test link <ExternalLink className="size-2.5" />
            </a>
          )}
        </div>
        <input
          id="resource-url"
          type="url"
          placeholder="https://example.com/article"
          value={fields.url}
          onChange={(e) => onChange({ ...fields, url: e.target.value })}
          disabled={disabled}
          className={`w-full px-3 py-2 rounded-md border text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 ${
            error
              ? "border-destructive focus-visible:ring-destructive bg-destructive/5"
              : "border-input bg-background"
          }`}
        />
        {error && <p className="text-[11px] text-destructive">{error}</p>}
      </div>

      {/* Reading Status Selector */}
      <div className="space-y-1.5">
        <label className="font-medium text-foreground block">Reading Status</label>
        <div className="flex gap-2">
          {STATUSES.map((s) => {
            const isSelected = fields.resource_status === s.value
            return (
              <button
                key={s.value}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ ...fields, resource_status: s.value })}
                className={`flex-1 py-1.5 px-2 rounded-md border text-center font-medium transition-colors ${
                  isSelected
                    ? "bg-secondary text-secondary-foreground border-foreground/30 shadow-xs"
                    : "bg-background text-muted-foreground border-border hover:bg-accent"
                } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
