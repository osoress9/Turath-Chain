import { SiteFrame } from "@/components/site-frame"
import { CompareView } from "@/components/compare-view"

export default function ComparePage() {
  return (
    <SiteFrame>
      <div className="tc-container">
        <CompareView />
      </div>
    </SiteFrame>
  )
}
