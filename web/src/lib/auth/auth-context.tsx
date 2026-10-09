import * as React from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase/client"

export interface AuthContextValue {
  user: User | null
  session: Session | null
  isLoading: boolean
  isRecoveryMode: boolean
  signInWithGoogle: () => Promise<{ error: Error | null }>
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (
    email: string,
    password: string
  ) => Promise<{ error: Error | null; user: User | null; session: Session | null }>
  resetPasswordForEmail: (email: string) => Promise<{ error: Error | null }>
  updatePassword: (password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<{ error: Error | null }>
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

export function formatAuthErrorMessage(error: unknown): string {
  if (!error) return "An unknown error occurred."
  const err = error as { message?: string; code?: string; status?: number }
  const message = err.message || ""
  const code = err.code || ""
  const status = err.status

  if (
    code === "invalid_credentials" ||
    message.toLowerCase().includes("invalid login credentials") ||
    message.toLowerCase().includes("invalid grant")
  ) {
    return "Invalid email or password. Please check your credentials and try again."
  }
  if (
    code === "user_already_exists" ||
    message.toLowerCase().includes("user already registered") ||
    message.toLowerCase().includes("already registered")
  ) {
    return "An account with this email already exists. Please sign in instead."
  }
  if (
    code === "weak_password" ||
    message.toLowerCase().includes("password should be at least") ||
    message.toLowerCase().includes("weak password")
  ) {
    return "Password must be at least 6 characters long."
  }
  if (
    code === "over_email_send_rate_limit" ||
    status === 429 ||
    message.toLowerCase().includes("rate limit")
  ) {
    return "Email rate limit exceeded. Supabase default limits sending to 3 emails/hour. Please wait before requesting another email."
  }
  if (
    code === "email_address_invalid" ||
    (status === 400 && message.toLowerCase().includes("invalid"))
  ) {
    return `Invalid email address. Please enter a valid email address (${message}).`
  }
  if (code === "validation_failed" && message.toLowerCase().includes("not enabled")) {
    return "Google authentication is not enabled in your Supabase project settings. Please enable Google provider in the Supabase Dashboard."
  }
  if (message.toLowerCase().includes("fetch") || message.toLowerCase().includes("network")) {
    return "Network error connecting to Supabase. Please check your internet connection or project URL."
  }
  return message || "Could not complete authentication. Please try again."
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null)
  const [user, setUser] = React.useState<User | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isRecoveryMode, setIsRecoveryMode] = React.useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href)
      return url.searchParams.get("mode") === "recovery" || window.location.hash.includes("type=recovery")
    }
    return false
  })

  React.useEffect(() => {
    let isMounted = true

    async function initializeAuth() {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          console.warn("[Auth] Error restoring Supabase session:", error.message)
        }
        if (isMounted) {
          setSession(data.session)
          setUser(data.session?.user ?? null)
        }
      } catch (err) {
        console.warn("[Auth] Unexpected error restoring session:", err)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (isMounted) {
        setSession(newSession)
        setUser(newSession?.user ?? null)
        setIsLoading(false)

        if (event === "PASSWORD_RECOVERY") {
          setIsRecoveryMode(true)
        }
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = React.useCallback(async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: typeof window !== "undefined" ? `${window.location.origin}/capture` : undefined,
        },
      })
      if (error) {
        console.error("[Auth] signInWithGoogle failed:", {
          code: error.code,
          status: error.status,
          message: error.message,
        })
        const formatted = formatAuthErrorMessage(error)
        return { error: new Error(formatted) }
      }
      return { error: null }
    } catch (err) {
      console.error("[Auth] signInWithGoogle unexpected error:", err)
      return { error: err instanceof Error ? err : new Error("Unexpected error signing in with Google") }
    }
  }, [])

  const signInWithPassword = React.useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) {
        console.error("[Auth] signInWithPassword failed:", {
          code: error.code,
          status: error.status,
          message: error.message,
        })
        const formatted = formatAuthErrorMessage(error)
        return { error: new Error(formatted) }
      }
      setSession(data.session)
      setUser(data.user)
      return { error: null }
    } catch (err) {
      console.error("[Auth] signInWithPassword unexpected error:", err)
      return { error: err instanceof Error ? err : new Error("Unexpected error signing in") }
    }
  }, [])

  const signUp = React.useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/capture` : undefined,
        },
      })
      if (error) {
        console.error("[Auth] signUp failed:", {
          code: error.code,
          status: error.status,
          message: error.message,
        })
        const formatted = formatAuthErrorMessage(error)
        return { error: new Error(formatted), user: null, session: null }
      }
      if (data.session) {
        setSession(data.session)
        setUser(data.user)
      }
      return { error: null, user: data.user, session: data.session }
    } catch (err) {
      console.error("[Auth] signUp unexpected error:", err)
      return {
        error: err instanceof Error ? err : new Error("Unexpected error creating account"),
        user: null,
        session: null,
      }
    }
  }, [])

  const resetPasswordForEmail = React.useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth?mode=recovery` : undefined,
      })
      if (error) {
        console.error("[Auth] resetPasswordForEmail failed:", {
          code: error.code,
          status: error.status,
          message: error.message,
        })
        const formatted = formatAuthErrorMessage(error)
        return { error: new Error(formatted) }
      }
      return { error: null }
    } catch (err) {
      console.error("[Auth] resetPasswordForEmail unexpected error:", err)
      return { error: err instanceof Error ? err : new Error("Unexpected error requesting password reset") }
    }
  }, [])

  const updatePassword = React.useCallback(async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password,
      })
      if (error) {
        console.error("[Auth] updatePassword failed:", {
          code: error.code,
          status: error.status,
          message: error.message,
        })
        const formatted = formatAuthErrorMessage(error)
        return { error: new Error(formatted) }
      }
      setIsRecoveryMode(false)
      return { error: null }
    } catch (err) {
      console.error("[Auth] updatePassword unexpected error:", err)
      return { error: err instanceof Error ? err : new Error("Unexpected error updating password") }
    }
  }, [])

  const signOut = React.useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (!error) {
        setSession(null)
        setUser(null)
      }
      return { error: error ? new Error(error.message) : null }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error("Unexpected error signing out") }
    }
  }, [])

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      isLoading,
      isRecoveryMode,
      signInWithGoogle,
      signInWithPassword,
      signUp,
      resetPasswordForEmail,
      updatePassword,
      signOut,
    }),
    [
      user,
      session,
      isLoading,
      isRecoveryMode,
      signInWithGoogle,
      signInWithPassword,
      signUp,
      resetPasswordForEmail,
      updatePassword,
      signOut,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
