import { SiteFrame } from "@/components/site-frame"
import { BookDetailView } from "@/components/book-detail-view"

export default async function BookPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <SiteFrame>
      <div className="tc-container">
        <BookDetailView slug={slug} />
      </div>
    </SiteFrame>
  )
}
