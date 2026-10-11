import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { ThemeProvider, useTheme } from "@/lib/theme/theme-context"
import { ThemeToggle } from "@/components/theme/theme-toggle"

function TestConsumer() {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <span data-testid="resolved-value">{resolvedTheme}</span>
      <button onClick={() => setTheme("dark")}>Set Dark</button>
      <button onClick={() => setTheme("light")}>Set Light</button>
      <button onClick={() => setTheme("system")}>Set System</button>
      <button onClick={toggleTheme}>Toggle</button>
      <ThemeToggle />
    </div>
  )
}

describe("Theme System (Light/Dark/System + Persistence)", () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove("dark", "light")
  })

  it("1. defaults to light when no preference and matchMedia is light", () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    )

    expect(screen.getByTestId("theme-value")).toHaveTextContent("system")
    expect(screen.getByTestId("resolved-value")).toHaveTextContent("light")
  })

  it("2. initializes from localStorage when stored value exists", () => {
    localStorage.setItem("pm-theme", "dark")

    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    )

    expect(screen.getByTestId("theme-value")).toHaveTextContent("dark")
    expect(screen.getByTestId("resolved-value")).toHaveTextContent("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  it("3. toggles theme and persists to localStorage", async () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    )

    const toggleButton = screen.getByRole("button", { name: /switch to dark mode/i })
    await userEvent.click(toggleButton)

    expect(screen.getByTestId("theme-value")).toHaveTextContent("dark")
    expect(screen.getByTestId("resolved-value")).toHaveTextContent("dark")
    expect(localStorage.getItem("pm-theme")).toBe("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)

    // Toggle back to light
    const toggleBack = screen.getByRole("button", { name: /switch to light mode/i })
    await userEvent.click(toggleBack)

    expect(screen.getByTestId("theme-value")).toHaveTextContent("light")
    expect(screen.getByTestId("resolved-value")).toHaveTextContent("light")
    expect(localStorage.getItem("pm-theme")).toBe("light")
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })

  it("4. explicitly sets theme to dark, light, and system", async () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    )

    await userEvent.click(screen.getByRole("button", { name: "Set Dark" }))
    expect(screen.getByTestId("theme-value")).toHaveTextContent("dark")
    expect(localStorage.getItem("pm-theme")).toBe("dark")

    await userEvent.click(screen.getByRole("button", { name: "Set Light" }))
    expect(screen.getByTestId("theme-value")).toHaveTextContent("light")
    expect(localStorage.getItem("pm-theme")).toBe("light")

    await userEvent.click(screen.getByRole("button", { name: "Set System" }))
    expect(screen.getByTestId("theme-value")).toHaveTextContent("system")
    expect(localStorage.getItem("pm-theme")).toBe("system")
  })

  it("5. useTheme hook provides fallback defaults when outside ThemeProvider", () => {
    render(<TestConsumer />)

    expect(screen.getByTestId("theme-value")).toHaveTextContent("light")
    expect(screen.getByTestId("resolved-value")).toHaveTextContent("light")
  })
})
