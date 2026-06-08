import { SiteFrame } from "@/components/site-frame"
import { AuthView } from "@/components/auth-view"

const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

export default function LoginPage() {
  return (
    <SiteFrame minimal>
      <div className="tc-container">
        <AuthView googleEnabled={googleEnabled} />
      </div>
    </SiteFrame>
  )
}
