import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/lib/theme/theme-context"

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      className={`relative inline-flex items-center justify-center size-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors ${
        className || ""
      }`}
    >
      <Sun
        className={`size-4 transition-transform duration-200 ${
          isDark ? "scale-0 -rotate-90 hidden" : "scale-100 rotate-0 block"
        }`}
        aria-hidden="true"
      />
      <Moon
        className={`size-4 transition-transform duration-200 ${
          isDark ? "scale-100 rotate-0 block" : "scale-0 rotate-90 hidden"
        }`}
        aria-hidden="true"
      />
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
