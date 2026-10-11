import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { Calendar, FileText, Inbox, LogOut, PenLine, Settings } from "lucide-react"
import { useAuth } from "@/lib/auth/auth-context"
import { Button } from "@/components/ui/button"
import { SyncIndicator } from "@/components/sync/sync-indicator"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { PraxisLogo } from "@/components/branding/praxis-logo"

export function AppShell() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate("/auth", { replace: true })
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-150">
      {/* =========================================================================
          DESKTOP FOCUS LENS FLOATING CAPSULE NAVBAR (>= md)
          Inspired by Framer Focus Lens component: compact floating capsule,
          centered horizontally near top of viewport, subtle backdrop blur,
          restrained active pill indicator, balanced utility actions.
         ========================================================================= */}
      <div className="hidden md:flex sticky top-3.5 z-40 w-full px-4 justify-center pointer-events-none">
        <header
          className="pointer-events-auto max-w-fit flex items-center gap-3 px-3 py-1.5 rounded-full border border-border/80 bg-background/85 dark:bg-card/80 backdrop-blur-md shadow-sm transition-all"
          aria-label="Main Navigation"
        >
          {/* Product Identity */}
          <NavLink
            to="/capture"
            className="flex items-center gap-2 pl-1.5 pr-2.5 py-0.5 text-xs font-heading font-extrabold tracking-tight text-foreground hover:opacity-85 transition-opacity select-none group"
            aria-label="Personal Memory Home"
          >
            <PraxisLogo variant="icon" size="sm" aria-hidden="true" />
            <span className="font-heading font-extrabold tracking-tight">Personal Memory</span>
          </NavLink>

          {/* Subtle Divider */}
          <div className="h-4 w-px bg-border/70 shrink-0" aria-hidden="true" />

          {/* Desktop Primary Nav Links */}
          <nav className="flex items-center gap-1" aria-label="Desktop Navigation">
            <NavLink
              to="/capture"
              className={({ isActive }) =>
                `px-3 py-1.5 text-xs font-medium rounded-full transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? "bg-secondary text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`
              }
            >
              Capture
            </NavLink>
            <NavLink
              to="/inbox"
              className={({ isActive }) =>
                `px-3 py-1.5 text-xs font-medium rounded-full transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? "bg-secondary text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`
              }
            >
              Inbox
            </NavLink>
            <NavLink
              to="/notes"
              className={({ isActive }) =>
                `px-3 py-1.5 text-xs font-medium rounded-full transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? "bg-secondary text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`
              }
            >
              Notes
            </NavLink>
            <NavLink
              to="/calendar"
              className={({ isActive }) =>
                `px-3 py-1.5 text-xs font-medium rounded-full transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? "bg-secondary text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`
              }
            >
              Calendar
            </NavLink>
          </nav>

          {/* Subtle Divider */}
          <div className="h-4 w-px bg-border/70 shrink-0" aria-hidden="true" />

          {/* Right Control Group: Sync, Theme Toggle, Settings, Sign Out */}
          <div className="flex items-center gap-1.5">
            <SyncIndicator />

            <ThemeToggle className="size-7" />

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `px-2.5 py-1 text-xs font-medium rounded-full transition-all inline-flex items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? "bg-secondary text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`
              }
              aria-label="Settings"
            >
              <Settings className="size-3.5" aria-hidden="true" />
              <span>Settings</span>
            </NavLink>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full hover:bg-muted/60"
              aria-label="Sign out"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              <span>Sign out</span>
            </Button>
          </div>
        </header>
      </div>

      {/* =========================================================================
          MOBILE COMPACT TOP HEADER (< md)
          Clean floating top capsule with brand, sync status, theme toggle & sign out.
         ========================================================================= */}
      <div className="md:hidden sticky top-2 z-40 px-3 w-full">
        <header className="flex items-center justify-between px-3.5 py-2 rounded-full border border-border/80 bg-background/90 dark:bg-card/90 backdrop-blur-md shadow-xs transition-all">
          <NavLink
            to="/capture"
            className="flex items-center gap-1.5 pl-1 text-xs font-heading font-extrabold tracking-tight text-foreground select-none"
            aria-label="Personal Memory Home"
          >
            <PraxisLogo variant="icon" size="xs" aria-hidden="true" />
            <span className="font-heading font-bold text-xs tracking-tight">Praxis</span>
          </NavLink>

          <div className="flex items-center gap-1">
            <SyncIndicator />
            <ThemeToggle className="size-7" />
            <button
              type="button"
              onClick={handleSignOut}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/60 active:bg-muted transition-colors"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </header>
      </div>

      {/* =========================================================================
          MAIN CONTENT CONTAINER
          Allows pages to use their intentional responsive layout tokens.
         ========================================================================= */}
      <main className="flex-1 w-full mx-auto px-4 sm:px-6 md:px-8 pt-4 md:pt-6 pb-24 md:pb-12 max-w-7xl">
        <Outlet />
      </main>

      {/* =========================================================================
          MOBILE FLOATING CAPSULE BOTTOM NAVIGATION (< md)
          Thumb-reachable floating capsule respecting safe area insets.
         ========================================================================= */}
      <nav
        className="md:hidden fixed bottom-3 inset-x-3 max-w-sm mx-auto z-40 rounded-full border border-border/80 bg-background/95 dark:bg-card/95 backdrop-blur-md shadow-md p-1.5 flex items-center justify-around safe-area-pb"
        aria-label="Mobile Navigation"
      >
        <NavLink
          to="/capture"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] min-w-[48px] px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
              isActive
                ? "bg-secondary text-foreground font-semibold shadow-2xs"
                : "text-muted-foreground/80 hover:text-foreground"
            }`
          }
        >
          <PenLine className="size-4 mb-0.5" aria-hidden="true" />
          <span>Capture</span>
        </NavLink>

        <NavLink
          to="/inbox"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] min-w-[48px] px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
              isActive
                ? "bg-secondary text-foreground font-semibold shadow-2xs"
                : "text-muted-foreground/80 hover:text-foreground"
            }`
          }
        >
          <Inbox className="size-4 mb-0.5" aria-hidden="true" />
          <span>Inbox</span>
        </NavLink>

        <NavLink
          to="/notes"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] min-w-[48px] px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
              isActive
                ? "bg-secondary text-foreground font-semibold shadow-2xs"
                : "text-muted-foreground/80 hover:text-foreground"
            }`
          }
        >
          <FileText className="size-4 mb-0.5" aria-hidden="true" />
          <span>Notes</span>
        </NavLink>

        <NavLink
          to="/calendar"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] min-w-[48px] px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
              isActive
                ? "bg-secondary text-foreground font-semibold shadow-2xs"
                : "text-muted-foreground/80 hover:text-foreground"
            }`
          }
        >
          <Calendar className="size-4 mb-0.5" aria-hidden="true" />
          <span>Calendar</span>
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] min-w-[48px] px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
              isActive
                ? "bg-secondary text-foreground font-semibold shadow-2xs"
                : "text-muted-foreground/80 hover:text-foreground"
            }`
          }
          aria-label="Settings"
        >
          <Settings className="size-4 mb-0.5" aria-hidden="true" />
          <span>Settings</span>
        </NavLink>
      </nav>
    </div>
  )
}
