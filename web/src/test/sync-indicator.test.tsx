import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SyncIndicator } from "@/components/sync/sync-indicator"
import { SyncProvider } from "@/lib/sync/sync-context"
import { AuthProvider } from "@/lib/auth/auth-context"

describe("SyncIndicator Component", () => {
  it("renders safe fallback Synced indicator when rendered outside provider", () => {
    render(<SyncIndicator />)
    expect(screen.getByText("Synced")).toBeInTheDocument()
  })

  it("renders within SyncProvider and AuthProvider", () => {
    render(
      <AuthProvider>
        <SyncProvider>
          <SyncIndicator />
        </SyncProvider>
      </AuthProvider>
    )

    // Initially when online and empty outbox, renders Synced
    expect(screen.getByText("Synced")).toBeInTheDocument()
  })
})
