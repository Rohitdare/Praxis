import { ArrowUpRight } from "lucide-react"
import logoImg from "../../assets/brand/Minimalist Praxis Cat Logo.png"

interface ClosingSectionProps {
  appUrl?: string
}

export function ClosingSection({ appUrl = "http://localhost:5173" }: ClosingSectionProps) {
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

      {/* Minimalistic Dark Ending Rail */}
      <footer className="landing-footer" role="contentinfo">
        <div className="container footer-container">
          <div className="footer-brand">
            <img
              src={logoImg}
              alt="Praxis Logo"
              className="footer-logo"
              width={22}
              height={22}
            />
            <span>Praxis</span>
          </div>

          <p className="footer-note">
            Quiet personal workspace. Built for longevity.
          </p>
        </div>
      </footer>
    </section>
  )
}
