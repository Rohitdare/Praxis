import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js"
import { MemoryRouter } from "react-router-dom"
import { AuthProvider } from "@/lib/auth/auth-context"
import { AppRoutes } from "@/App"
import { supabase } from "@/lib/supabase/client"

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => {
  return {
    supabase: {
      auth: {
        getSession: vi.fn(),
        onAuthStateChange: vi.fn(),
        signInWithOAuth: vi.fn(),
        signInWithOtp: vi.fn(),
        signOut: vi.fn(),
      },
    },
  }
})

describe("Phase 1A: Authentication & Routing", () => {
  const mockUser: User = {
    id: "user-123",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
    email: "test@example.com",
  }

  const mockSession: Session = {
    access_token: "mock-token",
    refresh_token: "mock-refresh",
    expires_in: 3600,
    token_type: "bearer",
    user: mockUser,
  }

  let authListener: ((event: AuthChangeEvent, session: Session | null) => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    authListener = null

    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback) => {
      authListener = callback
      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(),
            id: "sub-1",
            callback,
          },
        },
      }
    })
  })

  it("1. renders /auth when unauthenticated", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    })

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/auth"]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Personal Memory" })).toBeInTheDocument()
    })
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Send me a magic link" })).toBeInTheDocument()
    expect(screen.getByLabelText("Email address")).toBeInTheDocument()
  })

  it("2. unauthenticated users attempting to access / or /capture are redirected to /auth", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    })

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/capture"]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Personal Memory" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument()
    })
    expect(screen.queryByText("What do you want to remember?")).not.toBeInTheDocument()
  })

  it("3. authenticated session allows application access to /capture", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    })

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/capture"]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("What do you want to remember?")).toBeInTheDocument()
    })
    expect(screen.getByText("Personal Memory")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Continue with Google" })).not.toBeInTheDocument()
  })

  it("4. authenticated user visiting / redirects to /capture", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    })

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/"]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("What do you want to remember?")).toBeInTheDocument()
    })
  })

  it("5. sign-out returns the user to /auth", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    })
    vi.mocked(supabase.auth.signOut).mockImplementation(async () => {
      if (authListener) {
        authListener("SIGNED_OUT", null)
      }
      return { error: null }
    })

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/capture"]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("What do you want to remember?")).toBeInTheDocument()
    })

    const signOutButtons = screen.getAllByRole("button", { name: "Sign out" })
    await userEvent.click(signOutButtons[0])

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument()
    })
    expect(screen.queryByText("What do you want to remember?")).not.toBeInTheDocument()
  })

  it("6. renders responsive shell navigation with Capture, Inbox, Settings, and Sign out", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    })

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/capture"]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("What do you want to remember?")).toBeInTheDocument()
    })

    // Navigation links
    const captureLinks = screen.getAllByRole("link", { name: /Capture/i })
    const inboxLinks = screen.getAllByRole("link", { name: /Inbox/i })
    expect(captureLinks.length).toBeGreaterThan(0)
    expect(inboxLinks.length).toBeGreaterThan(0)

    // Navigating to Inbox works
    await userEvent.click(inboxLinks[0])
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Inbox" })).toBeInTheDocument()
    })

    // Settings notice interaction
    const settingsButtons = screen.getAllByRole("button", { name: /Settings/i })
    await userEvent.click(settingsButtons[0])
    expect(screen.getByRole("status")).toHaveTextContent(/Settings will be configurable in a later phase/i)
  })
})
