import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { PlannerPage } from "@/pages/planner-page"
import { FeatureProvider } from "@/lib/features/feature-context"
import { setCachedPreferences } from "@/lib/features/preferences"
import * as AuthContextModule from "@/lib/auth/auth-context"
import * as plannerService from "@/lib/planner/service"
import { db } from "@/lib/db/index"

describe("Phase 5: Planner Optional Modules Integration", () => {
  const testUserId = "planner-modules-test-user-123"

  const mockDailyData = {
    date: "2026-10-22",
    tasks: [],
    overdueTasks: [],
    completedTodayCount: 0,
    plannedTodayCount: 0,
  }

  const mockWeeklyStats = {
    weeklyTotals: 0,
    completionRate: 0,
    days: [],
    streak: 0,
  }

  beforeEach(async () => {
    window.localStorage.clear()
    await db.local_items.clear()
    await db.outbox.clear()
    vi.restoreAllMocks()

    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: { id: testUserId, email: "planner-test@example.com" } as any,
      session: null,
      isLoading: false,
      isRecoveryMode: false,
      signInWithGoogle: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updatePassword: vi.fn(),
      signOut: vi.fn(),
    })

    vi.spyOn(plannerService, "fetchDailyPlannerData").mockResolvedValue(mockDailyData as any)
    vi.spyOn(plannerService, "fetchWeeklyProductivityStats").mockResolvedValue(mockWeeklyStats as any)
  })

  it("1. when both modules are disabled, preserves standard Planner UI and hides module tabs", async () => {
    setCachedPreferences(testUserId, {
      workout_planner: false,
      diet_planner: false,
      expense_tracker: false,
    })

    render(
      <MemoryRouter initialEntries={["/planner"]}>
        <FeatureProvider>
          <Routes>
            <Route path="/planner" element={<PlannerPage />} />
          </Routes>
        </FeatureProvider>
      </MemoryRouter>
    )

    // Standard tabs should be present
    expect(screen.getByRole("tab", { name: "Daily Planner view" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Weekly Stats view" })).toBeInTheDocument()

    // Optional module tabs must NOT be present
    expect(screen.queryByRole("tab", { name: "Workout Planner view" })).not.toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Diet Planner view" })).not.toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Expense Tracker view" })).not.toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Wishlist view" })).not.toBeInTheDocument()

    // No empty module cards or placeholders
    expect(screen.queryByTestId("workout-planner-view")).not.toBeInTheDocument()
    expect(screen.queryByTestId("diet-planner-view")).not.toBeInTheDocument()
    expect(screen.queryByTestId("wishlist-view")).not.toBeInTheDocument()
  })

  it("2. when Workout Planner is enabled, displays its tab and renders the workout interface", async () => {
    const user = userEvent.setup()
    setCachedPreferences(testUserId, {
      workout_planner: true,
      diet_planner: false,
    })

    render(
      <MemoryRouter initialEntries={["/planner"]}>
        <FeatureProvider>
          <Routes>
            <Route path="/planner" element={<PlannerPage />} />
            <Route path="/planner/:submodule" element={<PlannerPage />} />
          </Routes>
        </FeatureProvider>
      </MemoryRouter>
    )

    const workoutTab = await screen.findByRole("tab", { name: "Workout Planner view" })
    expect(workoutTab).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Diet Planner view" })).not.toBeInTheDocument()

    // Click Workout Planner tab
    await user.click(workoutTab)

    // Workout Planner view appears and header shows clean back button
    expect(await screen.findByTestId("workout-planner-view")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 2, name: "Workout Planner" })).toBeInTheDocument()
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Back to Planner" })).toBeInTheDocument()

    // Add a routine
    const routineInput = screen.getByLabelText("Workout routine title")
    const exercisesInput = screen.getByLabelText("Workout exercises list")
    const addBtn = screen.getByRole("button", { name: "Add Workout" })

    await user.type(routineInput, "Upper Body Strength")
    await user.type(exercisesInput, "Bench Press 3x10\nPull-ups 3x8")
    await user.click(addBtn)

    expect(await screen.findByText("Upper Body Strength")).toBeInTheDocument()
    expect(screen.getByText("Bench Press 3x10")).toBeInTheDocument()
    expect(screen.getByText("Pull-ups 3x8")).toBeInTheDocument()

    // Stored in local items
    const items = await db.local_items.toArray()
    const workoutItem = items.find((i) => i.title === "Upper Body Strength")
    expect(workoutItem).toBeDefined()
    expect(workoutItem?.ai_tags).toContain("Workout")
  })

  it("3. when Diet Planner is enabled, displays its tab and renders the meal planner interface", async () => {
    const user = userEvent.setup()
    setCachedPreferences(testUserId, {
      workout_planner: false,
      diet_planner: true,
    })

    render(
      <MemoryRouter initialEntries={["/planner"]}>
        <FeatureProvider>
          <Routes>
            <Route path="/planner" element={<PlannerPage />} />
            <Route path="/planner/:submodule" element={<PlannerPage />} />
          </Routes>
        </FeatureProvider>
      </MemoryRouter>
    )

    const dietTab = await screen.findByRole("tab", { name: "Diet Planner view" })
    expect(dietTab).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Workout Planner view" })).not.toBeInTheDocument()

    // Click Diet Planner tab
    await user.click(dietTab)

    expect(await screen.findByTestId("diet-planner-view")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 2, name: "Diet Planner" })).toBeInTheDocument()
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Back to Planner" })).toBeInTheDocument()

    // Add a planned meal
    const mealInput = screen.getByLabelText("Meal item name")
    const notesInput = screen.getByLabelText("Meal notes")
    const addMealBtn = screen.getByRole("button", { name: "Add Meal" })

    await user.type(mealInput, "Oatmeal with Blueberries")
    await user.type(notesInput, "450 kcal, 20g protein")
    await user.click(addMealBtn)

    expect(await screen.findByText("Oatmeal with Blueberries")).toBeInTheDocument()
    expect(screen.getByText("450 kcal, 20g protein")).toBeInTheDocument()

    // Stored in local items
    const items = await db.local_items.toArray()
    const mealItem = items.find((i) => i.title === "Oatmeal with Blueberries")
    expect(mealItem).toBeDefined()
    expect(mealItem?.ai_tags).toContain("Diet")
  })

  it("4. when both modules are enabled, shows both tabs independently", async () => {
    setCachedPreferences(testUserId, {
      workout_planner: true,
      diet_planner: true,
    })

    render(
      <MemoryRouter initialEntries={["/planner"]}>
        <FeatureProvider>
          <Routes>
            <Route path="/planner" element={<PlannerPage />} />
          </Routes>
        </FeatureProvider>
      </MemoryRouter>
    )

    expect(await screen.findByRole("tab", { name: "Workout Planner view" })).toBeInTheDocument()
    expect(await screen.findByRole("tab", { name: "Diet Planner view" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Daily Planner view" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Weekly Stats view" })).toBeInTheDocument()
  })

  it("5. direct navigation to a disabled module route gracefully falls back to daily view", async () => {
    setCachedPreferences(testUserId, {
      workout_planner: false,
      diet_planner: false,
    })

    render(
      <MemoryRouter initialEntries={["/planner/workouts"]}>
        <FeatureProvider>
          <Routes>
            <Route path="/planner" element={<PlannerPage />} />
            <Route path="/planner/:submodule" element={<PlannerPage />} />
          </Routes>
        </FeatureProvider>
      </MemoryRouter>
    )

    // Should fall back to Daily Planner view
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Daily Planner view" })).toHaveAttribute(
        "aria-selected",
        "true"
      )
    })
    expect(screen.queryByTestId("workout-planner-view")).not.toBeInTheDocument()
  })

  it("6. preserves saved data when module is toggled off", async () => {
    // 1. Save a workout item while enabled
    await db.local_items.put({
      id: "workout-item-saved-1",
      user_id: testUserId,
      raw_input: "Workout: Leg Day Squats",
      title: "Leg Day Squats",
      content: JSON.stringify({ exercises: ["Barbell Squats 4x10"], scheduledDate: null }),
      type: "task",
      status: "active",
      captured_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      ai_tags: ["Workout"],
      synced: true,
    })

    // 2. Disable module
    setCachedPreferences(testUserId, {
      workout_planner: false,
    })

    render(
      <MemoryRouter initialEntries={["/planner"]}>
        <FeatureProvider>
          <Routes>
            <Route path="/planner" element={<PlannerPage />} />
          </Routes>
        </FeatureProvider>
      </MemoryRouter>
    )

    // Tab is hidden
    expect(screen.queryByRole("tab", { name: "Workout Planner view" })).not.toBeInTheDocument()

    // Data in Dexie is still intact
    const itemInDb = await db.local_items.get("workout-item-saved-1")
    expect(itemInDb).toBeDefined()
    expect(itemInDb?.title).toBe("Leg Day Squats")
    expect(itemInDb?.deleted_at).toBeNull()
  })

  it("7. when Expense Tracker is enabled, displays its tab in planner, allows navigation, and shows back button while hiding tablist", async () => {
    setCachedPreferences(testUserId, {
      workout_planner: false,
      diet_planner: false,
      expense_tracker: true,
      wishlist: false,
    })

    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={["/planner"]}>
        <FeatureProvider>
          <Routes>
            <Route path="/planner" element={<PlannerPage />} />
            <Route path="/planner/:submodule" element={<PlannerPage />} />
          </Routes>
        </FeatureProvider>
      </MemoryRouter>
    )

    // In normal planner view, Expense Tracker tab should be present
    const expenseTab = await screen.findByRole("tab", { name: "Expense Tracker view" })
    expect(expenseTab).toBeInTheDocument()

    // Clicking Expense Tracker tab navigates to Expense Tracker view
    await user.click(expenseTab)

    // In Expense Tracker view, tablist is hidden and only Expense Tracker + Back button are visible
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
    const backBtn = screen.getByRole("button", { name: "Back to Planner" })
    expect(backBtn).toBeInTheDocument()
    expect(screen.getByText("Quick Expense")).toBeInTheDocument()

    // Clicking Back button returns to standard Planner
    await user.click(backBtn)
    expect(await screen.findByRole("tablist")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Daily Planner view" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
  })

  it("8. when Wishlist is enabled, displays its tab in planner, allows navigation, and shows back button while hiding tablist", async () => {
    setCachedPreferences(testUserId, {
      workout_planner: false,
      diet_planner: false,
      expense_tracker: false,
      wishlist: true,
    })

    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={["/planner"]}>
        <FeatureProvider>
          <Routes>
            <Route path="/planner" element={<PlannerPage />} />
            <Route path="/planner/:submodule" element={<PlannerPage />} />
          </Routes>
        </FeatureProvider>
      </MemoryRouter>
    )

    // In normal planner view, Wishlist tab should be present
    const wishlistTab = await screen.findByRole("tab", { name: "Wishlist view" })
    expect(wishlistTab).toBeInTheDocument()

    // Clicking Wishlist tab navigates to Wishlist view
    await user.click(wishlistTab)

    // In Wishlist view, tablist is hidden and only Wishlist + Back button are visible
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
    const backBtn = screen.getByRole("button", { name: "Back to Planner" })
    expect(backBtn).toBeInTheDocument()
    expect(await screen.findByTestId("wishlist-view")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save to Wishlist" })).toBeInTheDocument()

    // Clicking Back button returns to standard Planner
    await user.click(backBtn)
    expect(await screen.findByRole("tablist")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Daily Planner view" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
  })
})
