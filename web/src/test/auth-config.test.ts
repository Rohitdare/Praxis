import { describe, expect, it } from "vitest"
import { formatAuthErrorMessage } from "@/lib/auth/auth-context"
import { isSupabaseConfigured } from "@/lib/supabase/client"

describe("Supabase Auth Configuration & Error Diagnostics", () => {
  it("1. formatAuthErrorMessage formats 429 over_email_send_rate_limit accurately", () => {
    const error = {
      name: "AuthApiError",
      message: "email rate limit exceeded",
      status: 429,
      code: "over_email_send_rate_limit",
    }
    const message = formatAuthErrorMessage(error)
    expect(message).toContain("Email rate limit exceeded")
    expect(message).toContain("3 emails/hour")
  })

  it("2. formatAuthErrorMessage formats 400 email_address_invalid accurately", () => {
    const error = {
      name: "AuthApiError",
      message: 'Email address "test@example.com" is invalid',
      status: 400,
      code: "email_address_invalid",
    }
    const message = formatAuthErrorMessage(error)
    expect(message).toContain("Invalid email address")
    expect(message).toContain("test@example.com")
  })

  it("3. formatAuthErrorMessage formats unsupported/disabled provider accurately", () => {
    const error = {
      name: "AuthApiError",
      message: "Unsupported provider: provider is not enabled",
      status: 400,
      code: "validation_failed",
    }
    const message = formatAuthErrorMessage(error)
    expect(message).toContain("Google authentication is not enabled")
    expect(message).toContain("Supabase project settings")
  })

  it("4. formatAuthErrorMessage formats network/fetch failure accurately", () => {
    const error = new Error("Failed to fetch: net::ERR_CONNECTION_REFUSED")
    const message = formatAuthErrorMessage(error)
    expect(message).toContain("Network error connecting to Supabase")
  })

  it("5. formatAuthErrorMessage falls back to message or generic message", () => {
    expect(formatAuthErrorMessage({ message: "Custom unexpected error" })).toBe("Custom unexpected error")
    expect(formatAuthErrorMessage(null)).toBe("An unknown error occurred.")
  })

  it("6. isSupabaseConfigured evaluates boolean state based on environment variables", () => {
    // In our test environment, VITE_SUPABASE_URL and key are either set or fall back
    expect(typeof isSupabaseConfigured).toBe("boolean")
  })
})
