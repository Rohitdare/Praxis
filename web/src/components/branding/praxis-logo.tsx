import * as React from "react"

export interface PraxisLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Logo variant:
   * - "full": Standalone symbol + Praxis wordmark
   * - "icon": Standalone cat-and-P symbol with orange sparkle
   * - "wordmark": Stylized geometric Praxis wordmark only
   */
  variant?: "full" | "icon" | "wordmark"
  /**
   * Predefined size presets or custom styling via className
   */
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  /**
   * Accessible alternative text
   */
  alt?: string
  /**
   * If true, wraps symbol with subtle background container on dark themes for maximum contrast
   */
  contrastContainer?: boolean
}

const sizeConfig = {
  xs: {
    icon: "h-5 w-auto",
    full: "h-7 w-auto",
    wordmark: "text-sm",
  },
  sm: {
    icon: "h-6 w-auto",
    full: "h-9 w-auto",
    wordmark: "text-base",
  },
  md: {
    icon: "h-8 w-auto",
    full: "h-12 w-auto",
    wordmark: "text-xl",
  },
  lg: {
    icon: "h-12 w-auto",
    full: "h-20 w-auto",
    wordmark: "text-2xl",
  },
  xl: {
    icon: "h-16 w-auto",
    full: "h-28 w-auto",
    wordmark: "text-3xl",
  },
}

export function PraxisLogo({
  variant = "full",
  size = "md",
  alt = "Praxis",
  className = "",
  contrastContainer = false,
  ...props
}: PraxisLogoProps) {
  const currentSize = sizeConfig[size] || sizeConfig.md

  if (variant === "wordmark") {
    return (
      <span
        className={`font-heading font-extrabold tracking-tight text-foreground select-none inline-flex items-center ${currentSize.wordmark} ${className}`}
        {...props}
      >
        Praxis
      </span>
    )
  }

  if (variant === "icon") {
    return (
      <div
        className={`inline-flex items-center justify-center shrink-0 select-none ${
          contrastContainer
            ? "p-1 rounded-md bg-white dark:bg-card border border-transparent dark:border-border/50 shadow-2xs"
            : ""
        } ${className}`}
        {...props}
      >
        <img
          src="/branding/praxis-icon.svg"
          alt={alt}
          className={`${currentSize.icon} object-contain shrink-0`}
          loading="eager"
          decoding="async"
        />
      </div>
    )
  }

  // variant === "full"
  return (
    <div
      className={`inline-flex flex-col items-center justify-center shrink-0 select-none ${className}`}
      {...props}
    >
      {/* Light theme logo */}
      <img
        src="/branding/praxis-logo.svg"
        alt={alt}
        className={`${currentSize.full} object-contain dark:hidden shrink-0`}
        loading="eager"
        decoding="async"
      />
      {/* Dark theme logo (preserves symbol & sparkle, renders light wordmark) */}
      <img
        src="/branding/praxis-logo-dark.svg"
        alt={alt}
        className={`${currentSize.full} object-contain hidden dark:block shrink-0`}
        loading="eager"
        decoding="async"
      />
    </div>
  )
}
