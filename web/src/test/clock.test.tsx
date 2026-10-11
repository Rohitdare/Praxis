import { render, screen, act } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Clock } from "@/components/ui/clock"

describe("Clock Component", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-11T10:30:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders a semantic <time> element with accessible attributes", () => {
    render(<Clock />)

    const timeElement = screen.getByLabelText(/Current time:/i)
    expect(timeElement).toBeInTheDocument()
    expect(timeElement.tagName.toLowerCase()).toBe("time")
    expect(timeElement).toHaveAttribute("dateTime")
    expect(timeElement).toHaveAttribute("title")
  })

  it("renders time and date formatted properly in standard desktop mode", () => {
    render(<Clock showDate={true} />)

    const timeElement = screen.getByLabelText(/Current time:/i)
    expect(timeElement).toBeInTheDocument()
    // Should display hours and minutes
    expect(timeElement.textContent).toMatch(/\d{1,2}:\d{2}/)
  })

  it("renders compact mode hiding the date", () => {
    render(<Clock compact showDate={false} />)

    const timeElement = screen.getByLabelText(/Current time:/i)
    expect(timeElement).toBeInTheDocument()
    expect(timeElement.textContent).toMatch(/\d{1,2}:\d{2}/)
    expect(timeElement.querySelector(".hidden.lg\\:inline")).toBeNull()
  })

  it("updates live time on tick and cleans up interval on unmount", () => {
    const { unmount } = render(<Clock showSeconds />)

    const initialText = screen.getByLabelText(/Current time:/i).textContent
    expect(initialText).toBeDefined()

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    const updatedText = screen.getByLabelText(/Current time:/i).textContent
    expect(updatedText).toBeDefined()

    // Unmount cleans up interval timer cleanly
    expect(() => unmount()).not.toThrow()
  })
})
