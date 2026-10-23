import praxisIconSvg from "../../assets/brand/praxis-icon.svg"

interface NavbarProps {
  appUrl?: string
}

export function Navbar({ appUrl = "https://praxis-memo.vercel.app/" }: NavbarProps) {
  return (
    <header className="navbar" role="banner">
      <div className="container nav-container">
        <a href="#hero" className="brand-link" aria-label="Praxis Home">
          <img
            src={praxisIconSvg}
            alt="Praxis Logo"
            className="brand-logo-svg"
            width={28}
            height={31}
          />
          <span className="brand-name font-serif">Praxis</span>
        </a>

        <nav aria-label="Main Navigation">
          <a
            href={appUrl}
            className="nav-cta-btn"
            target="_self"
            rel="noopener noreferrer"
            aria-label="Open Praxis workspace"
          >
            Open Praxis
          </a>
        </nav>
      </div>
    </header>
  )
}
