import { useEffect, useRef } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import captureImg from "../../assets/product/capture.png"
import notesImg from "../../assets/product/notes.png"

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger)
}

interface ShowcasePanel {
  id: string
  title: string
  sub: string
  url: string
  img: string
  alt: string
}

const SHOWCASE_PANELS: ShowcasePanel[] = [
  {
    id: "capture",
    title: "Unified Smart Capture",
    sub: "Type naturally. Praxis organizes and tags your thoughts instantly.",
    url: "praxis.internal/capture",
    img: captureImg,
    alt: "Praxis Capture interface showcasing categorized task and idea entries",
  },
  {
    id: "notes",
    title: "Reflective Knowledge Base",
    sub: "Clear typography and focused views for your long-term thoughts.",
    url: "praxis.internal/notes",
    img: notesImg,
    alt: "Praxis Notes interface displaying organized personal knowledge items",
  },
]

export function ProductSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<(HTMLElement | null)[]>([])
  const captionsRef = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const stage = stageRef.current
    const cards = cardsRef.current.filter((c): c is HTMLElement => c !== null)
    const captions = captionsRef.current.filter((c): c is HTMLDivElement => c !== null)

    if (!stage || cards.length < 2) return

    // Create matchMedia instance scoped to stage
    const mm = gsap.matchMedia(stage)

    mm.add(
      {
        isDesktop: "(min-width: 900px) and (prefers-reduced-motion: no-preference)",
        isTablet: "(min-width: 769px) and (max-width: 899px) and (prefers-reduced-motion: no-preference)",
        isMobile: "(max-width: 768px)",
        isReducedMotion: "(prefers-reduced-motion: reduce)",
      },
      (context) => {
        const { isDesktop, isTablet } = context.conditions as {
          isDesktop?: boolean
          isTablet?: boolean
          isMobile?: boolean
          isReducedMotion?: boolean
        }

        if (!isDesktop && !isTablet) {
          // Mobile / Reduced Motion: clean, accessible static flow
          return
        }

        const isDesk = Boolean(isDesktop)
        stage.classList.add("is-stacked")

        const card0 = cards[0]
        const card1 = cards[1]
        const caption0 = captions[0]
        const caption1 = captions[1]

        // Set initial positions
        gsap.set(card0, {
          y: 0,
          scale: 1,
          filter: "brightness(1)",
          transformOrigin: "center top",
          zIndex: 1,
        })

        // Card 1 starts offscreen below the viewport with 0 opacity to prevent visual clipping
        gsap.set(card1, {
          y: "85vh",
          scale: 0.96,
          opacity: 0,
          rotate: isDesk ? -0.35 : 0,
          transformOrigin: "center top",
          zIndex: 2,
        })

        if (caption0) {
          gsap.set(caption0, { opacity: 1, y: 0 })
        }
        if (caption1) {
          gsap.set(caption1, { opacity: 0, y: 14 })
        }

        // Pinned scrub timeline
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: stage,
            pin: true,
            start: "center center",
            end: () => `+=${isDesk ? 1200 : 900}`,
            scrub: 0.8,
            invalidateOnRefresh: true,
            anticipatePin: 1,
          },
        })

        // Step 1: Card 0 recedes (scales down, shifts up slightly, dims)
        tl.to(
          card0,
          {
            y: isDesk ? -34 : -24,
            scale: isDesk ? 0.94 : 0.96,
            filter: "brightness(0.68)",
            duration: 0.7,
            ease: "power2.inOut",
          },
          0
        )

        // Caption 0 smoothly crossfades out
        if (caption0) {
          tl.to(
            caption0,
            {
              opacity: 0,
              y: -12,
              duration: 0.35,
              ease: "power1.inOut",
            },
            0
          )
        }

        // Step 2: Card 1 enters and settles directly on top of Card 0
        tl.to(
          card1,
          {
            y: 0,
            scale: 1,
            opacity: 1,
            rotate: 0,
            duration: 0.7,
            ease: "power2.inOut",
          },
          0
        )

        // Caption 1 smoothly crossfades in
        if (caption1) {
          tl.to(
            caption1,
            {
              opacity: 1,
              y: 0,
              duration: 0.35,
              ease: "power1.out",
            },
            0.35
          )
        }

        // Step 3: Comfortable rest hold while pinned so user can inspect Card 2
        tl.to({}, { duration: 0.3 })

        return () => {
          stage.classList.remove("is-stacked")
        }
      }
    )

    // Recalculate ScrollTrigger on image loads to avoid layout shifts
    const onImgLoad = () => {
      ScrollTrigger.refresh()
    }
    const images = stage.querySelectorAll("img")
    images.forEach((img) => {
      if (!img.complete) {
        img.addEventListener("load", onImgLoad)
      }
    })

    return () => {
      images.forEach((img) => img.removeEventListener("load", onImgLoad))
      mm.revert()
    }
  }, [])

  return (
    <section
      id="product"
      ref={sectionRef}
      className="product-section"
      data-scroll-section="product"
      data-theme="dark"
      aria-labelledby="product-heading"
    >
      <div className="container">
        {/* Section Header */}
        <div className="product-header">
          <span className="product-eyebrow">THE INTERFACE</span>
          <h2 id="product-heading" className="product-headline">
            A place for everything on your mind.
          </h2>
          <p className="product-supporting">
            Bring your saved links, notes, ideas and tasks into one personal workspace.
          </p>
        </div>

        {/* Product Showcase Stacking Stage */}
        <div className="showcase-stack showcase-stack-stage" ref={stageRef}>
          {SHOWCASE_PANELS.map((item, index) => (
            <article
              key={item.id}
              ref={(el) => {
                cardsRef.current[index] = el
              }}
              className={`showcase-item showcase-card showcase-card-${index + 1}`}
              aria-labelledby={`showcase-${item.id}-title`}
            >
              <div
                ref={(el) => {
                  captionsRef.current[index] = el
                }}
                className="showcase-caption"
              >
                <span id={`showcase-${item.id}-title`} className="caption-label">
                  {item.title}
                </span>
                <span className="caption-sub">{item.sub}</span>
              </div>

              <div className="frame-browser">
                <div className="frame-chrome" aria-hidden="true">
                  <div className="chrome-dots">
                    <div className="chrome-dot" />
                    <div className="chrome-dot" />
                    <div className="chrome-dot" />
                  </div>
                  <span className="chrome-url">{item.url}</span>
                </div>
                <img
                  src={item.img}
                  alt={item.alt}
                  className="screenshot-img"
                  loading="eager"
                  width={1200}
                  height={750}
                />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
