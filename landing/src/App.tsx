import { Navbar } from "./components/Navbar"
import { HeroSection } from "./components/HeroSection"
import { WorkflowSection } from "./components/WorkflowSection"
import { ProductSection } from "./components/ProductSection"
import { ClosingSection } from "./components/ClosingSection"

export function App() {
  const appUrl = (import.meta as any).env?.VITE_APP_URL || "http://localhost:5173"

  return (
    <div className="praxis-landing-wrapper">
      <Navbar appUrl={appUrl} />
      <main id="main-content">
        <HeroSection appUrl={appUrl} />
        <WorkflowSection />
        <ProductSection />
        <ClosingSection appUrl={appUrl} />
      </main>
    </div>
  )
}

export default App
