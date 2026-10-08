import fs from "fs"
import path from "path"
import { describe, expect, it } from "vitest"

describe("Phase 1A: PWA Configuration & Build Verification", () => {
  it("verifies manifest and service worker exist in dist build output", () => {
    const distPath = path.resolve(process.cwd(), "dist")
    const manifestPath = path.join(distPath, "manifest.webmanifest")
    const swPath = path.join(distPath, "sw.js")

    expect(fs.existsSync(manifestPath)).toBe(true)
    expect(fs.existsSync(swPath)).toBe(true)

    const manifestContent = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))
    expect(manifestContent.name).toBe("Personal Memory")
    expect(manifestContent.short_name).toBe("Memory")
    expect(manifestContent.display).toBe("standalone")
    expect(manifestContent.start_url).toBe("/")
  })

  it("verifies vite.config.ts explicitly restricts caching to static assets and denies API/Supabase traffic", () => {
    const viteConfigPath = path.resolve(process.cwd(), "vite.config.ts")
    const configContent = fs.readFileSync(viteConfigPath, "utf-8")

    expect(configContent).toContain("VitePWA")
    expect(configContent).toContain("navigateFallbackDenylist")
    expect(configContent).toContain("/^\\/api/")
    expect(configContent).toContain("/supabase\\.co/")
  })
})
