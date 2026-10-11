import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { DateTimeSelector } from "@/components/ui/date-time-picker"

describe("DateTimeSelector Component", () => {
  it("renders separate Date input and downwards Time input", () => {
    render(
      <DateTimeSelector
        dateLabel="Start Date"
        timeLabel="Start Time"
        dateId="start-date"
        timeId="start-time"
        value="2026-10-15T09:30"
        onChange={vi.fn()}
      />
    )

    const dateInput = screen.getByLabelText(/Start Date/i) as HTMLInputElement
    const timeInput = screen.getByLabelText(/Start Time/i) as HTMLInputElement

    expect(dateInput).toBeInTheDocument()
    expect(dateInput.type).toBe("date")
    expect(dateInput.value).toBe("2026-10-15")

    expect(timeInput).toBeInTheDocument()
    expect(timeInput.type).toBe("time")
    expect(timeInput.value).toBe("09:30")
  })

  it("updates date while preserving existing time", () => {
    const handleChange = vi.fn()
    render(
      <DateTimeSelector
        dateLabel="Due Date"
        timeLabel="Due Time"
        value="2026-10-15T14:00"
        onChange={handleChange}
      />
    )

    const dateInput = screen.getByLabelText(/Due Date/i)
    fireEvent.change(dateInput, { target: { value: "2026-10-20" } })

    expect(handleChange).toHaveBeenCalledWith("2026-10-20T14:00")
  })

  it("updates time while preserving existing date", () => {
    const handleChange = vi.fn()
    render(
      <DateTimeSelector
        dateLabel="Due Date"
        timeLabel="Due Time"
        value="2026-10-15T14:00"
        onChange={handleChange}
      />
    )

    const timeInput = screen.getByLabelText(/Due Time/i)
    fireEvent.change(timeInput, { target: { value: "18:45" } })

    expect(handleChange).toHaveBeenCalledWith("2026-10-15T18:45")
  })

  it("hides time input when hideTime is true (for all-day events)", () => {
    render(
      <DateTimeSelector
        dateLabel="Start Date"
        timeLabel="Start Time"
        value="2026-10-15T00:00"
        onChange={vi.fn()}
        hideTime={true}
      />
    )

    expect(screen.getByLabelText(/Start Date/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Start Time/i)).not.toBeInTheDocument()
  })

  it("handles clearing the date input", () => {
    const handleChange = vi.fn()
    render(
      <DateTimeSelector
        dateLabel="Start Date"
        timeLabel="Start Time"
        value="2026-10-15T09:00"
        onChange={handleChange}
      />
    )

    const dateInput = screen.getByLabelText(/Start Date/i)
    fireEvent.change(dateInput, { target: { value: "" } })

    expect(handleChange).toHaveBeenCalledWith("")
  })
})
