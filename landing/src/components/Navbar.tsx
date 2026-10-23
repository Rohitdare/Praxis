import logoImg from "../../assets/brand/Minimalist Praxis Cat Logo.png"

interface NavbarProps {
  appUrl?: string
}

export function Navbar({ appUrl = "http://localhost:5173" }: NavbarProps) {
  return (
    <header className="navbar" role="banner">
      <div className="container nav-container">
        <a href="#hero" className="brand-link" aria-label="Praxis Home">
          <img
            src={logoImg}
            alt="Praxis Logo"
            className="brand-logo"
            width={34}
            height={34}
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
