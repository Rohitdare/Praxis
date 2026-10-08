# Personal Memory App --- Design Specification

**Status:** Draft for implementation\
**Version:** 1.0\
**Date:** 2026-10-08\
**Purpose:** Define the visual system, information architecture,
screens, and interaction behavior. It is intentionally concrete enough
for implementation without turning the product into a generic AI
dashboard.

**Top principle:**\
\> **The application must remain useful when AI, the backend, and the
internet are unavailable. AI enhances captured data; it does not own the
capture workflow.**

## 1. Design principles

  ID      Principle
  ------- --------------------------------------------------------
  DP-01   Typography first
  DP-02   Capture is the primary interaction
  DP-03   Generous whitespace and calm density
  DP-04   Subtle borders instead of card-heavy layouts
  DP-05   Small accents, not gradients or glow
  DP-06   Fast feedback; asynchronous work is visually secondary
  DP-07   Mobile capture must be thumb-reachable
  DP-08   AI should feel like a suggestion, not a chatbot

**Anti-patterns:** gradient blobs, glowing AI badges, nested cards,
excessive glassmorphism, modal overload, dashboard walls, decorative 3D
graphics, large AI branding.

## 2. Information architecture

Desktop primary navigation:

``` text
Capture
Inbox
Search
Resources
Notes
Tasks
Calendar
Settings
```

Secondary/later:

``` text
Graph
Archive
Export
```

Mobile:

``` text
Capture
Inbox
Search
More
```

CaptureBar remains reachable from every primary screen.

## 3. Key flows

### DF-01 Quick capture online

``` mermaid
flowchart TD
A[Open app] --> B[Enter URL or text]
B --> C[Submit]
C --> D[Write to IndexedDB]
D --> E[Show Saved]
E --> F[Queue sync]
F --> G[Supabase]
G --> H[Optional enrichment]
```

### DF-02 Quick capture offline

``` mermaid
flowchart TD
A[Open installed PWA] --> B[Enter capture]
B --> C[IndexedDB]
C --> D[Saved offline]
D --> E[Outbox pending]
E --> F{Network returns}
F -->|Yes| G[Sync]
F -->|No| E
```

### DF-03 Android share capture

``` mermaid
flowchart TD
A[Chrome Share] --> B[PWA share target]
B --> C[Validate input]
C --> D[IndexedDB]
D --> E[Saved]
```

The Share Target API has limited browser availability; implementation
must be feature-detected and provide clipboard/open-app fallback. VERIFY
platform support during device testing.

### DF-04 AI suggestion

``` mermaid
flowchart TD
A[Captured item] --> B[Deterministic parsing]
B --> C{AI permitted?}
C -->|No| D[Remain unclassified]
C -->|Yes| E[AIProvider]
E --> F[Validate JSON]
F --> G[Suggestion chips]
G --> H{User decision}
H -->|Accept| I[Apply advisory fields]
H -->|Dismiss| J[Keep raw item]
```

## 4. Screen inventory

  ID       Screen        Purpose
  -------- ------------- --------------------------------
  SCR-01   Sign-in       Authentication
  SCR-02   Capture       Primary capture entry
  SCR-03   Inbox         Triage new items
  SCR-04   Item detail   View/edit online
  SCR-05   Search        Find saved items
  SCR-06   Resources     Resource-focused list
  SCR-07   Notes         Lightweight notes
  SCR-08   Tasks         Simple task list
  SCR-09   Calendar      Internal events
  SCR-10   Settings      Privacy, AI, account, export
  SCR-11   Graph         Later relationship exploration

## 5. Low-fidelity wireframes

### SCR-02 Mobile Capture

``` text
┌─────────────────────────┐
│ Personal Memory     ⋯   │
│                         │
│                         │
│ What do you want to     │
│ remember?               │
│                         │
│ ┌─────────────────────┐ │
│ │ Paste a link or     │ │
│ │ write anything...   │ │
│ │                     │ │
│ └─────────────────────┘ │
│                         │
│                [ Save ] │
│                         │
│ Inbox  Search  More     │
└─────────────────────────┘
```

### SCR-02 Desktop

``` text
┌──────────────────────────────────────────────────────┐
│ Personal Memory                         Search  ⚙    │
│                                                      │
│             What do you want to remember?            │
│                                                      │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Paste a link, idea, task, event or anything...   │ │
│ │                                                  │ │
│ └──────────────────────────────────────────────────┘ │
│                                         [ Save ]     │
│                                                      │
│ Recent captures                                      │
│ ───────────────────────────────────────────────────  │
│ 🔗 Component library                                 │
│ 💡 Project idea                                      │
│ ✓ Finish documentation                               │
└──────────────────────────────────────────────────────┘
```

### SCR-03 Inbox

``` text
Inbox                         7 items

[ All ] [ Resource ] [ Idea ] [ Task ] [ Event ]

🔗 React component library
   UI Inspiration · 2 min ago

💡 Build API documentation generator
   Idea · 18 min ago

✓ Finish DevRank SRS
   Tomorrow · 1 hr ago
```

### SCR-04 Item detail

``` text
← Inbox

React component library

https://example.com

Resource · UI Inspiration

[ Open link ]

Your notes
────────────────────────
...

AI suggestions
[ UI Inspiration ] [ React ]

[ Accept ] [ Dismiss ]
```

### SCR-05 Search

