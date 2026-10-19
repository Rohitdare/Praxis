import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { ItemRow } from "@/components/inbox/item-row"
import type { InboxItem } from "@/lib/inbox/service"

describe("ItemRow Title & Snippet Display", () => {
  it("displays note title instead of 'Untitled Note' raw_input when title is provided", () => {
    const itemWithTitle: InboxItem = {
      id: "note-1",
      user_id: "user-123",
      raw_input: "Untitled Note",
      title: "testing",
      content: "testing the issue .",
      type: "note",
      status: "active",
      captured_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      synced: true,
    }

    render(
      <MemoryRouter>
        <ItemRow item={itemWithTitle} onDelete={vi.fn()} />
      </MemoryRouter>
    )

    // Should display the custom title "testing"
    expect(screen.getByText("testing")).toBeInTheDocument()
    // Should NOT display "Untitled Note"
    expect(screen.queryByText("Untitled Note")).not.toBeInTheDocument()
    // Should display the snippet
    expect(screen.getByText("testing the issue .")).toBeInTheDocument()
  })

  it("falls back to raw_input for raw captured items without custom titles", () => {
    const rawCaptureItem: InboxItem = {
      id: "capture-1",
      user_id: "user-123",
      raw_input: "https://example.com/useful-article",
      title: null,
      content: null,
      type: "resource",
      status: "inbox",
      captured_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      synced: true,
    }

    render(
      <MemoryRouter>
        <ItemRow item={rawCaptureItem} onDelete={vi.fn()} />
      </MemoryRouter>
    )

    expect(screen.getByText("https://example.com/useful-article")).toBeInTheDocument()
  })

  it("derives display title from content first line if title is generic 'Untitled Note'", () => {
    const itemWithContentOnly: InboxItem = {
      id: "note-2",
      user_id: "user-123",
      raw_input: "Untitled Note",
      title: "Untitled Note",
      content: "Call dentist tomorrow at 9am\nAsk about cleaning",
      type: "note",
      status: "active",
      captured_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      synced: true,
    }

    render(
      <MemoryRouter>
        <ItemRow item={itemWithContentOnly} onDelete={vi.fn()} />
      </MemoryRouter>
    )

    expect(screen.getByText("Call dentist tomorrow at 9am")).toBeInTheDocument()
    expect(screen.queryByText("Untitled Note")).not.toBeInTheDocument()
  })
})
