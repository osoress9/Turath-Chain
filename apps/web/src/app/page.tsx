import { SiteFrame } from "@/components/site-frame"
import { SearchExplorer } from "@/components/search-explorer"

export default function HomePage() {
  return (
    <SiteFrame>
      <div className="tc-container">
        <SearchExplorer />
      </div>
    </SiteFrame>
  )
}
