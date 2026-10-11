import * as React from "react"
import { useAuth } from "@/lib/auth/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { ThemeToggle } from "@/components/theme/theme-toggle"
import { PraxisLogo } from "@/components/branding/praxis-logo"

type AuthMode = "signin" | "signup" | "forgot"

export function AuthPage() {
  const {
    signInWithGoogle,
    signInWithPassword,
    signUp,
    resetPasswordForEmail,
    updatePassword,
    isRecoveryMode,
  } = useAuth()

  const [mode, setMode] = React.useState<AuthMode>("signin")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [statusMessage, setStatusMessage] = React.useState<{
    type: "success" | "error"
    text: string
  } | null>(null)

  const isPending = isGoogleLoading || isSubmitting

  const handleModeChange = (newMode: AuthMode) => {
    setMode(newMode)
    setStatusMessage(null)
    setPassword("")
    setConfirmPassword("")
  }

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true)
    setStatusMessage(null)
    const { error } = await signInWithGoogle()
    if (error) {
      setStatusMessage({
        type: "error",
        text: error.message || "Could not connect to Google. Please try again.",
      })
      setIsGoogleLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setStatusMessage(null)

    // Password Recovery Mode
    if (isRecoveryMode) {
      if (!password || password.length < 6) {
        setStatusMessage({
          type: "error",
          text: "Password must be at least 6 characters long.",
        })
        return
      }
      if (password !== confirmPassword) {
        setStatusMessage({
          type: "error",
          text: "Passwords do not match.",
        })
        return
      }
      setIsSubmitting(true)
      const { error } = await updatePassword(password)
      setIsSubmitting(false)
      if (error) {
        setStatusMessage({ type: "error", text: error.message })
      } else {
        setStatusMessage({
          type: "success",
          text: "Password updated successfully. You can now use your new password.",
        })
        setPassword("")
        setConfirmPassword("")
      }
      return
    }

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setStatusMessage({
        type: "error",
        text: "Please enter a valid email address.",
      })
      return
    }

    if (mode === "forgot") {
      setIsSubmitting(true)
      const { error } = await resetPasswordForEmail(trimmedEmail)
      setIsSubmitting(false)
      if (error) {
        setStatusMessage({ type: "error", text: error.message })
      } else {
        setStatusMessage({
          type: "success",
          text: "Password reset instructions sent. Please check your email.",
        })
      }
      return
    }

    if (!password || password.length < 6) {
      setStatusMessage({
        type: "error",
        text: "Password must be at least 6 characters long.",
      })
      return
    }

    if (mode === "signup") {
      if (password !== confirmPassword) {
        setStatusMessage({
          type: "error",
          text: "Passwords do not match.",
        })
        return
      }
      setIsSubmitting(true)
      const { error, session } = await signUp(trimmedEmail, password)
      setIsSubmitting(false)
      if (error) {
        setStatusMessage({ type: "error", text: error.message })
      } else if (!session) {
        setStatusMessage({
          type: "success",
          text: "Account created! Please check your email to confirm your account or sign in.",
        })
      }
      return
    }

    // mode === "signin"
    setIsSubmitting(true)
    const { error } = await signInWithPassword(trimmedEmail, password)
    setIsSubmitting(false)
    if (error) {
      setStatusMessage({ type: "error", text: error.message })
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 selection:bg-primary selection:text-primary-foreground relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle className="size-9 bg-card/60 border border-border/80 shadow-2xs" />
      </div>
      <div className="w-full max-w-sm mx-auto space-y-6">
        <header className="space-y-3 text-center flex flex-col items-center">
          <PraxisLogo variant="icon" size="lg" className="mx-auto" />
          <div className="space-y-1">
            <h1 className="font-heading font-extrabold text-2xl md:text-3xl tracking-tight text-foreground">
              Praxis
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
              {isRecoveryMode
                ? "Set a new password for your account."
                : mode === "forgot"
                ? "Reset your password with your email address."
                : mode === "signup"
                ? "Create your private account to start capturing."
                : "Your private place to capture thoughts, resources, and ideas."}
            </p>
          </div>
        </header>

        <div className="space-y-5">
          {!isRecoveryMode && (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full h-10 font-medium justify-center gap-2.5"
                onClick={handleGoogleSignIn}
                disabled={isPending}
                aria-label="Continue with Google"
              >
                <svg
                  className="size-4 shrink-0"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.02h3.87c2.26-2.09 3.675-5.17 3.675-9.12z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.02c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.27v3.12C3.26 21.36 7.35 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.27 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.61H1.27C.46 8.23 0 10.06 0 12s.46 3.77 1.27 5.39l4-3.12z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.27 6.61l4 3.12c.95-2.85 3.6-4.96 6.73-4.96z"
                  />
                </svg>
                <span>{isGoogleLoading ? "Connecting to Google..." : "Continue with Google"}</span>
              </Button>

              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <span className="relative bg-background px-3 text-xs uppercase tracking-wider text-muted-foreground">
                  or
                </span>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isRecoveryMode && (
              <div className="space-y-1.5 text-left">
                <label htmlFor="email" className="text-xs font-medium text-foreground">
                  Email address
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isPending}
                  required
                  className="h-10 text-sm"
                  autoComplete="email"
                />
              </div>
            )}

            {mode !== "forgot" && (
              <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-xs font-medium text-foreground">
                    {isRecoveryMode ? "New password" : "Password"}
                  </label>
                  {!isRecoveryMode && mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => handleModeChange("forgot")}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      disabled={isPending}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isPending}
                  required
                  minLength={6}
                  className="h-10 text-sm"
                  autoComplete={isRecoveryMode || mode === "signup" ? "new-password" : "current-password"}
                />
              </div>
            )}

            {(isRecoveryMode || mode === "signup") && (
              <div className="space-y-1.5 text-left">
                <label htmlFor="confirmPassword" className="text-xs font-medium text-foreground">
                  Confirm password
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isPending}
                  required
                  minLength={6}
                  className="h-10 text-sm"
                  autoComplete="new-password"
                />
              </div>
            )}

            <Button
              type="submit"
              variant="default"
              className="w-full h-10 font-medium justify-center"
              disabled={
                isPending ||
                (!isRecoveryMode && !email) ||
                (mode !== "forgot" && !password)
              }
            >
              {isSubmitting
                ? "Processing..."
                : isRecoveryMode
                ? "Update password"
                : mode === "forgot"
                ? "Send reset instructions"
                : mode === "signup"
                ? "Create account"
                : "Sign in"}
            </Button>
          </form>

          {statusMessage && (
            <div
              role="alert"
              className={`p-3 rounded-lg text-xs leading-relaxed border ${
                statusMessage.type === "success"
                  ? "bg-secondary text-secondary-foreground border-border"
                  : "bg-destructive/10 text-destructive border-destructive/20"
              }`}
            >
              {statusMessage.text}
            </div>
          )}

          {!isRecoveryMode && (
            <div className="pt-2 text-center text-xs text-muted-foreground">
              {mode === "signin" ? (
                <span>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => handleModeChange("signup")}
                    className="font-medium text-foreground hover:underline"
                    disabled={isPending}
                  >
                    Sign up
                  </button>
                </span>
              ) : (
                <span>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => handleModeChange("signin")}
                    className="font-medium text-foreground hover:underline"
                    disabled={isPending}
                  >
                    Sign in
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
