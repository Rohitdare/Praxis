import { CheckSquare, FileText, Link2 } from "lucide-react"

export function WorkflowSection() {
  return (
    <section
      id="workflow"
      className="transition-section"
      data-scroll-section="workflow"
      data-theme="mid"
      aria-labelledby="workflow-heading"
    >
      <div className="container">
        <div className="transition-header">
          <span className="transition-eyebrow">
            THOUGHTFUL ARCHITECTURE
          </span>
          <h2 id="workflow-heading" className="transition-title">
            Built for how you naturally think.
          </h2>
          <p className="transition-lead">
            No rigid folders or cluttered hierarchies. Just a natural stream of what matters, readily organized and effortlessly retrievable.
          </p>
        </div>

        <div className="pillars-grid">
          {/* Pillar 1: Quick Capture */}
          <div className="pillar-card">
            <div className="pillar-icon-box" aria-hidden="true">
              <FileText className="size-5" />
            </div>
            <h3 className="pillar-title">Notes & Reflections</h3>
            <p className="pillar-desc">
              Write down fleeting thoughts, meeting notes, or deep reflections with zero friction and instant offline persistence.
            </p>
          </div>

          {/* Pillar 2: Saved Links & Visuals */}
          <div className="pillar-card">
            <div className="pillar-icon-box" aria-hidden="true">
              <Link2 className="size-5" />
            </div>
            <h3 className="pillar-title">Curated Links & Visuals</h3>
            <p className="pillar-desc">
              Collect web inspiration, design benchmarks, and reading lists with rich metadata and clean visual previews.
            </p>
          </div>

          {/* Pillar 3: Focused Daily Flow */}
          <div className="pillar-card">
            <div className="pillar-icon-box" aria-hidden="true">
              <CheckSquare className="size-5" />
            </div>
            <h3 className="pillar-title">Daily Execution</h3>
            <p className="pillar-desc">
              Keep your daily priorities front and center. Unfinished items rollover gently without cluttering your headspace.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
