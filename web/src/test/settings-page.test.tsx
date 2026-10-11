import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { SettingsPage } from "@/pages/settings-page"
import * as AuthContextModule from "@/lib/auth/auth-context"
import * as SyncContextModule from "@/lib/sync/sync-context"
import * as ExportServiceModule from "@/lib/export/service"

describe("Phase 1E: SettingsPage Component", () => {
  const mockUser = {
    id: "test-user-uuid-1234",
    email: "settings-user@example.com",
    app_metadata: { provider: "email" },
  }

  const mockSignOut = vi.fn().mockResolvedValue({ error: null })
  const mockRetrySync = vi.fn().mockResolvedValue({
    successCount: 2,
    failureCount: 0,
    skippedCount: 0,
    errors: [],
  })

  beforeEach(() => {
    vi.clearAllMocks()

    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: mockUser as any,
      session: null,
      isLoading: false,
      isRecoveryMode: false,
      signInWithGoogle: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updatePassword: vi.fn(),
      signOut: mockSignOut,
    })

    vi.spyOn(SyncContextModule, "useSync").mockReturnValue({
      syncState: {
        status: "synced",
        pendingCount: 0,
        lastSyncedAt: "2026-10-09T14:30:00.000Z",
        lastError: null,
      },
      triggerSync: vi.fn(),
      retrySync: mockRetrySync,
    })
  })

  it("1. renders Account & Security information, Sync section, and Data Export section", () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Account & Security" })).toBeInTheDocument()
    expect(screen.getByText("settings-user@example.com")).toBeInTheDocument()
    expect(screen.getByText("test-user-uuid-1234")).toBeInTheDocument()
    expect(screen.getByText("Email & Password")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Synchronization" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Data Portability & Export" })).toBeInTheDocument()
    expect(screen.getByText(/Local Storage & Device Security/i)).toBeInTheDocument()
  })

  it("2. Sign out button opens confirmation dialog and confirms or cancels cleanly", async () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    const initialSignOutBtn = screen.getByRole("button", { name: "Sign out" })
    await userEvent.click(initialSignOutBtn)

    // Dialog appears
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("Sign out of Praxis?")).toBeInTheDocument()

    // Test Cancel button dismisses without calling signOut
    const cancelBtn = screen.getByRole("button", { name: "Cancel" })
    await userEvent.click(cancelBtn)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(mockSignOut).not.toHaveBeenCalled()

    // Reopen dialog and confirm sign out
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    // In the dialog, click the destructive Sign out button
    const confirmSignOutBtn = screen.getByRole("dialog").querySelector("button.bg-destructive") ||
      screen.getAllByRole("button", { name: "Sign out" }).find(b => b.closest('[role="dialog"]'))
    expect(confirmSignOutBtn).toBeTruthy()
    await userEvent.click(confirmSignOutBtn!)

    expect(mockSignOut).toHaveBeenCalledTimes(1)
  })

  it("3. Retry Sync button invokes retrySync(true) and displays feedback message", async () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    const retryBtn = screen.getByRole("button", { name: "Retry sync now" })
    await userEvent.click(retryBtn)

    await waitFor(() => {
      expect(mockRetrySync).toHaveBeenCalledWith(true)
      expect(screen.getByRole("status")).toHaveTextContent(
        /Successfully synced 2 item\(s\) to cloud/i
      )
    })
  })

  it("4. displays diagnostic error banner when sync status is 'error'", () => {
    vi.spyOn(SyncContextModule, "useSync").mockReturnValue({
      syncState: {
        status: "error",
        pendingCount: 1,
        lastSyncedAt: null,
        lastError: 'relation "public.items" does not exist',
      },
      triggerSync: vi.fn(),
      retrySync: mockRetrySync,
    })

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.getByText(/relation "public.items" does not exist/i)).toBeInTheDocument()
    expect(screen.getByText(/supabase\/migrations\/20261008000000_initial_schema\.sql/i)).toBeInTheDocument()
  })

  it("5. Download JSON Export triggers gatherExportData and displays export summary", async () => {
    const mockExportPayload = {
      metadata: {
        schema_version: "1.0.0" as const,
        app_version: "0.1.0",
        exported_at: new Date().toISOString(),
        user_id: mockUser.id,
        is_offline: false,
        is_partial: false,
        partial_reasons: [],
        sync_status: "synced",
        counts: {
          items_total: 10,
          items_active: 8,
          items_soft_deleted: 2,
          resources: 1,
          tasks: 3,
          calendar_events: 0,
          tags: 2,
          item_tags: 2,
          item_relationships: 0,
          unsynced_local_items: 1,
        },
      },
      profile: null,
      items: [],
      resources: [],
      tasks: [],
      calendar_events: [],
      tags: [],
      item_tags: [],
      item_relationships: [],
    }

    vi.spyOn(ExportServiceModule, "gatherExportData").mockResolvedValue(mockExportPayload)
    vi.spyOn(ExportServiceModule, "triggerJsonDownload").mockReturnValue(
      "personal-memory-export-2026-10-09-143000.json"
    )

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    const exportBtn = screen.getByRole("button", { name: "Export all data as JSON" })
    await userEvent.click(exportBtn)

    await waitFor(() => {
      expect(ExportServiceModule.gatherExportData).toHaveBeenCalledWith(mockUser.id)
      expect(ExportServiceModule.triggerJsonDownload).toHaveBeenCalledWith(mockExportPayload)
      expect(screen.getByText("Export generated successfully")).toBeInTheDocument()
      expect(screen.getByText(/personal-memory-export-2026-10-09-143000\.json/)).toBeInTheDocument()
      expect(screen.getByText(/10 total items/i)).toBeInTheDocument()
    })
  })

  it("6. shows warning when export is partial or incomplete", async () => {
    const mockPartialPayload = {
      metadata: {
        schema_version: "1.0.0" as const,
        app_version: "0.1.0",
        exported_at: new Date().toISOString(),
        user_id: mockUser.id,
        is_offline: true,
        is_partial: true,
        partial_reasons: ["Export created while offline; cloud data could not be reached."],
        sync_status: "offline",
        counts: {
          items_total: 3,
          items_active: 3,
          items_soft_deleted: 0,
          resources: 0,
          tasks: 0,
          calendar_events: 0,
          tags: 0,
          item_tags: 0,
          item_relationships: 0,
          unsynced_local_items: 3,
        },
      },
      profile: null,
      items: [],
      resources: [],
      tasks: [],
      calendar_events: [],
      tags: [],
      item_tags: [],
      item_relationships: [],
    }

    vi.spyOn(ExportServiceModule, "gatherExportData").mockResolvedValue(mockPartialPayload)
    vi.spyOn(ExportServiceModule, "triggerJsonDownload").mockReturnValue(
      "personal-memory-export-offline.json"
    )

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    const exportBtn = screen.getByRole("button", { name: "Export all data as JSON" })
    await userEvent.click(exportBtn)

    await waitFor(() => {
      expect(screen.getByText(/Notice: Incomplete Export/i)).toBeInTheDocument()
      expect(screen.getByText(/Export created while offline/i)).toBeInTheDocument()
    })
  })
})
