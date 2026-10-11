import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { BrowserRouter } from "react-router-dom"
import { PlannerPage } from "@/pages/planner-page"
import * as plannerService from "@/lib/planner/service"
import type { DailyPlannerData, PlannerTask, WeeklyStats } from "@/lib/planner/types"

vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: { id: "test-user-planner", email: "planner-test@example.com" },
  }),
}))

const mockTodayTasks: PlannerTask[] = [
  {
    id: "task-1",
    userId: "test-user-planner",
    title: "Finish quarterly report",
    content: null,
    status: "active",
    priority: "high",
    dueAt: "2026-10-12T14:00:00Z",
    completedAt: null,
    createdAt: "2026-10-12T09:00:00Z",
    updatedAt: "2026-10-12T09:00:00Z",
    isOverdue: false,
  },
  {
    id: "task-2",
    userId: "test-user-planner",
    title: "Review pull requests",
    content: null,
    status: "done",
    priority: "normal",
    dueAt: "2026-10-12T11:00:00Z",
    completedAt: "2026-10-12T11:30:00Z",
    createdAt: "2026-10-12T09:00:00Z",
    updatedAt: "2026-10-12T11:30:00Z",
    isOverdue: false,
  },
]

const mockOverdueTasks: PlannerTask[] = [
  {
    id: "task-overdue-1",
    userId: "test-user-planner",
    title: "Pay server bill",
    content: null,
    status: "active",
    priority: "high",
    dueAt: "2026-10-10T12:00:00Z",
    completedAt: null,
    createdAt: "2026-10-10T09:00:00Z",
    updatedAt: "2026-10-10T09:00:00Z",
    isOverdue: true,
  },
]

const mockDailyData: DailyPlannerData = {
  date: "2026-10-12",
  tasks: mockTodayTasks,
  overdueTasks: mockOverdueTasks,
  completedTodayCount: 1,
  plannedTodayCount: 2,
}

const mockWeeklyStats: WeeklyStats = {
  weekStart: "2026-10-12",
  weekEnd: "2026-10-18",
  tasksPlanned: 5,
  tasksCompleted: 4,
  completionRate: 80,
  outstandingTasks: 1,
  overdueTasks: 1,
  dailyActivity: [
    { day: "Mon", date: "2026-10-12", completedCount: 1, plannedCount: 2, outstandingCount: 1 },
    { day: "Tue", date: "2026-10-13", completedCount: 1, plannedCount: 1, outstandingCount: 0 },
    { day: "Wed", date: "2026-10-14", completedCount: 1, plannedCount: 1, outstandingCount: 0 },
    { day: "Thu", date: "2026-10-15", completedCount: 1, plannedCount: 1, outstandingCount: 0 },
    { day: "Fri", date: "2026-10-16", completedCount: 0, plannedCount: 0, outstandingCount: 0 },
    { day: "Sat", date: "2026-10-17", completedCount: 0, plannedCount: 0, outstandingCount: 0 },
    { day: "Sun", date: "2026-10-18", completedCount: 0, plannedCount: 0, outstandingCount: 0 },
  ],
}

describe("PlannerPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(plannerService, "fetchDailyPlannerData").mockResolvedValue(mockDailyData)
    vi.spyOn(plannerService, "fetchWeeklyProductivityStats").mockResolvedValue(mockWeeklyStats)
    vi.spyOn(plannerService, "toggleTaskCompletion").mockResolvedValue({
      status: "done",
      completedAt: new Date().toISOString(),
    })
    vi.spyOn(plannerService, "carryTaskForward").mockResolvedValue(undefined)
    vi.spyOn(plannerService, "createPlannerTask").mockImplementation(async (params) => ({
      id: "task-new-1",
      userId: params.userId,
      title: params.title,
      content: null,
      status: "active",
      priority: params.priority || "normal",
      dueAt: params.dueAt ?? null,
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isOverdue: false,
    }))
  })

  it("renders planner header, tasks list, and overdue banner", async () => {
    render(
      <BrowserRouter>
        <PlannerPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText("Finish quarterly report")).toBeInTheDocument()
      expect(screen.getByText("Review pull requests")).toBeInTheDocument()
    })

    // Rollover banner should display overdue count
    expect(screen.getByText(/unfinished task/i)).toBeInTheDocument()
    expect(screen.getByText("Pay server bill")).toBeInTheDocument()
  })

  it("adds a new task through the quick-add input", async () => {
    render(
      <BrowserRouter>
        <PlannerPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText("Finish quarterly report")).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText("Add a task for today...")
    fireEvent.change(input, { target: { value: "Deploy to staging" } })
    const addBtn = screen.getByRole("button", { name: "Add task" })
    fireEvent.click(addBtn)

    await waitFor(() => {
      expect(plannerService.createPlannerTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Deploy to staging",
        })
      )
    })
  })

  it("toggles task completion when clicking the checkbox", async () => {
    render(
      <BrowserRouter>
        <PlannerPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText("Finish quarterly report")).toBeInTheDocument()
    })

    const markDoneBtn = screen.getByRole("checkbox", { name: /Finish quarterly report/i })
    fireEvent.click(markDoneBtn)

    await waitFor(() => {
      expect(plannerService.toggleTaskCompletion).toHaveBeenCalledWith(
        "task-1",
        "test-user-planner",
        true
      )
    })
  })

  it("carries forward an overdue task to today", async () => {
    render(
      <BrowserRouter>
        <PlannerPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText("Pay server bill")).toBeInTheDocument()
    })

    const carryBtn = screen.getByRole("button", { name: /Carry forward.*Pay server bill/i })
    fireEvent.click(carryBtn)

    await waitFor(() => {
      expect(plannerService.carryTaskForward).toHaveBeenCalledWith(
        "task-overdue-1",
        "test-user-planner",
        expect.anything()
      )
    })
  })

  it("switches to Weekly view and displays weekly statistics and chart", async () => {
    render(
      <BrowserRouter>
        <PlannerPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText("Finish quarterly report")).toBeInTheDocument()
    })

    // Click Weekly view tab
    const weeklyTab = screen.getByRole("tab", { name: /Weekly Stats/i })
    fireEvent.click(weeklyTab)

    await waitFor(() => {
      expect(screen.getByText("80%")).toBeInTheDocument()
      expect(screen.getByText("Completion Rate")).toBeInTheDocument()
      expect(screen.getAllByText("Planned").length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText("Completed").length).toBeGreaterThanOrEqual(1)
    })
  })
})
