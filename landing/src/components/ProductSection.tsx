import captureImg from "../../assets/product/capture.png"
import notesImg from "../../assets/product/notes.png"

export function ProductSection() {
  return (
    <section
      id="product"
      className="product-section"
      data-scroll-section="product"
      data-theme="dark"
      aria-labelledby="product-heading"
    >
      <div className="container">
        {/* Section Header */}
        <div className="product-header">
          <span className="product-eyebrow">
            THE INTERFACE
          </span>
          <h2 id="product-heading" className="product-headline">
            A place for everything on your mind.
          </h2>
          <p className="product-supporting">
            Bring your saved links, notes, ideas and tasks into one personal workspace.
          </p>
        </div>

        {/* Real Product Screenshots Showcase Stack */}
        <div className="showcase-stack">
          {/* Showcase Item 1: Smart Capture */}
          <article className="showcase-item" aria-labelledby="showcase-capture-title">
            <div className="showcase-caption">
              <span id="showcase-capture-title" className="caption-label">
                Unified Smart Capture
              </span>
              <span className="caption-sub">
                Type naturally. Praxis organizes and tags your thoughts instantly.
              </span>
            </div>

            <div className="frame-browser">
              <div className="frame-chrome" aria-hidden="true">
                <div className="chrome-dots">
                  <div className="chrome-dot" />
                  <div className="chrome-dot" />
                  <div className="chrome-dot" />
                </div>
                <span className="chrome-url">praxis.internal/capture</span>
              </div>
              <img
                src={captureImg}
                alt="Praxis Capture interface showcasing categorized task and idea entries"
                className="screenshot-img"
                loading="lazy"
                width={1200}
                height={750}
              />
            </div>
          </article>

          {/* Showcase Item 2: Organized Notes */}
          <article className="showcase-item" aria-labelledby="showcase-notes-title">
            <div className="showcase-caption">
              <span id="showcase-notes-title" className="caption-label">
                Reflective Knowledge Base
              </span>
              <span className="caption-sub">
                Clear typography and focused views for your long-term thoughts.
              </span>
            </div>

            <div className="frame-browser">
              <div className="frame-chrome" aria-hidden="true">
                <div className="chrome-dots">
                  <div className="chrome-dot" />
                  <div className="chrome-dot" />
                  <div className="chrome-dot" />
                </div>
                <span className="chrome-url">praxis.internal/notes</span>
              </div>
              <img
                src={notesImg}
                alt="Praxis Notes interface displaying organized personal knowledge items"
                className="screenshot-img"
                loading="lazy"
                width={1200}
                height={750}
              />
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
