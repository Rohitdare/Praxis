import { beforeEach, describe, expect, it, vi } from "vitest"
import { PersonalMemoryDB } from "@/lib/db/index"
import {
  fetchDailyPlannerData,
  createPlannerTask,
  toggleTaskCompletion,
  carryTaskForward,
  fetchWeeklyProductivityStats,
} from "@/lib/planner/service"

describe("Planner Service Tests", () => {
  let testDb: PersonalMemoryDB
  let mockSupabase: any
  const testUserId = "user-test-planner-999"

  beforeEach(async () => {
    vi.clearAllMocks()
    const dbName = `test_planner_${crypto.randomUUID()}`
    testDb = new PersonalMemoryDB(dbName)
    await testDb.open()

    // Default mock Supabase client
    mockSupabase = {
      from: vi.fn(),
      rpc: vi.fn(),
    }
  })

  describe("fetchDailyPlannerData", () => {
    it("partitions tasks into todayTasks and overdueTasks accurately", async () => {
      const targetDate = new Date("2026-10-12T12:00:00Z")
      const mockRows = [
        {
          item_id: "task-today-1",
          due_at: "2026-10-12T14:00:00Z",
          priority: "high",
          completed_at: null,
          created_at: "2026-10-12T08:00:00Z",
          updated_at: "2026-10-12T08:00:00Z",
          items: {
            title: "Plan sprint review",
            content: "Draft agenda",
            status: "active",
            deleted_at: null,
          },
        },
        {
          item_id: "task-today-done",
          due_at: "2026-10-12T10:00:00Z",
          priority: "normal",
          completed_at: "2026-10-12T11:00:00Z",
          created_at: "2026-10-12T08:00:00Z",
          updated_at: "2026-10-12T11:00:00Z",
          items: {
            title: "Morning check-in",
            content: null,
            status: "done",
            deleted_at: null,
          },
        },
        {
          item_id: "task-overdue-1",
          due_at: "2026-10-10T12:00:00Z", // overdue
          priority: "normal",
          completed_at: null,
          created_at: "2026-10-10T08:00:00Z",
          updated_at: "2026-10-10T08:00:00Z",
          items: {
            title: "Submit invoice",
            content: null,
            status: "active",
            deleted_at: null,
          },
        },
      ]

      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockRows, error: null }),
      }
      mockSupabase.from.mockReturnValue(mockQueryBuilder)

      const result = await fetchDailyPlannerData(testUserId, targetDate, {
        supabaseClient: mockSupabase,
        database: testDb,
        now: targetDate,
      })

      expect(result.date).toBe("2026-10-12")
      expect(result.tasks).toHaveLength(2)
      expect(result.overdueTasks).toHaveLength(1)

      expect(result.tasks[0].title).toBe("Plan sprint review")
      expect(result.tasks[0].priority).toBe("high")
      expect(result.tasks[1].status).toBe("done")

      expect(result.overdueTasks[0].id).toBe("task-overdue-1")
      expect(result.overdueTasks[0].isOverdue).toBe(true)
    })
  })

  describe("createPlannerTask", () => {
    it("creates task with captureItem provenance and sets task metadata", async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null })
      mockSupabase.from.mockReturnValue({
        upsert: mockUpsert,
      })
      mockSupabase.rpc.mockResolvedValue({ error: null })

      const dueAt = "2026-10-12T17:00:00Z"
      const newTask = await createPlannerTask(
        {
          userId: testUserId,
          title: "Write integration tests",
          priority: "high",
          dueAt,
        },
        {
          supabaseClient: mockSupabase,
          database: testDb,
        }
      )

      expect(newTask.title).toBe("Write integration tests")
      expect(newTask.priority).toBe("high")
      expect(newTask.dueAt).toBe(dueAt)
      expect(newTask.status).toBe("active")

      // Check that local Dexie item was stored
      const localItem = await testDb.local_items.get(newTask.id)
      expect(localItem).toBeDefined()
      expect(localItem?.title).toBe("Write integration tests")
    })
  })

  describe("toggleTaskCompletion", () => {
    it("marks task as completed with timestamp when currently active", async () => {
      const mockTaskUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })
      const mockItemUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "tasks") return { update: mockTaskUpdate }
        if (table === "items") return { update: mockItemUpdate }
        return {}
      })

      const refDate = new Date("2026-10-12T16:00:00Z")
      await toggleTaskCompletion("task-123", testUserId, true, {
        supabaseClient: mockSupabase,
        database: testDb,
        now: refDate,
      })

      expect(mockTaskUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          completed_at: refDate.toISOString(),
        })
      )
      expect(mockItemUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "done",
        })
      )
    })

    it("un-marks task as active and clears completed_at when currently completed", async () => {
      const mockTaskUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })
      const mockItemUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "tasks") return { update: mockTaskUpdate }
        if (table === "items") return { update: mockItemUpdate }
        return {}
      })

      await toggleTaskCompletion("task-123", testUserId, false, {
        supabaseClient: mockSupabase,
        database: testDb,
      })

      expect(mockTaskUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          completed_at: null,
        })
      )
      expect(mockItemUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "active",
        })
      )
    })
  })

  describe("carryTaskForward", () => {
    it("updates due_at to new target date", async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })

      mockSupabase.from.mockReturnValue({ update: mockUpdate })

      const newTarget = new Date("2026-10-13T12:00:00Z")
      await carryTaskForward("task-123", testUserId, newTarget, {
        supabaseClient: mockSupabase,
        database: testDb,
      })

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          due_at: newTarget.toISOString(),
        })
      )
    })
  })

  describe("fetchWeeklyProductivityStats", () => {
    it("aggregates weekly stats across planned and completed dates", async () => {
      const refDate = new Date("2026-10-14T12:00:00Z") // Wed
      const mockRows = [
        {
          item_id: "t-1",
          due_at: "2026-10-12T10:00:00Z", // Mon
          priority: "normal",
          completed_at: "2026-10-12T12:00:00Z",
          created_at: "2026-10-12T08:00:00Z",
          updated_at: "2026-10-12T12:00:00Z",
          items: { title: "T1", content: null, status: "done", deleted_at: null },
        },
        {
          item_id: "t-2",
          due_at: "2026-10-13T10:00:00Z", // Tue
          priority: "high",
          completed_at: null,
          created_at: "2026-10-12T08:00:00Z",
          updated_at: "2026-10-12T08:00:00Z",
          items: { title: "T2", content: null, status: "active", deleted_at: null },
        },
      ]

      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: mockRows, error: null }),
        order: vi.fn().mockResolvedValue({ data: mockRows, error: null }),
      }
      mockSupabase.from.mockReturnValue(mockQueryBuilder)

      const stats = await fetchWeeklyProductivityStats(testUserId, refDate, {
        supabaseClient: mockSupabase,
        database: testDb,
        now: refDate,
      })

      expect(stats.tasksPlanned).toBe(2)
      expect(stats.tasksCompleted).toBe(2)
      expect(stats.completionRate).toBe(50)
      expect(stats.outstandingTasks).toBe(1)
      expect(stats.dailyActivity).toHaveLength(7)
    })
  })
})
