import { SiteFrame } from "@/components/site-frame"
import { SavedView } from "@/components/saved-profile-views"

export default function TersimpanPage() {
  return (
    <SiteFrame>
      <div className="tc-container">
        <SavedView />
      </div>
    </SiteFrame>
  )
}
