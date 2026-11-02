import { useEffect, useRef, useState, useCallback } from "react"
import gsap from "gsap"

interface FooterCatProps {
  containerRef: React.RefObject<HTMLDivElement | null>
  lettersRef: React.RefObject<(HTMLSpanElement | null)[]>
  activeLetterIndex: number
  isHopped?: boolean
}

export function FooterCat({
  containerRef,
  lettersRef,
  activeLetterIndex,
  isHopped = false,
}: FooterCatProps) {
  const [facing, setFacing] = useState<1 | -1>(1)
  const [isWalking, setIsWalking] = useState<boolean>(false)
  const [isCurious, setIsCurious] = useState<boolean>(false)
  const [isHappy, setIsHappy] = useState<boolean>(false)

  const catRef = useRef<HTMLDivElement>(null)
  const animTimelineRef = useRef<gsap.core.Timeline | null>(null)
  const currentPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const currentIndexRef = useRef<number>(1)
  const initializedRef = useRef<boolean>(false)

  // Calculate coordinates for a letter index
  const getLetterPosition = useCallback(
    (index: number) => {
      const container = containerRef.current
      const letters = lettersRef.current
      if (!container || !letters || !letters[index]) return null

      const letterEl = letters[index]
      const containerRect = container.getBoundingClientRect()
      const letterRect = letterEl.getBoundingClientRect()

      // Horizontal center with slight typographic adjustments
      let xOffset = 0
      if (index === 0) xOffset = 4 // 'P'
      if (index === 1) xOffset = -2 // 'R'
      if (index === 2) xOffset = 0 // 'A'
      if (index === 3) xOffset = 0 // 'X'
      if (index === 4) xOffset = 0 // 'I'
      if (index === 5) xOffset = -4 // 'S'

      const x = letterRect.left - containerRect.left + letterRect.width / 2 + xOffset
      // Target Y is the top baseline of the letter serif
      const y = letterRect.top - containerRect.top

      return { x, y }
    },
    [containerRef, lettersRef]
  )

  // Move cat to a specific letter
  const moveToLetter = useCallback(
    (newIndex: number, hop: boolean = false) => {
      if (!catRef.current) return
      const targetPos = getLetterPosition(newIndex)
      if (!targetPos) return

      // Determine facing direction
      const currentX = currentPosRef.current.x
      const direction: 1 | -1 = targetPos.x >= currentX ? 1 : -1
      setFacing(direction)

      // Calculate travel distance and duration
      const distance = Math.abs(targetPos.x - currentX)
      const duration = hop ? 0.45 : Math.max(0.35, Math.min(1.1, (distance / 480) * 0.85))

      // Kill previous timeline
      if (animTimelineRef.current) {
        animTimelineRef.current.kill()
      }

      setIsWalking(true)
      setIsCurious(true)

      const tl = gsap.timeline({
        onComplete: () => {
          setIsWalking(false)
          currentIndexRef.current = newIndex
          currentPosRef.current = targetPos
          setIsHappy(true)
          setTimeout(() => setIsHappy(false), 700)
          setTimeout(() => setIsCurious(false), 1800)
        },
      })

      animTimelineRef.current = tl

      if (hop) {
        const midY = Math.min(currentPosRef.current.y, targetPos.y) - 26
        tl.to(catRef.current, {
          x: targetPos.x,
          duration,
          ease: "power2.out",
        })
        tl.to(
          catRef.current,
          {
            y: midY,
            duration: duration * 0.4,
            ease: "power2.out",
          },
          0
        )
        tl.to(
          catRef.current,
          {
            y: targetPos.y,
            duration: duration * 0.6,
            ease: "bounce.out",
          },
          duration * 0.4
        )
      } else {
        tl.to(catRef.current, {
          x: targetPos.x,
          y: targetPos.y,
          duration,
          ease: "power2.inOut",
        })
      }
    },
    [getLetterPosition]
  )

  // Reactively respond to active letter changes
  useEffect(() => {
    if (!initializedRef.current) {
      // First mount: place cat at initial target (R)
      const timer = setTimeout(() => {
        const pos = getLetterPosition(activeLetterIndex)
        if (pos && catRef.current) {
          currentPosRef.current = pos
          currentIndexRef.current = activeLetterIndex
          gsap.set(catRef.current, { x: pos.x, y: pos.y })
          initializedRef.current = true
        }
      }, 50)
      return () => clearTimeout(timer)
    }

    if (activeLetterIndex !== currentIndexRef.current) {
      moveToLetter(activeLetterIndex, isHopped)
    }
  }, [activeLetterIndex, isHopped, getLetterPosition, moveToLetter])

  // Recalculate on window resize
  useEffect(() => {
    const handleResize = () => {
      const pos = getLetterPosition(currentIndexRef.current)
      if (pos && catRef.current) {
        currentPosRef.current = pos
        gsap.set(catRef.current, { x: pos.x, y: pos.y })
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [getLetterPosition])

  return (
    <div
      ref={catRef}
      className={`praxis-footer-cat ${isWalking ? "is-walking" : "is-sitting"} ${
        isCurious ? "is-curious" : ""
      } ${isHappy ? "is-happy" : ""}`}
      aria-hidden="true"
    >
      <div
        className="cat-visual-wrap"
        style={{
          transform: `scaleX(${facing})`,
          transition: "transform 0.22s ease-out",
        }}
      >
        <svg
          viewBox="0 0 76 60"
          className="cat-svg"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="catPawShadow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#000000" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Contact shadow resting on letter serif */}
          <ellipse
            cx="38"
            cy="56"
            rx="20"
            ry="3.5"
            fill="url(#catPawShadow)"
            className="cat-shadow"
          />

          {/* Animated Tail */}
          <path
            d="M 18 42 C 11 40 5 33 6 25 C 7 19 12 18 13 21 C 14 24 10 28 12 34 C 13 37 17 39 20 41"
            className="cat-tail"
            stroke="#EDE8DE"
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 18 42 C 11 40 5 33 6 25 C 7 19 12 18 13 21 C 14 24 10 28 12 34 C 13 37 17 39 20 41"
            className="cat-tail-inner"
            stroke="#191918"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />

          {/* Back Paws */}
          <ellipse
            cx="24"
            cy="52"
            rx="5.5"
            ry="4"
            fill="#1E1E1D"
            stroke="#EDE8DE"
            strokeWidth="1.2"
            className="cat-paw cat-paw-back"
          />

          {/* Main Cat Torso / Body */}
          <path
            d="M 21 48 C 18 42 19 32 25 26 C 31 20 43 21 50 25 C 55 28 58 35 57 43 C 56 48 50 51 40 51 C 30 51 24 50 21 48 Z"
            fill="#191918"
            stroke="#EDE8DE"
            strokeWidth="1.6"
            className="cat-body"
          />

          {/* Front Paws resting on letter top */}
          <g className="cat-front-paws">
            <rect
              x="42"
              y="44"
              width="6.5"
              height="10"
              rx="3.2"
              fill="#191918"
              stroke="#EDE8DE"
              strokeWidth="1.2"
              className="cat-paw cat-paw-fl"
            />
            <rect
              x="49"
              y="44"
              width="6.5"
              height="10"
              rx="3.2"
              fill="#191918"
              stroke="#EDE8DE"
              strokeWidth="1.2"
              className="cat-paw cat-paw-fr"
            />
          </g>

          {/* Praxis Warm Orange Sparkle Collar Tag */}
          <circle cx="50" cy="33" r="2.2" fill="#F76F31" className="cat-sparkle-tag" />

          {/* Cat Head */}
          <g className="cat-head">
            {/* Left Ear */}
            <polygon
              points="42,20 47,8 52,18"
              fill="#191918"
              stroke="#EDE8DE"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <polygon points="44,18 47,11 50,17" fill="#E8DDD0" opacity="0.8" />

            {/* Right Ear */}
            <polygon
              points="53,19 60,9 63,21"
              fill="#191918"
              stroke="#EDE8DE"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <polygon points="55,18 59,12 61,19" fill="#E8DDD0" opacity="0.8" />

            {/* Head Silhouette */}
            <ellipse
              cx="52"
              cy="25"
              rx="12.5"
              ry="10.5"
              fill="#191918"
              stroke="#EDE8DE"
              strokeWidth="1.6"
            />

            {/* Eyes */}
            {isHappy ? (
              <g stroke="#EDE8DE" strokeWidth="1.4" strokeLinecap="round" fill="none">
                <path d="M 46 25 Q 48 23 50 25" />
                <path d="M 54 25 Q 56 23 58 25" />
              </g>
            ) : isWalking || isCurious ? (
              <g>
                <ellipse cx="48" cy="24" rx="2.4" ry="2.8" fill="#EDE8DE" />
                <ellipse cx="48.5" cy="24" rx="1.1" ry="2" fill="#191918" />
                <ellipse cx="56" cy="24" rx="2.4" ry="2.8" fill="#EDE8DE" />
                <ellipse cx="56.5" cy="24" rx="1.1" ry="2" fill="#191918" />
              </g>
            ) : (
              <g stroke="#EDE8DE" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.85">
                <path d="M 46 25 Q 48 27 50 25" />
                <path d="M 54 25 Q 56 27 58 25" />
              </g>
            )}

            {/* Tiny Cute Nose */}
            <polygon points="51,28 53,28 52,29.4" fill="#F76F31" opacity="0.95" />

            {/* Whisker hints */}
            <g stroke="#EDE8DE" strokeWidth="0.8" opacity="0.4" strokeLinecap="round">
              <line x1="42" y1="28" x2="36" y2="27" />
              <line x1="42" y1="30" x2="36" y2="31" />
              <line x1="62" y1="28" x2="68" y2="27" />
              <line x1="62" y1="30" x2="68" y2="31" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  )
}
