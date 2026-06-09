import { SiteFrame } from "@/components/site-frame"
import { ManuscriptSearch } from "@/components/manuscript-search"

export default function NaskahPage() {
  return (
    <SiteFrame>
      <div className="tc-container tc-section-stack">
        <ManuscriptSearch />
      </div>
    </SiteFrame>
  )
}
