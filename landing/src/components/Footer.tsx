import type { MouseEvent } from "react"
import { ArrowUpRight } from "lucide-react"
import praxisIconSvg from "../../assets/brand/praxis-icon.svg"

interface FooterProps {
  appUrl?: string
}

export function Footer({ appUrl = "https://praxis-memo.vercel.app/" }: FooterProps) {
  const currentYear = new Date().getFullYear()

  const handleSmoothScroll = (e: MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault()
    const target = document.getElementById(targetId)
    if (target) {
      target.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <footer className="praxis-footer" role="contentinfo">
      {/* Part A: Refined Dark Editorial Invitation Card */}
      <section className="footer-intro-section" aria-label="Footer Introduction">
        <div className="container">
          <div className="footer-intro-card">
            <span className="footer-intro-eyebrow">A PLACE FOR WHAT MATTERS</span>
            <h2 className="footer-intro-statement font-serif">
              We&apos;ve got room for your next idea.
            </h2>
            <p className="footer-intro-sub">
              Keep your thoughts, resources and plans close in a quiet, personal space.
            </p>
            <a
              href={appUrl}
              className="footer-intro-cta"
              aria-label="Explore Praxis workspace"
            >
              <span>Explore Praxis</span>
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      {/* Part B & C & D: Deep Dark Footer Panel */}
      <div className="footer-dark-panel">
        <div className="container footer-panel-container">
          {/* Part B: Three Compact Navigation Columns */}
          <nav className="footer-nav-grid" aria-label="Footer Navigation">
            {/* Column 1: PRAXIS */}
            <div className="footer-col">
              <h3 className="footer-col-heading">Praxis</h3>
              <ul className="footer-link-list">
                <li>
                  <a
                    href="#hero"
                    onClick={(e) => handleSmoothScroll(e, "hero")}
                    className="footer-link"
                  >
                    About Praxis
                  </a>
                </li>
                <li>
                  <a
                    href="#workflow"
                    onClick={(e) => handleSmoothScroll(e, "workflow")}
                    className="footer-link"
                  >
                    How it works
                  </a>
                </li>
                <li>
                  <a
                    href="#product"
                    onClick={(e) => handleSmoothScroll(e, "product")}
                    className="footer-link"
                  >
                    Explore the workspace
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 2: WORKSPACE */}
            <div className="footer-col">
              <h3 className="footer-col-heading">Your workspace</h3>
              <ul className="footer-link-list">
                <li>
                  <a
                    href="#product"
                    onClick={(e) => handleSmoothScroll(e, "product")}
                    className="footer-link"
                  >
                    Capture ideas
                  </a>
                </li>
                <li>
                  <a
                    href="#workflow"
                    onClick={(e) => handleSmoothScroll(e, "workflow")}
                    className="footer-link"
                  >
                    Notes and reflections
                  </a>
                </li>
                <li>
                  <a
                    href="#workflow"
                    onClick={(e) => handleSmoothScroll(e, "workflow")}
                    className="footer-link"
                  >
                    Saved resources
                  </a>
                </li>
                <li>
                  <a
                    href="#closing"
                    onClick={(e) => handleSmoothScroll(e, "closing")}
                    className="footer-link"
                  >
                    Tasks and planning
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 3: CONNECT */}
            <div className="footer-col">
              <h3 className="footer-col-heading">Connect</h3>
              <ul className="footer-link-list">
                <li>
                  <a
                    href="https://github.com/Rohitdare/Praxis"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-link external-link"
                  >
                    <span>GitHub</span>
                    <ArrowUpRight className="size-3" aria-hidden="true" />
                  </a>
                </li>
                <li>
                  <a
                    href={appUrl}
                    className="footer-link"
                  >
                    Launch Web App
                  </a>
                </li>
                <li>
                  <span className="footer-text-muted">
                    Offline-first &amp; Private
                  </span>
                </li>
              </ul>
            </div>
          </nav>

          {/* Part C: Oversized Praxis Wordmark with Subtle Character Interaction */}
          <div className="footer-wordmark-container" aria-label="Praxis Wordmark">
            <h2 className="footer-wordmark font-serif" aria-label="PRAXIS">
              {"PRAXIS".split("").map((char, index) => (
                <span
                  key={index}
                  className="wordmark-char"
                  style={{ "--char-index": index } as React.CSSProperties}
                >
                  {char}
                </span>
              ))}
            </h2>
          </div>

          {/* Part D: Bottom Legal Row with Thin Divider */}
          <div className="footer-bottom-row">
            <div className="footer-bottom-left">
              <a href="#hero" onClick={(e) => handleSmoothScroll(e, "hero")} className="footer-bottom-brand">
                <img
                  src={praxisIconSvg}
                  alt="Praxis Logo"
                  className="footer-bottom-logo"
                  width={18}
                  height={20}
                />
                <span className="footer-bottom-name font-serif">Praxis</span>
              </a>
              <span className="footer-bottom-dot" aria-hidden="true">·</span>
              <span className="footer-tagline">A quieter place for what matters.</span>
            </div>

            <div className="footer-bottom-right">
              <span className="footer-copyright">
                © {currentYear} Praxis. Local-first personal workspace.
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
