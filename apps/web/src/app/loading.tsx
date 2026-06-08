export default function Loading() {
  return (
    <div className="tc-page-shell">
      <div className="tc-navbar">
        <div className="tc-container tc-navbar-inner">
          <div className="tc-brand">
            <span className="tc-brand-mark" />
            <span className="tc-brand-name">Turath Chain</span>
          </div>
        </div>
      </div>
      <main className="tc-main">
        <div className="tc-container tc-section-stack">
          <div className="tc-skeleton tc-skeleton-hero" />
          <div className="tc-grid-3">
            <div className="tc-skeleton tc-skeleton-card" />
            <div className="tc-skeleton tc-skeleton-card" />
            <div className="tc-skeleton tc-skeleton-card" />
          </div>
        </div>
      </main>
    </div>
  )
}
