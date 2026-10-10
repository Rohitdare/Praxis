import type {
  Database,
  ItemStatus,
  ItemType,
  ResourceStatus,
  TaskPriority,
} from "@/lib/supabase/database.types"

export type {
  Database,
  ItemStatus,
  ItemType,
  ResourceStatus,
  TaskPriority,
}

export type ItemRow = Database["public"]["Tables"]["items"]["Row"]
export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"]
export type ResourceRow = Database["public"]["Tables"]["resources"]["Row"]
export type CalendarEventRow = Database["public"]["Tables"]["calendar_events"]["Row"]

export type ClassificationType = "note" | "task" | "resource" | "event" | "idea" | "unclassified"

export interface TaskFields {
  due_at: string | null
  priority: TaskPriority
  completed_at: string | null
}

export interface ResourceFields {
  url: string
  domain?: string | null
  resource_status: ResourceStatus
}

export interface EventFields {
  start_at: string
  end_at: string | null
  all_day: boolean
}

export interface ItemDetailRecord {
  item: ItemRow
  task: TaskRow | null
  resource: ResourceRow | null
  event: CalendarEventRow | null
  isLocalOnly?: boolean
}

export interface UpdateItemPayload {
  title: string
  content: string
  type: ClassificationType
  status?: ItemStatus
  task?: TaskFields
  resource?: ResourceFields
  event?: EventFields
}

export interface FormValidationErrors {
  title?: string
  content?: string
  url?: string
  eventDates?: string
}

export function validateItemPayload(payload: UpdateItemPayload): FormValidationErrors {
  const errors: FormValidationErrors = {}

  if (payload.title && payload.title.length > 500) {
    errors.title = "Title cannot exceed 500 characters."
  }

  if (payload.type === "resource") {
    if (!payload.resource?.url || payload.resource.url.trim().length === 0) {
      errors.url = "URL is required for resource items."
    } else {
      try {
        const parsed = new URL(payload.resource.url.trim())
        if (!["http:", "https:"].includes(parsed.protocol)) {
          errors.url = "URL must start with http:// or https://"
        }
      } catch {
        errors.url = "Please enter a valid URL (e.g. https://example.com)."
      }
    }
  }

  if (payload.type === "event") {
    if (!payload.event?.start_at) {
      errors.eventDates = "Start time is required for calendar events."
    } else if (payload.event.end_at) {
      const startMs = new Date(payload.event.start_at).getTime()
      const endMs = new Date(payload.event.end_at).getTime()
      if (endMs < startMs) {
        errors.eventDates = "End time must be after start time."
      }
    }
  }

  return errors
}
