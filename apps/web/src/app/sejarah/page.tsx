import { SiteFrame } from "@/components/site-frame"
import { HistoricalSearch } from "@/components/historical-search"

export default function SejarahPage() {
  return (
    <SiteFrame>
      <div className="tc-container tc-section-stack">
        <HistoricalSearch />
      </div>
    </SiteFrame>
  )
}
