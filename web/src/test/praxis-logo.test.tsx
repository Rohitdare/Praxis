import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { PraxisLogo } from "@/components/branding/praxis-logo"

describe("PraxisLogo Component", () => {
  it("renders full logo variant by default with light and dark mode images", () => {
    render(<PraxisLogo />)
    const images = screen.getAllByRole("img", { name: "Praxis" })
    expect(images.length).toBe(2)

    const lightLogo = images.find((img) => img.getAttribute("src")?.includes("praxis-logo.svg"))
    const darkLogo = images.find((img) => img.getAttribute("src")?.includes("praxis-logo-dark.svg"))

    expect(lightLogo).toBeInTheDocument()
    expect(lightLogo).toHaveClass("dark:hidden")

    expect(darkLogo).toBeInTheDocument()
    expect(darkLogo).toHaveClass("dark:block")
  })

  it("renders standalone icon variant with praxis-icon.svg", () => {
    render(<PraxisLogo variant="icon" alt="Praxis Symbol" />)
    const icon = screen.getByRole("img", { name: "Praxis Symbol" })
    expect(icon).toBeInTheDocument()
    expect(icon.getAttribute("src")).toBe("/branding/praxis-icon.svg")
  })

  it("renders wordmark variant with Praxis text", () => {
    render(<PraxisLogo variant="wordmark" />)
    const wordmark = screen.getByText("Praxis")
    expect(wordmark).toBeInTheDocument()
    expect(wordmark).toHaveClass("font-heading")
  })

  it("applies size presets accurately", () => {
    const { rerender } = render(<PraxisLogo variant="icon" size="sm" alt="Small Icon" />)
    expect(screen.getByRole("img", { name: "Small Icon" })).toHaveClass("h-6")

    rerender(<PraxisLogo variant="icon" size="lg" alt="Large Icon" />)
    expect(screen.getByRole("img", { name: "Large Icon" })).toHaveClass("h-12")
  })

  it("supports custom className and contrastContainer", () => {
    const { container } = render(
      <PraxisLogo variant="icon" size="sm" className="custom-test-class" contrastContainer />
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass("custom-test-class")
    expect(wrapper).toHaveClass("rounded-md")
  })
})
