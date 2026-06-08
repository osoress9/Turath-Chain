import { SiteFrame } from "@/components/site-frame"
import { SearchExplorer } from "@/components/search-explorer"

export default function CariPage() {
  return (
    <SiteFrame>
      <div className="tc-container tc-section-stack">
        <div className="tc-page-head">
          <h1 className="tc-section-title">Cari kitab</h1>
          <p className="tc-section-subtitle">Mode pencarian lengkap dengan filter genre dan urutan hasil.</p>
        </div>
        <SearchExplorer compact />
      </div>
    </SiteFrame>
  )
}
