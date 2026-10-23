import { ArrowUpRight } from "lucide-react"

interface ClosingSectionProps {
  appUrl?: string
}

export function ClosingSection({ appUrl = "https://praxis-memo.vercel.app/" }: ClosingSectionProps) {
  return (
    <section
      id="closing"
      className="closing-section"
      data-scroll-section="closing"
      data-theme="dark"
      aria-labelledby="closing-heading"
    >
      <div className="container">
        <div className="closing-content">
          <h2 id="closing-heading" className="closing-headline">
            Everything, in its place.
          </h2>

          <p className="closing-supporting">
            Capture what matters. Find it when you need it.
          </p>

          <div className="closing-actions">
            <a
              href={appUrl}
              className="closing-btn"
              aria-label="Open Praxis workspace"
            >
              <span>Open Praxis</span>
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
