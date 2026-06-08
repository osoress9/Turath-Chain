import { SiteFrame } from "@/components/site-frame"
import { ProfileView } from "@/components/saved-profile-views"

export default function ProfilPage() {
  return (
    <SiteFrame>
      <div className="tc-container">
        <ProfileView />
      </div>
    </SiteFrame>
  )
}
