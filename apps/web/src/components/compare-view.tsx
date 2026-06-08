"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeftRight, Search } from "lucide-react"
import { fetchBook, fetchBookContentPreview } from "@/lib/api"
import type { Book } from "@/lib/types"
import { formatYearDeath } from "@/lib/format"

type CompareData = {
  book: Book & { relations: Array<{ targetBook?: Book }>; relatedFrom: Array<{ sourceBook?: Book }> }
  preview: { text: string; source: string; value: string } | null
}

function tokenize(text: string) {
  return text
    .split(/(\s+)/)
    .filter((part) => part.length > 0)
}

function renderDiff(leftText: string, rightText: string, side: "left" | "right") {
  const leftTokens = tokenize(leftText)
  const rightTokens = tokenize(rightText)
  const rightSet = new Set(rightTokens.map((token) => token.trim().toLowerCase()).filter(Boolean))
  const leftSet = new Set(leftTokens.map((token) => token.trim().toLowerCase()).filter(Boolean))

  const source = side === "left" ? leftTokens : rightTokens

  return source.map((token, index) => {
    const normalized = token.trim().toLowerCase()
    if (!normalized) return <span key={index}>{token}</span>

    const isShared = side === "left" ? rightSet.has(normalized) : leftSet.has(normalized)
    const className = isShared ? "identical" : side === "left" ? "modified" : "added"
    return (
      <mark key={`${index}-${token}`} className={className}>
        {token}
      </mark>
    )
  })
}

function ComparePanel({
  title,
  book,
  preview,
  side,
  otherPreview,
}: {
  title: string
  book: CompareData["book"]
  preview: CompareData["preview"]
  side: "left" | "right"
  otherPreview: CompareData["preview"]
}) {
  return (
    <div className="tc-panel">
      <div className="tc-section-header">
        <div>
          <h2 className="tc-panel-title">{title}</h2>
          <div className="tc-panel-meta">
            <span>{book.author.nameAr}</span>
            <span>·</span>
            <span>{formatYearDeath(book.author.yearDeath)}</span>
          </div>
        </div>
        <span className="tc-badge exact">Compare</span>
      </div>

      <div className="tc-badge-row">
        {book.genres.map((entry) => (
          <span key={entry.genreId} className="tc-badge genre">
            {entry.genre.nameEn || entry.genre.nameAr || entry.genre.id}
          </span>
        ))}
      </div>

      <h3 className="tc-book-title">{book.titleAr}</h3>
      <p className="tc-book-subtitle">{book.transliteration || book.titleEn || "-"}</p>

      {preview ? (
        <div className="tc-diff">
          {renderDiff(preview.text, otherPreview?.text || "", side)}
        </div>
      ) : (
        <div className="tc-empty-state">
          <Search size={32} strokeWidth={1.6} />
          <div>
            <h3>Cuplikan tidak tersedia</h3>
            <p>Data teks belum tersedia untuk kitab ini.</p>
          </div>
        </div>
      )}
    </div>
  )
}

export function CompareView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchParamString = searchParams?.toString() ?? ""
  const currentParams = new URLSearchParams(searchParamString)
  const left = currentParams.get("left")?.trim() ?? ""
  const right = currentParams.get("right")?.trim() ?? ""

  const [leftSlug, setLeftSlug] = useState(left)
  const [rightSlug, setRightSlug] = useState(right)
  const [leftData, setLeftData] = useState<CompareData | null>(null)
  const [rightData, setRightData] = useState<CompareData | null>(null)
  const [loading, setLoading] = useState(Boolean(left && right))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLeftSlug(left)
    setRightSlug(right)
    if (!left || !right) {
      setLoading(false)
      return
    }

    let mounted = true
    setLoading(true)
    setError(null)

    Promise.all([fetchBook(left), fetchBook(right), fetchBookContentPreview(left), fetchBookContentPreview(right)])
      .then(([leftBook, rightBook, leftPreview, rightPreview]) => {
        if (!mounted) return
        setLeftData({ book: leftBook as CompareData["book"], preview: leftPreview ?? null })
        setRightData({ book: rightBook as CompareData["book"], preview: rightPreview ?? null })
      })
      .catch((requestError) => {
        if (!mounted) return
        setError(requestError instanceof Error ? requestError.message : "Gagal memuat perbandingan.")
      })
      .finally(() => {
        if (!mounted) return
        setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [left, right])

  const canCompare = useMemo(() => Boolean(leftSlug.trim() && rightSlug.trim()), [leftSlug, rightSlug])

  function submitCompare(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canCompare) return
    router.push(`/bandingkan?left=${encodeURIComponent(leftSlug)}&right=${encodeURIComponent(rightSlug)}`)
  }

  if (loading) {
    return (
      <div className="tc-section-stack">
        <div className="tc-skeleton tc-skeleton-hero" />
        <div className="tc-grid-compare">
          <div className="tc-skeleton tc-skeleton-card" />
          <div className="tc-skeleton tc-skeleton-card" />
        </div>
      </div>
    )
  }

  if (!left || !right) {
    return (
      <section className="tc-section-stack">
        <div className="tc-page-head">
          <h1 className="tc-section-title">Perbandingan kitab</h1>
          <p className="tc-section-subtitle">Masukkan dua slug kitab untuk melihat perbandingan side-by-side.</p>
        </div>
        <form className="tc-panel tc-form-grid" onSubmit={submitCompare}>
          <input className="tc-input" placeholder="Slug kiri, contoh: al-shafi..." value={leftSlug} onChange={(e) => setLeftSlug(e.target.value)} />
          <input className="tc-input" placeholder="Slug kanan" value={rightSlug} onChange={(e) => setRightSlug(e.target.value)} />
          <button type="submit" className="tc-button tc-button-primary" disabled={!canCompare}>
            <ArrowLeftRight size={14} />
            Bandingkan
          </button>
        </form>
      </section>
    )
  }

  if (error || !leftData || !rightData) {
    return (
      <div className="tc-empty-state">
        <Search size={40} strokeWidth={1.6} />
        <div>
          <h3>Gagal memuat perbandingan</h3>
          <p>{error || "Data compare belum tersedia."}</p>
        </div>
      </div>
    )
  }

  return (
    <section className="tc-section-stack">
      <div className="tc-page-head">
        <div className="tc-section-header">
          <div>
            <h1 className="tc-section-title">Perbandingan</h1>
            <p className="tc-section-subtitle">Tampilan side-by-side dengan penandaan identik, dimodifikasi, dan tambahan.</p>
          </div>
          <div className="tc-diff-legend">
            <span>Identik</span>
            <span>Dimodifikasi</span>
            <span>Ditambahkan</span>
          </div>
        </div>
      </div>

      <div className="tc-grid-compare">
        <ComparePanel
          title="Kolom kiri"
          book={leftData.book}
          preview={leftData.preview}
          otherPreview={rightData.preview}
          side="left"
        />
        <ComparePanel
          title="Kolom kanan"
          book={rightData.book}
          preview={rightData.preview}
          otherPreview={leftData.preview}
          side="right"
        />
      </div>

      <div className="tc-panel">
        <Link href={`/kitab/${leftData.book.slug}`} className="tc-chip">
          Buka kitab kiri
        </Link>
        <Link href={`/kitab/${rightData.book.slug}`} className="tc-chip">
          Buka kitab kanan
        </Link>
      </div>
    </section>
  )
}
