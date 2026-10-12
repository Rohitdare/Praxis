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
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        resetPasswordForEmail: vi.fn(),
        updateUser: vi.fn(),
        signOut: vi.fn(),
      },
    },
    isSupabaseConfigured: true,
  }
})

describe("Authentication & Routing (Email/Password + Google OAuth)", () => {
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

  it("1. renders /auth with Google OAuth and Email/Password form when unauthenticated", async () => {
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
      expect(screen.getByRole("heading", { name: "Praxis" })).toBeInTheDocument()
    })
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument()
    expect(screen.getByLabelText("Email address")).toBeInTheDocument()
    expect(screen.getByLabelText("Password")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /magic link/i })).not.toBeInTheDocument()
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
      expect(screen.getByRole("heading", { name: "Praxis" })).toBeInTheDocument()
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
    expect(screen.getAllByText("Praxis").length).toBeGreaterThan(0)
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
    }, { timeout: 8000 })
  })

  it("5. sign-out is relocated to Settings and returns the user to /auth after confirmation", async () => {
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

    // Sign out is removed from navbar
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument()

    // Navigate to Settings
    const settingsLinks = screen.getAllByRole("link", { name: /Settings/i })
    await userEvent.click(settingsLinks[0])

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument()
    })

    // Click Sign out in Settings
    const signOutBtn = screen.getByRole("button", { name: "Sign out" })
    await userEvent.click(signOutBtn)

    // Confirm dialog appears and clicking confirm signs out
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    const confirmSignOutBtn = screen.getAllByRole("button", { name: "Sign out" }).find(b => b.closest('[role="dialog"]'))
    expect(confirmSignOutBtn).toBeTruthy()
    await userEvent.click(confirmSignOutBtn!)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument()
    })
    expect(screen.queryByText("What do you want to remember?")).not.toBeInTheDocument()
  })

  it("6. renders responsive shell navigation with Capture, Inbox, Notes, Calendar, and Settings without Sign out in navbar", async () => {
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

    const captureLinks = screen.getAllByRole("link", { name: /Capture/i })
    const inboxLinks = screen.getAllByRole("link", { name: /Inbox/i })
    expect(captureLinks.length).toBeGreaterThan(0)
    expect(inboxLinks.length).toBeGreaterThan(0)
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument()

    await userEvent.click(inboxLinks[0])
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Inbox" })).toBeInTheDocument()
    })

    // Navigating to Settings works
    const settingsLinks = screen.getAllByRole("link", { name: /Settings/i })
    expect(settingsLinks.length).toBeGreaterThan(0)
    await userEvent.click(settingsLinks[0])
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument()
    })
  })

  it("7. Email/Password sign-in success calls signInWithPassword and authenticates", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    })
    vi.mocked(supabase.auth.signInWithPassword).mockImplementation(async () => {
      if (authListener) {
        authListener("SIGNED_IN", mockSession)
      }
      return {
        data: { user: mockUser, session: mockSession },
        error: null,
      }
    })

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/auth"]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Praxis" })).toBeInTheDocument()
    })

    const emailInput = screen.getByLabelText("Email address")
    const passwordInput = screen.getByLabelText("Password")
    const submitButton = screen.getByRole("button", { name: "Sign in" })

    await userEvent.type(emailInput, "user@test.com")
    await userEvent.type(passwordInput, "secret123")
    await userEvent.click(submitButton)

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "user@test.com",
        password: "secret123",
      })
      expect(screen.getByText("What do you want to remember?")).toBeInTheDocument()
    })
  })

  it("8. Email/Password sign-in failure displays clear error alert on invalid credentials", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    })
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: {
        name: "AuthApiError",
        message: "Invalid login credentials",
        status: 400,
        code: "invalid_credentials",
      } as any,
    })

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/auth"]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Praxis" })).toBeInTheDocument()
    })

    const emailInput = screen.getByLabelText("Email address")
    const passwordInput = screen.getByLabelText("Password")
    const submitButton = screen.getByRole("button", { name: "Sign in" })

    await userEvent.type(emailInput, "wrong@test.com")
    await userEvent.type(passwordInput, "wrongpassword")
    await userEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /Invalid email or password. Please check your credentials/i
      )
    })
  })

  it("9. Email/Password sign-up mode creates account with confirm password", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    })
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: mockUser, session: null },
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
      expect(screen.getByRole("heading", { name: "Praxis" })).toBeInTheDocument()
    })

    // Switch to Sign up mode
    const signUpSwitch = screen.getByRole("button", { name: "Sign up" })
    await userEvent.click(signUpSwitch)

    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument()

    const emailInput = screen.getByLabelText("Email address")
    const passwordInput = screen.getByLabelText("Password")
    const confirmPasswordInput = screen.getByLabelText("Confirm password")

    await userEvent.type(emailInput, "newuser@example.com")
    await userEvent.type(passwordInput, "pass12345")
    await userEvent.type(confirmPasswordInput, "pass12345")

    await userEvent.click(screen.getByRole("button", { name: "Create account" }))

    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: "newuser@example.com",
        password: "pass12345",
        options: {
          emailRedirectTo: `${window.location.origin}/capture`,
        },
      })
      expect(screen.getByRole("alert")).toHaveTextContent(/Account created! Please check your email/i)
    })
  })

  it("10. Password reset flow in forgot password mode sends instructions", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    })
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
      data: {},
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
      expect(screen.getByRole("heading", { name: "Praxis" })).toBeInTheDocument()
    })

    const forgotButton = screen.getByRole("button", { name: "Forgot password?" })
    await userEvent.click(forgotButton)

    expect(screen.getByRole("button", { name: "Send reset instructions" })).toBeInTheDocument()
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument()

    const emailInput = screen.getByLabelText("Email address")
    await userEvent.type(emailInput, "reset@example.com")
    await userEvent.click(screen.getByRole("button", { name: "Send reset instructions" }))

    await waitFor(() => {
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        "reset@example.com",
        {
          redirectTo: `${window.location.origin}/auth?mode=recovery`,
        }
      )
      expect(screen.getByRole("alert")).toHaveTextContent(/Password reset instructions sent/i)
    })
  })

  it("11. Google OAuth invocation: calls signInWithOAuth and handles disabled provider", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    })
    vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValueOnce({
      data: { provider: "google", url: "https://example.supabase.co/auth/v1/authorize" },
      error: {
        name: "AuthApiError",
        message: "Unsupported provider: provider is not enabled",
        status: 400,
        code: "validation_failed",
      } as any,
    })

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/auth"]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Praxis" })).toBeInTheDocument()
    })

    const googleButton = screen.getByRole("button", { name: "Continue with Google" })
    await userEvent.click(googleButton)

    await waitFor(() => {
      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/capture`,
        },
      })
      expect(screen.getByRole("alert")).toHaveTextContent(
        /Google authentication is not enabled in your Supabase project settings/i
      )
    })
  })

  it("12. Eye icon toggles password visibility between password and text", async () => {
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
      expect(screen.getByRole("heading", { name: "Praxis" })).toBeInTheDocument()
    })

    const passwordInput = screen.getByLabelText("Password")
    expect(passwordInput).toHaveAttribute("type", "password")

    const toggleButton = screen.getByRole("button", { name: "Show password" })
    expect(toggleButton).toBeInTheDocument()

    // Click toggle button to reveal password
    await userEvent.click(toggleButton)
    expect(passwordInput).toHaveAttribute("type", "text")
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument()

    // Click toggle button again to hide password
    await userEvent.click(screen.getByRole("button", { name: "Hide password" }))
    expect(passwordInput).toHaveAttribute("type", "password")
    expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument()
  })
})
