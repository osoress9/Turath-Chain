import { SiteFrame } from "@/components/site-frame"
import { CatalogSearch } from "@/components/catalog-search"

export default function KatalogPage() {
  return (
    <SiteFrame>
      <div className="tc-container tc-section-stack">
        <CatalogSearch />
      </div>
    </SiteFrame>
  )
}
