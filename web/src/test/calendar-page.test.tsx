import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { CalendarPage } from "@/pages/calendar-page"
import * as calendarService from "@/lib/calendar/service"

vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: { id: "test-user-uuid", email: "tester@example.com" },
  }),
}))

const mockEvents: calendarService.CalendarEventRecord[] = [
  {
    itemId: "event-1",
    title: "Sprint Planning",
    content: "Plan Phase 3 deliverables",
    startAt: "2026-10-15T10:00:00.000Z",
    endAt: "2026-10-15T11:00:00.000Z",
    allDay: false,
    status: "active",
    createdAt: "2026-10-10T10:00:00.000Z",
    updatedAt: "2026-10-10T10:00:00.000Z",
  },
  {
    itemId: "event-2",
    title: "Architecture Review",
    content: "Review PostgreSQL schema cache and RPC guarantees",
    startAt: "2026-10-20T14:00:00.000Z",
    endAt: "2026-10-20T15:30:00.000Z",
    allDay: false,
    status: "active",
    createdAt: "2026-10-10T10:00:00.000Z",
    updatedAt: "2026-10-10T10:00:00.000Z",
  },
]

describe("CalendarPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(calendarService, "fetchCalendarEvents").mockResolvedValue(mockEvents)
    vi.spyOn(calendarService, "createCalendarEvent").mockImplementation(async (params) => ({
      itemId: "event-new",
      title: params.title,
      content: params.content || null,
      startAt: params.startAt,
      endAt: params.endAt || null,
      allDay: params.allDay || false,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true })
  })

  it("renders calendar with month title, navigation buttons, and today action", async () => {
    render(<CalendarPage />)

    await waitFor(() => {
      expect(screen.getByText("Calendar")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument()
      expect(screen.getByLabelText("Previous month")).toBeInTheDocument()
      expect(screen.getByLabelText("Next month")).toBeInTheDocument()
    })
  })

  it("navigates months when clicking next and previous", async () => {
    render(<CalendarPage />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument()
    })

    const nextBtn = screen.getByLabelText("Next month")
    fireEvent.click(nextBtn)

    const prevBtn = screen.getByLabelText("Previous month")
    fireEvent.click(prevBtn)
  })

  it("displays events in the calendar grid and day list", async () => {
    render(<CalendarPage />)

    await waitFor(() => {
      expect(screen.getAllByText("Sprint Planning").length).toBeGreaterThan(0)
    })
  })

  it("prevents saving event with invalid end date earlier than start date", async () => {
    render(<CalendarPage />)

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Create Event/i })[0]).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole("button", { name: /Create Event/i })[0])

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Planning session/i)).toBeInTheDocument()
    })

    const titleInput = screen.getByPlaceholderText(/Planning session/i)
    fireEvent.change(titleInput, { target: { value: "Invalid Event" } })

    // Set end earlier than start
    const startDateInput = screen.getByLabelText(/Start Date/i)
    const startTimeInput = screen.getByLabelText(/Start Time/i)
    const endDateInput = screen.getByLabelText(/End Date/i)
    const endTimeInput = screen.getByLabelText(/End Time/i)
    fireEvent.change(startDateInput, { target: { value: "2026-10-15" } })
    fireEvent.change(startTimeInput, { target: { value: "14:00" } })
    fireEvent.change(endDateInput, { target: { value: "2026-10-15" } })
    fireEvent.change(endTimeInput, { target: { value: "13:00" } })

    const saveBtn = screen.getByRole("button", { name: /Save Event/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(
        screen.getByText(/End date and time cannot be earlier than start date and time/i)
      ).toBeInTheDocument()
    })
    expect(calendarService.createCalendarEvent).not.toHaveBeenCalled()
  })

  it("shows offline banner and disables event creation when offline", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true })

    render(<CalendarPage />)

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument()
      expect(screen.getByText(/Offline Mode — Viewing cached calendar events/i)).toBeInTheDocument()
    })

    const createBtn = screen.getAllByRole("button", { name: /Create Event/i })[0]
    expect(createBtn).toBeDisabled()
  })

  it("creates event with title and description and adds it to calendar view", async () => {
    render(<CalendarPage />)

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Create Event/i })[0]).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole("button", { name: /Create Event/i })[0])

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Planning session/i)).toBeInTheDocument()
    })

    const titleInput = screen.getByPlaceholderText(/Planning session/i)
    fireEvent.change(titleInput, { target: { value: "Sprint Retro" } })

    const descInput = screen.getByPlaceholderText(/Optional details or agenda/i)
    fireEvent.change(descInput, { target: { value: "Discuss sprint velocity" } })

    const saveBtn = screen.getByRole("button", { name: /Save Event/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(calendarService.createCalendarEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "test-user-uuid",
          title: "Sprint Retro",
          content: "Discuss sprint velocity",
          itemId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
        })
      )
    })
  })

  it("keeps modal open with preserved inputs on failure and reuses stable itemId on retry", async () => {
    let callCount = 0
    let firstItemId = ""

    vi.spyOn(calendarService, "createCalendarEvent").mockImplementation(async (params) => {
      callCount++
      if (callCount === 1) {
        firstItemId = params.itemId!
        throw new Error("Network blip: null value in column violates constraint")
      }
      return {
        itemId: params.itemId!,
        title: params.title,
        content: params.content || null,
        startAt: params.startAt,
        endAt: params.endAt || null,
        allDay: params.allDay || false,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    })

    render(<CalendarPage />)

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Create Event/i })[0]).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole("button", { name: /Create Event/i })[0])

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Planning session/i)).toBeInTheDocument()
    })

    const titleInput = screen.getByPlaceholderText(/Planning session/i)
    fireEvent.change(titleInput, { target: { value: "Quarterly Review" } })

    const descInput = screen.getByPlaceholderText(/Optional details or agenda/i)
    fireEvent.change(descInput, { target: { value: "Review metrics" } })

    const saveBtn = screen.getByRole("button", { name: /Save Event/i })
    fireEvent.click(saveBtn)

    // Should display error and preserve modal open with user inputs
    await waitFor(() => {
      expect(screen.getByText(/Network blip/i)).toBeInTheDocument()
      expect(titleInput).toHaveValue("Quarterly Review")
      expect(descInput).toHaveValue("Review metrics")
    })

    // Retry save
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(callCount).toBe(2)
    })

    // Verify retry sent the exact same stable itemId
    expect(calendarService.createCalendarEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: "Quarterly Review",
        itemId: firstItemId,
      })
    )
  })
})
