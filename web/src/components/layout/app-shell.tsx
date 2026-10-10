import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { Calendar, FileText, Inbox, LogOut, PenLine, Settings } from "lucide-react"
import { useAuth } from "@/lib/auth/auth-context"
import { Button } from "@/components/ui/button"
import { SyncIndicator } from "@/components/sync/sync-indicator"

export function AppShell() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate("/auth", { replace: true })
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-border/80 bg-background/95 backdrop-blur-xs sticky top-0 z-30 transition-colors">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <NavLink
              to="/capture"
              className="font-heading font-extrabold text-[1.05rem] tracking-tight text-foreground hover:opacity-85 transition-opacity flex items-center gap-2 select-none"
            >
              <span>Personal Memory</span>
            </NavLink>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1" aria-label="Desktop Navigation">
              <NavLink
                to="/capture"
                className={({ isActive }) =>
                  `px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    isActive
                      ? "bg-secondary text-foreground font-semibold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                  }`
                }
              >
                Capture
              </NavLink>
              <NavLink
                to="/inbox"
                className={({ isActive }) =>
                  `px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    isActive
                      ? "bg-secondary text-foreground font-semibold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                  }`
                }
              >
                Inbox
              </NavLink>
              <NavLink
                to="/notes"
                className={({ isActive }) =>
                  `px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    isActive
                      ? "bg-secondary text-foreground font-semibold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                  }`
                }
              >
                Notes
              </NavLink>
              <NavLink
                to="/calendar"
                className={({ isActive }) =>
                  `px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    isActive
                      ? "bg-secondary text-foreground font-semibold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                  }`
                }
              >
                Calendar
              </NavLink>
            </nav>
          </div>

          {/* Desktop Right Actions */}
          <div className="hidden md:flex items-center gap-2.5">
            <SyncIndicator />
            <div className="h-3.5 w-px bg-border/70" />
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all inline-flex items-center gap-1.5 ${
                  isActive
                    ? "bg-secondary text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                }`
              }
              aria-label="Settings"
            >
              <Settings className="size-3.5" />
              Settings
            </NavLink>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg"
              aria-label="Sign out"
            >
              <LogOut className="size-3.5" />
              Sign out
            </Button>
          </div>

          {/* Mobile Right: Sync Indicator / Quick Sign Out */}
          <div className="flex md:hidden items-center gap-1">
            <SyncIndicator />
            <button
              type="button"
              onClick={handleSignOut}
              className="min-h-[44px] min-w-[44px] p-2 text-muted-foreground hover:text-foreground flex items-center justify-center rounded-md active:bg-muted/60 transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 pb-20 md:pb-8">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-background/95 backdrop-blur-md border-t border-border/80 flex items-center justify-around z-40 px-2 safe-area-pb"
        aria-label="Mobile Navigation"
      >
        <NavLink
          to="/capture"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] min-w-[48px] px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
              isActive
                ? "text-foreground font-semibold"
                : "text-muted-foreground/80 hover:text-foreground"
            }`
          }
        >
          <PenLine className="size-4 mb-1" />
          <span>Capture</span>
        </NavLink>

        <NavLink
          to="/inbox"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] min-w-[48px] px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
              isActive
                ? "text-foreground font-semibold"
                : "text-muted-foreground/80 hover:text-foreground"
            }`
          }
        >
          <Inbox className="size-4 mb-1" />
          <span>Inbox</span>
        </NavLink>

        <NavLink
          to="/notes"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] min-w-[48px] px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
              isActive
                ? "text-foreground font-semibold"
                : "text-muted-foreground/80 hover:text-foreground"
            }`
          }
        >
          <FileText className="size-4 mb-1" />
          <span>Notes</span>
        </NavLink>

        <NavLink
          to="/calendar"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] min-w-[48px] px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
              isActive
                ? "text-foreground font-semibold"
                : "text-muted-foreground/80 hover:text-foreground"
            }`
          }
        >
          <Calendar className="size-4 mb-1" />
          <span>Calendar</span>
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] min-w-[48px] px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
              isActive
                ? "text-foreground font-semibold"
                : "text-muted-foreground/80 hover:text-foreground"
            }`
          }
          aria-label="Settings"
        >
          <Settings className="size-4 mb-1" />
          <span>Settings</span>
        </NavLink>
      </nav>
    </div>
  )
}
