import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { RecentCaptures } from "@/components/capture/recent-captures"
import type { LocalItem } from "@/lib/db/schema"

describe("RecentCaptures Component", () => {
  const mockItems: LocalItem[] = [
    {
      id: "capture-uuid-1",
      user_id: "user-1",
      raw_input: "https://example.com/article Helpful guide",
      title: "Helpful guide",
      content: null,
      type: "resource",
      status: "inbox",
      captured_at: new Date(Date.now() - 60000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      synced: true,
    },
    {
      id: "capture-uuid-2",
      user_id: "user-1",
      raw_input: "Remember to buy milk and eggs",
      title: null,
      content: null,
      type: "note",
      status: "inbox",
      captured_at: new Date(Date.now() - 120000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      synced: false,
    },
  ]

  it("renders recent capture items as clickable links to /items/:id", () => {
    render(
      <MemoryRouter>
        <RecentCaptures items={mockItems} />
      </MemoryRouter>
    )

    const links = screen.getAllByRole("link")
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute("href", "/items/capture-uuid-1")
    expect(links[1]).toHaveAttribute("href", "/items/capture-uuid-2")

    expect(screen.getByText("Helpful guide")).toBeInTheDocument()
    expect(screen.getByText("Remember to buy milk and eggs")).toBeInTheDocument()
  })

  it("navigates to the specific capture edit route when clicked", async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={["/capture"]}>
        <Routes>
          <Route path="/capture" element={<RecentCaptures items={mockItems} />} />
          <Route path="/items/:id" element={<div data-testid="item-editor">Item Editor Screen</div>} />
        </Routes>
      </MemoryRouter>
    )

    const secondCaptureLink = screen.getByRole("link", {
      name: /Remember to buy milk and eggs/i,
    })
    await user.click(secondCaptureLink)

    expect(screen.getByTestId("item-editor")).toBeInTheDocument()
  })

  it("renders empty state placeholder when no items exist", () => {
    render(
      <MemoryRouter>
        <RecentCaptures items={[]} />
      </MemoryRouter>
    )

    expect(screen.getByText(/No captures yet/i)).toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  it("renders loading skeleton when isLoading is true", () => {
    render(
      <MemoryRouter>
        <RecentCaptures items={[]} isLoading={true} />
      </MemoryRouter>
    )

    expect(screen.getByLabelText("Loading recent captures")).toBeInTheDocument()
  })
})
