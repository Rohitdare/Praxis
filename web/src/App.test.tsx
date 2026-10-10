import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import App from "./App"

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => {
  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
        signInWithOAuth: vi.fn(),
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
      },
    },
  }
})

describe("App Root", () => {
  it("renders the unauthenticated sign-in view at startup", async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Personal Memory" })).toBeInTheDocument()
    }, { timeout: 4000 })
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument()
  })
})
