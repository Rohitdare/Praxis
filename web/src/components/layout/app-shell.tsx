import * as React from "react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { Inbox, LogOut, PenLine, Settings } from "lucide-react"
import { useAuth } from "@/lib/auth/auth-context"
import { Button } from "@/components/ui/button"

export function AppShell() {
  const { signOut, user } = useAuth()
  const navigate = useNavigate()
  const [showSettingsNotice, setShowSettingsNotice] = React.useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate("/auth", { replace: true })
  }

  const handleSettingsClick = () => {
    setShowSettingsNotice(true)
    setTimeout(() => setShowSettingsNotice(false), 3000)
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-border bg-background sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <NavLink
              to="/capture"
              className="text-base font-semibold tracking-tight text-foreground hover:opacity-80 transition-opacity"
            >
              Personal Memory
            </NavLink>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1" aria-label="Desktop Navigation">
              <NavLink
                to="/capture"
                className={({ isActive }) =>
                  `px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`
                }
              >
                Capture
              </NavLink>
              <NavLink
                to="/inbox"
                className={({ isActive }) =>
                  `px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`
                }
              >
                Inbox
              </NavLink>
            </nav>
          </div>

          {/* Desktop Right Actions */}
          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={handleSettingsClick}
              className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors inline-flex items-center gap-1.5"
              aria-label="Settings"
            >
              <Settings className="size-3.5" />
              Settings
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
              aria-label="Sign out"
            >
              <LogOut className="size-3.5" />
              Sign out
            </Button>
          </div>

          {/* Mobile Right: User Info / Quick Sign Out */}
          <div className="flex md:hidden items-center">
            <button
              type="button"
              onClick={handleSignOut}
              className="min-h-[44px] min-w-[44px] p-2 text-muted-foreground hover:text-foreground flex items-center justify-center"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Ephemeral settings placeholder notice */}
      {showSettingsNotice && (
        <div
          role="status"
          aria-live="polite"
          className="bg-secondary text-secondary-foreground text-xs text-center py-2 px-4 border-b border-border transition-all"
        >
          Settings will be configurable in a later phase. Logged in as{" "}
          <span className="font-medium">{user?.email ?? "User"}</span>.
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 pb-20 md:pb-8">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-background border-t border-border flex items-center justify-around z-40 px-2"
        aria-label="Mobile Navigation"
      >
        <NavLink
          to="/capture"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] min-w-[44px] text-xs font-medium transition-colors ${
              isActive ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
            }`
          }
        >
          <PenLine className="size-4 mb-0.5" />
          <span>Capture</span>
        </NavLink>

        <NavLink
          to="/inbox"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] min-w-[44px] text-xs font-medium transition-colors ${
              isActive ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
            }`
          }
        >
          <Inbox className="size-4 mb-0.5" />
          <span>Inbox</span>
        </NavLink>

        <button
          type="button"
          onClick={handleSettingsClick}
          className="flex flex-col items-center justify-center min-h-[44px] min-w-[44px] text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Settings placeholder"
        >
          <Settings className="size-4 mb-0.5" />
          <span>Settings</span>
        </button>
      </nav>
    </div>
  )
}