``` text
Search your memory...

"that component library for my portfolio"

Results
────────────────────────
React Bits
Magic UI
Shadcn
```

### SCR-10 Settings

``` text
Settings

Account
────────────────
Signed in as ...

Privacy
────────────────
AI processing                 OFF
Public resource AI            ON
Ideas/tasks AI                OFF
Sensitive notes               NEVER

Data
────────────────
Export all data
Backup
Sign out
```

### SCR-01 Sign-in

``` text
Personal Memory

Your private place to capture
things before you forget them.

[ Continue with Google ]

or

[ Send me a magic link ]
```

## 6. Capture behavior

-   Enter submits with desktop keyboard shortcut.
-   URLs are detected locally.
-   Common dates are parsed locally using the profile timezone.
-   Local save occurs before any network call.
-   Saved confirmation appears immediately.
-   `N unsynced` is visible only when relevant; it should not dominate
    the UI.
-   Sync failure is represented by a small status indicator and retry
    action.
-   AI suggestions appear later and never block the capture.

## 7. AI UI

AI suggestions are compact chips:

``` text
Suggested
[ Resource ] [ UI Inspiration ]

        Accept    Dismiss
```

Never show an AI chat panel during capture.

If AI is disabled:

> AI suggestions are off. Your capture will still be saved normally.

If an item is protected:

> This item is never sent to external AI.

If external processing occurs, the user can see what left the device
through the applicable privacy setting.

## 8. Design system

### Typography

**ASSUMPTION:** Use `Inter, ui-sans-serif, system-ui, sans-serif`
initially.

  Token       Size   Weight   Line height
  --------- ------ -------- -------------
  Display     32px      600          1.15
  H1          24px      600           1.2
  H2          18px      600           1.3
  Body        15px      400          1.55
  Small       13px      400          1.45
  Label       12px      500           1.3

### Color tokens

Semantic names only:

``` text
background
surface
surface-muted
border
text-primary
text-secondary
accent
success
warning
danger
```

Light and dark values must meet WCAG AA contrast targets. Avoid
hard-coded component colors.

### Spacing

Use a 4px base scale:

``` text
4 8 12 16 20 24 32 40 48 64
```

Radius: 8px default, 12px for primary input surfaces. Avoid excessive
rounded cards.

### Icons

Lucide React. Default 18px; 16px for dense metadata; 20-24px for primary
actions. Use consistent stroke width.

### Components

  Component        Key states
  ---------------- ------------------------------------------
  CaptureBar       empty, focused, saving, saved, offline
  ItemRow          default, hover, selected, archived
  SyncIndicator    synced, syncing, failed, offline
  SuggestionChip   suggested, accepted, dismissed
  Button           default, hover, focus, disabled, loading
  Input/Textarea   empty, focused, invalid, disabled
  Dialog           open, loading, error
  Command          search, empty, results
  EmptyState       contextual action
  Toast            success, warning, error

Use shadcn/ui as the base component source.

## 9. Motion

-   120-180 ms for micro interactions.
-   180-240 ms for panels/dialogs.
-   Prefer opacity/transform.
-   No continuous decorative animation.
-   Respect `prefers-reduced-motion`.

## 10. Responsive behavior

-   Mobile: single-column, bottom navigation, thumb-reachable capture.
-   Tablet: single content column with optional navigation rail.
-   Desktop: centered content with optional left navigation; capture
    remains visually dominant.
-   Minimum touch target: 44x44 CSS px.
-   Do not hide critical sync/privacy status on mobile.

## 11. Accessibility

Target WCAG 2.2 AA. All interactive elements keyboard reachable. Dialog
focus is trapped and restored. Screen readers receive meaningful labels
for sync and AI states. Color is never the only status signal.

## 12. Microcopy

  Situation        Copy
  ---------------- ------------------------------------------------------
  Saved online     Saved
  Saved offline    Saved offline --- will sync later
  Syncing          Syncing...
  Sync failed      Couldn't sync --- will retry
  AI unavailable   AI suggestions unavailable. Your capture is safe.
  AI disabled      AI suggestions are off
  Protected note   This item is never sent to external AI
  Empty inbox      Nothing waiting. Capture something when you find it.
  Search empty     Nothing found. Try a different phrase.

## 13. PWA/platform

-   Provide installable manifest and app shell.
-   Cache only the minimum app shell required for capture.
-   Never cache private server responses in a shared/public cache.
-   Feature-detect Web Share / Share Target.
-   iOS limitations must be validated on a real iPhone before declaring
    share-target parity.

## 14. Traceability

  Screen   Requirements
  -------- ----------------------
  SCR-01   FR-33
  SCR-02   FR-01..05
  SCR-03   FR-06..08
  SCR-04   FR-09..15, FR-25..30
  SCR-05   FR-18..20
  SCR-06   FR-09..11
  SCR-07   FR-12..13
  SCR-08   FR-14..15
  SCR-09   FR-16..17
  SCR-10   FR-29..32
  SCR-11   FR-21..23

## Assumptions

-   **ASSUMPTION D-01:** Inter is acceptable as the initial UI font.
-   **ASSUMPTION D-02:** Mobile primary navigation can be limited to
    Capture, Inbox, Search, More.
-   **ASSUMPTION D-03:** Calendar is internal only.

## Open questions

None blocking implementation.

## Objections

**D-OBJ-01:** Web Share Target should not be treated as universally
available; keep fallback capture paths.
