/**
 * Timezone utilities for calendar events display and conversion.
 * Conforms to ADR-02 / storage in UTC timestamptz and display in user's timezone.
 */

export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

/**
 * Formats a UTC date or ISO string into YYYY-MM-DD in the specified timezone.
 */
export function getDateKeyInTimezone(dateInput: Date | string, timezone: string): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput
  if (isNaN(date.getTime())) return ""
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    const parts = formatter.formatToParts(date)
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || ""
    return `${getPart("year")}-${getPart("month")}-${getPart("day")}`
  } catch {
    // Fallback to UTC
    return date.toISOString().slice(0, 10)
  }
}

/**
 * Formats a UTC date or ISO string into human-readable time (e.g., 2:30 PM).
 */
export function formatTimeInTimezone(dateInput: Date | string, timezone: string): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput
  if (isNaN(date.getTime())) return ""
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    }).format(date)
  } catch {
    return date.toLocaleTimeString()
  }
}

/**
 * Formats a UTC date or ISO string into a local datetime string suitable for
 * <input type="datetime-local" />: "YYYY-MM-DDTHH:mm".
 */
export function isoToLocalDatetimeString(isoString: string, timezone: string): string {
  if (!isoString) return ""
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return ""

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    const parts = formatter.formatToParts(date)
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || ""
    const year = getPart("year")
    const month = getPart("month")
    const day = getPart("day")
    let hour = getPart("hour")
    if (hour === "24") hour = "00"
    const minute = getPart("minute")
    return `${year}-${month}-${day}T${hour}:${minute}`
  } catch {
    return isoString.slice(0, 16)
  }
}

/**
 * Converts a "YYYY-MM-DDTHH:mm" user input in the specified timezone to UTC ISO string.
 */
export function localDatetimeStringToUtcIso(localString: string, timezone: string): string {
  if (!localString) return ""
  const [datePart, timePart = "00:00"] = localString.split("T")
  if (!datePart) return ""

  const [year, month, day] = datePart.split("-").map(Number)
  const [hour = 0, minute = 0] = timePart.split(":").map(Number)

  if (isNaN(year) || isNaN(month) || isNaN(day)) return ""

  try {
    // 1. Candidate UTC
    const candidateUtc = new Date(Date.UTC(year, month - 1, day, hour, minute))

    // 2. Candidate represented in target timezone
    const localInTz = isoToLocalDatetimeString(candidateUtc.toISOString(), timezone)
    const [candDate, candTime = "00:00"] = localInTz.split("T")
    const [candY, candM, candD] = candDate.split("-").map(Number)
    const [candH, candMin] = candTime.split(":").map(Number)

    const diffMinutes =
      Date.UTC(candY, candM - 1, candD, candH, candMin) -
      Date.UTC(year, month - 1, day, hour, minute)

    const actualUtcMs = candidateUtc.getTime() - diffMinutes
    return new Date(actualUtcMs).toISOString()
  } catch {
    return new Date(`${localString}:00Z`).toISOString()
  }
}
