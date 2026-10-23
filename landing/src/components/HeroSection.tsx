import type { MouseEvent } from "react"
import { ArrowDown, ArrowUpRight } from "lucide-react"

import noteCardImg from "../../assets/animate/Praxis Note Card Mockup.webp"
import linkCardImg from "../../assets/animate/Design Inspiration Link Card.webp"
import todoCardImg from "../../assets/animate/Minimalist Today To-Do Card.webp"
import visualCardImg from "../../assets/animate/Praxis Visual Ideas Card.webp"
import countrysideImg from "../../assets/animate/Serene Countryside Beneath Summer Skies.png"

interface HeroSectionProps {
  appUrl?: string
}

export function HeroSection({ appUrl = "https://praxis-memo.vercel.app/" }: HeroSectionProps) {
  const handleScrollToWorkflow = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const target = document.getElementById("workflow")
    if (target) {
      target.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <section
      id="hero"
      className="hero-section"
      data-scroll-section="hero"
      data-theme="light"
      aria-labelledby="hero-heading"
    >
      {/* Cinematic Countryside Illustration Background */}
      <div className="hero-cinematic-bg" aria-hidden="true">
        <img
          src={countrysideImg}
          alt=""
          className="hero-countryside-img"
          loading="eager"
          decoding="async"
          width={1672}
          height={941}
        />
      </div>

      <div className="container hero-container">
        {/* Four Independent Floating Artifact Cards framing the headline on Desktop */}
        
        {/* Card 1: Note Card (Top-Left) */}
        <div
          className="hero-card hero-card-top-left"
          data-card-id="note-card"
          aria-hidden="true"
        >
          <div className="card-paper-wrapper">
            <img
              src={noteCardImg}
              alt="Praxis Note Card: quick thoughts and reflections"
              className="card-media"
              loading="eager"
              width={340}
              height={255}
            />
          </div>
        </div>

        {/* Card 2: Link Card (Top-Right) */}
        <div
          className="hero-card hero-card-top-right"
          data-card-id="link-card"
          aria-hidden="true"
        >
          <div className="card-paper-wrapper">
            <img
              src={linkCardImg}
              alt="Design Inspiration Link Card: saved references with live previews"
              className="card-media"
              loading="eager"
              width={360}
              height={270}
            />
          </div>
        </div>

        {/* Center: Core Editorial Content */}
        <div className="hero-content">
          <span className="eyebrow" aria-label="Product Category">
            YOUR PERSONAL WORKSPACE
          </span>

          <h1 id="hero-heading" className="hero-headline">
            <span>Everything worth keeping.</span>{" "}
            <em className="headline-emphasis">One place.</em>
          </h1>

          <p className="hero-supporting">
            Capture your ideas, links and everyday tasks. Find them when you need them.
          </p>

          <div className="hero-actions">
            <a
              href={appUrl}
              className="primary-btn"
              aria-label="Open Praxis personal workspace"
            >
              <span>Open Praxis</span>
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </a>

            <a
              href="#workflow"
              onClick={handleScrollToWorkflow}
              className="scroll-cue"
              aria-label="Scroll down to explore your workspace"
            >
              <span>Explore your workspace</span>
              <ArrowDown className="size-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>

        {/* Card 3: Today To-Do Card (Bottom-Left) */}
        <div
          className="hero-card hero-card-bottom-left"
          data-card-id="todo-card"
          aria-hidden="true"
        >
          <div className="card-paper-wrapper">
            <img
              src={todoCardImg}
              alt="Minimalist Today To-Do Card: focused daily checklist"
              className="card-media"
              loading="eager"
              width={330}
              height={245}
            />
          </div>
        </div>

        {/* Card 4: Visual Ideas Card (Bottom-Right) */}
        <div
          className="hero-card hero-card-bottom-right"
          data-card-id="visual-card"
          aria-hidden="true"
        >
          <div className="card-paper-wrapper">
            <img
              src={visualCardImg}
              alt="Praxis Visual Ideas Card: creative moodboards and references"
              className="card-media"
              loading="eager"
              width={350}
              height={265}
            />
          </div>
        </div>

        {/* Mobile/Tablet Fallback Card Flow (only visible on <=1024px) */}
        <div className="hero-mobile-cards" aria-label="Supplied workspace cards preview">
          <div className="mobile-card-item">
            <img
              src={noteCardImg}
              alt="Praxis Note Card"
              className="mobile-card-img"
              loading="eager"
            />
          </div>
          <div className="mobile-card-item">
            <img
              src={linkCardImg}
              alt="Design Inspiration Link Card"
              className="mobile-card-img"
              loading="eager"
            />
          </div>
          <div className="mobile-card-item">
            <img
              src={todoCardImg}
              alt="Minimalist Today To-Do Card"
              className="mobile-card-img"
              loading="eager"
            />
          </div>
          <div className="mobile-card-item">
            <img
              src={visualCardImg}
              alt="Praxis Visual Ideas Card"
              className="mobile-card-img"
              loading="eager"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
