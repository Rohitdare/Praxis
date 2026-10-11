import { describe, it, expect } from "vitest"
import {
  getMondayOfWeek,
  getSundayOfWeek,
  getWeekDates,
  calculateWeeklyStats,
  formatLocalDateString,
  isSameDay,
} from "@/lib/planner/stats"
import type { PlannerTask } from "@/lib/planner/types"

describe("Planner Stats & Pure Calculations", () => {
  describe("getMondayOfWeek and getSundayOfWeek", () => {
    it("returns Monday as the start of the week for a Wednesday", () => {
      // Local date: 2026-10-14 is Wednesday
      const wednesday = new Date(2026, 9, 14, 15, 30, 0)
      const monday = getMondayOfWeek(wednesday)
      expect(monday.getDay()).toBe(1) // Monday is 1
      expect(formatLocalDateString(monday)).toBe("2026-10-12")
    })

    it("returns Monday as the start of the week when the input is a Sunday", () => {
      // Local date: 2026-10-18 is Sunday
      const sunday = new Date(2026, 9, 18, 10, 0, 0)
      const monday = getMondayOfWeek(sunday)
      expect(monday.getDay()).toBe(1)
      expect(formatLocalDateString(monday)).toBe("2026-10-12")
    })

    it("returns Monday as the start of the week when the input is already Monday", () => {
      // Local date: 2026-10-12 is Monday
      const mondayInput = new Date(2026, 9, 12, 8, 0, 0)
      const monday = getMondayOfWeek(mondayInput)
      expect(monday.getDay()).toBe(1)
      expect(formatLocalDateString(monday)).toBe("2026-10-12")
    })

    it("returns Sunday 23:59:59.999 as the end of the week", () => {
      const wednesday = new Date(2026, 9, 14, 15, 30, 0)
      const sunday = getSundayOfWeek(wednesday)
      expect(sunday.getDay()).toBe(0) // Sunday is 0
      expect(formatLocalDateString(sunday)).toBe("2026-10-18")
      expect(sunday.getHours()).toBe(23)
      expect(sunday.getMinutes()).toBe(59)
      expect(sunday.getSeconds()).toBe(59)
    })
  })

  describe("getWeekDates", () => {
    it("returns an array of 7 consecutive dates starting on Monday", () => {
      const wednesday = new Date(2026, 9, 14, 12, 0, 0)
      const dates = getWeekDates(wednesday)
      expect(dates).toHaveLength(7)
      expect(dates[0].getDay()).toBe(1) // Mon
      expect(dates[1].getDay()).toBe(2) // Tue
      expect(dates[2].getDay()).toBe(3) // Wed
      expect(dates[3].getDay()).toBe(4) // Thu
      expect(dates[4].getDay()).toBe(5) // Fri
      expect(dates[5].getDay()).toBe(6) // Sat
      expect(dates[6].getDay()).toBe(0) // Sun
    })
  })

  describe("formatLocalDateString and isSameDay", () => {
    it("formats dates as YYYY-MM-DD", () => {
      const d = new Date(2026, 9, 12, 14, 0, 0)
      expect(formatLocalDateString(d)).toBe("2026-10-12")
    })

    it("checks isSameDay accurately", () => {
      const targetDay = "2026-10-12"
      const d1 = new Date(2026, 9, 12, 10, 0, 0).toISOString()
      const d2 = new Date(2026, 9, 13, 10, 0, 0).toISOString()
      expect(isSameDay(d1, targetDay)).toBe(true)
      expect(isSameDay(d2, targetDay)).toBe(false)
      expect(isSameDay(null, targetDay)).toBe(false)
    })
  })

  describe("calculateWeeklyStats", () => {
    const monday = new Date(2026, 9, 12, 0, 0, 0)
    const tuesday = new Date(2026, 9, 13, 10, 0, 0)

    const makeTask = (id: string, overrides: Partial<PlannerTask> = {}): PlannerTask => ({
      id,
      userId: "u1",
      title: `Task ${id}`,
      content: null,
      status: "active",
      priority: "normal",
      dueAt: tuesday.toISOString(),
      completedAt: null,
      createdAt: monday.toISOString(),
      updatedAt: monday.toISOString(),
      isOverdue: false,
      ...overrides,
    })

    it("handles zero tasks cleanly without NaN or division by zero", () => {
      const stats = calculateWeeklyStats([], [], monday)
      expect(stats.tasksPlanned).toBe(0)
      expect(stats.tasksCompleted).toBe(0)
      expect(stats.completionRate).toBe(0)
      expect(stats.outstandingTasks).toBe(0)
      expect(stats.overdueTasks).toBe(0)
      expect(stats.dailyActivity).toHaveLength(7)
      stats.dailyActivity.forEach((day) => {
        expect(day.plannedCount).toBe(0)
        expect(day.completedCount).toBe(0)
      })
    })

    it("calculates completion rate and daily distribution accurately", () => {
      const t1 = makeTask("1", {
        dueAt: new Date(2026, 9, 12, 12, 0).toISOString(),
        status: "done",
        completedAt: new Date(2026, 9, 12, 14, 0).toISOString(),
      })
      const t2 = makeTask("2", {
        dueAt: new Date(2026, 9, 13, 12, 0).toISOString(),
        status: "done",
        completedAt: new Date(2026, 9, 13, 15, 0).toISOString(),
      })
      const t3 = makeTask("3", {
        dueAt: new Date(2026, 9, 14, 12, 0).toISOString(),
        status: "active",
        completedAt: null,
      })
      const t4 = makeTask("4", {
        dueAt: new Date(2026, 9, 15, 12, 0).toISOString(),
        status: "active",
        completedAt: null,
      })

      const planned = [t1, t2, t3, t4]
      const completed = [t1, t2]

      const stats = calculateWeeklyStats(planned, completed, monday)
      expect(stats.tasksPlanned).toBe(4)
      expect(stats.tasksCompleted).toBe(2)
      expect(stats.completionRate).toBe(50)
      expect(stats.outstandingTasks).toBe(2)

      // Monday (day 0) should have 1 planned, 1 completed
      expect(stats.dailyActivity[0].plannedCount).toBe(1)
      expect(stats.dailyActivity[0].completedCount).toBe(1)
      // Tuesday (day 1) should have 1 planned, 1 completed
      expect(stats.dailyActivity[1].plannedCount).toBe(1)
      expect(stats.dailyActivity[1].completedCount).toBe(1)
      // Wednesday (day 2) should have 1 planned, 0 completed
      expect(stats.dailyActivity[2].plannedCount).toBe(1)
      expect(stats.dailyActivity[2].completedCount).toBe(0)
    })

    it("caps completion rate at 100% when completed count exceeds planned count", () => {
      const t1 = makeTask("1", {
        dueAt: null,
        status: "done",
        completedAt: new Date(2026, 9, 12, 14, 0).toISOString(),
      })
      const t2 = makeTask("2", {
        dueAt: null,
        status: "done",
        completedAt: new Date(2026, 9, 13, 14, 0).toISOString(),
      })

      const stats = calculateWeeklyStats([], [t1, t2], monday)
      expect(stats.tasksPlanned).toBe(0)
      expect(stats.tasksCompleted).toBe(2)
      expect(stats.completionRate).toBe(100)
    })
  })
})
