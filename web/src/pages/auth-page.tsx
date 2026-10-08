import * as React from "react"
import { useAuth } from "@/lib/auth/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function AuthPage() {
  const { signInWithGoogle, signInWithOtp } = useAuth()
  const [email, setEmail] = React.useState("")
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false)
  const [isOtpLoading, setIsOtpLoading] = React.useState(false)
  const [statusMessage, setStatusMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true)
    setStatusMessage(null)
    const { error } = await signInWithGoogle()
    if (error) {
      setStatusMessage({ type: "error", text: "Could not sign in. Please try again." })
      setIsGoogleLoading(false)
    }
  }

  const handleMagicLinkSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!email.trim() || !email.includes("@")) {
      setStatusMessage({ type: "error", text: "Please enter a valid email address." })
      return
    }

    setIsOtpLoading(true)
    setStatusMessage(null)
    const { error } = await signInWithOtp(email.trim())
    setIsOtpLoading(false)

    if (error) {
      setStatusMessage({ type: "error", text: "Could not sign in. Please try again." })
    } else {
      setStatusMessage({ type: "success", text: "Check your email for the sign-in link." })
      setEmail("")
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 selection:bg-primary selection:text-primary-foreground">
      <div className="w-full max-w-sm mx-auto space-y-8">
        <header className="space-y-3 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Personal Memory
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your private place to capture things before you forget them.
          </p>
        </header>

        <div className="space-y-6">
          <Button
            type="button"
            variant="outline"
            className="w-full h-10 font-medium justify-center"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isOtpLoading}
            aria-label="Continue with Google"
          >
            {isGoogleLoading ? "Connecting to Google..." : "Continue with Google"}
          </Button>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <span className="relative bg-background px-3 text-xs uppercase tracking-wider text-muted-foreground">
              or
            </span>
          </div>

          <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
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
                disabled={isGoogleLoading || isOtpLoading}
                required
                className="h-10 text-sm"
                autoComplete="email"
              />
            </div>

            <Button
              type="submit"
              variant="default"
              className="w-full h-10 font-medium justify-center"
              disabled={isGoogleLoading || isOtpLoading || !email}
            >
              {isOtpLoading ? "Sending magic link..." : "Send me a magic link"}
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
        </div>
      </div>
    </main>
  )
}
