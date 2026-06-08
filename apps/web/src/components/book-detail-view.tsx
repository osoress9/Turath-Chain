"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { ArrowLeft, BookmarkPlus, Link2, Loader2, SearchX } from "lucide-react"
import { createSavedChain, fetchBook, fetchBookChain, fetchBookContentPreview } from "@/lib/api"
import type { Book, BookRelation, ChainNode, RelationType } from "@/lib/types"
import { formatYearDeath, joinClasses, relationLabel, relationTone } from "@/lib/format"

type BookDetailData = Book & {
  relations: Array<BookRelation & { targetBook: Book & { author: Book["author"] } }>
  relatedFrom: Array<BookRelation & { sourceBook: Book & { author: Book["author"] } }>
  versions: Array<{ id: string; value: string; source: string }>
}

type BookDetailViewProps = {
  slug: string
}

function RelationPill({ relationType }: { relationType: RelationType | null }) {
  return <span className={joinClasses("tc-badge", relationTone(relationType))}>{relationLabel(relationType)}</span>
}

function ChainTree({ node, depth = 0 }: { node: ChainNode; depth?: number }) {
  return (
    <div className="tc-card" style={{ marginLeft: depth === 0 ? 0 : 14, marginTop: depth === 0 ? 0 : 12 }}>
      <div className="tc-card-header">
        <div className="tc-card-main">
          <div className="tc-badge-row">
            <RelationPill relationType={node.relationType} />
          </div>
          <h3 className="tc-book-title">{node.book.titleAr}</h3>
          <p className="tc-book-subtitle">
            {node.book.transliteration || node.book.titleEn || "-"} · {node.book.author.nameAr} · {formatYearDeath(node.book.author.yearDeath)}
          </p>
        </div>

        <Link href={`/kitab/${node.book.slug}`} className="tc-chip">
          Buka
        </Link>
      </div>

      {node.children.length > 0 ? (
        <div className="tc-results-list">
          {node.children.map((child) => (
            <div key={`${child.book.id}-${child.relationType}`}>
              <div className="tc-divider" />
              <ChainTree node={child} depth={depth + 1} />
            </div>
          ))}
        </div>
      ) : (
        <div className="tc-floating-note">Data rantai belum tersedia untuk cabang ini.</div>
      )}
    </div>
  )
}

function CompareLink({ leftSlug, rightSlug }: { leftSlug: string; rightSlug?: string | null }) {
  if (!rightSlug) return null
  return (
    <Link href={`/bandingkan?left=${encodeURIComponent(leftSlug)}&right=${encodeURIComponent(rightSlug)}`} className="tc-chip">
      <Link2 size={14} />
      Bandingkan
    </Link>
  )
}

export function BookDetailView({ slug }: BookDetailViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session } = useSession()
  const callbackPath = pathname ?? "/"

  const [book, setBook] = useState<BookDetailData | null>(null)
  const [chain, setChain] = useState<ChainNode | null>(null)
  const [preview, setPreview] = useState<{ text: string; source: string; value: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState("")

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)

    Promise.all([fetchBook(slug), fetchBookChain(slug), fetchBookContentPreview(slug)])
      .then(([bookData, chainData, previewData]) => {
        if (!mounted) return
        setBook(bookData as BookDetailData)
        setChain(chainData ?? null)
        setPreview(previewData ?? null)
      })
      .catch((requestError) => {
        if (!mounted) return
        setError(requestError instanceof Error ? requestError.message : "Gagal memuat detail kitab.")
      })
      .finally(() => {
        if (!mounted) return
        setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [slug])

  const firstCompareSlug = useMemo(() => {
    return book?.relations[0]?.targetBook?.slug || book?.relatedFrom[0]?.sourceBook?.slug || null
  }, [book])

  async function saveChain() {
    if (!book || !session?.user?.id) {
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackPath)}`)
      return
    }

    setSaving(true)
    try {
      await createSavedChain(
        {
          bookId: book.id,
          note: note.trim() || null,
          query: book.titleAr,
        },
        session.user.id
      )
      window.alert("Rantai tersimpan.")
    } catch (saveError) {
      window.alert(saveError instanceof Error ? saveError.message : "Gagal menyimpan.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="tc-section-stack">
        <div className="tc-skeleton tc-skeleton-hero" />
        <div className="tc-grid-2">
          <div className="tc-skeleton tc-skeleton-card" />
          <div className="tc-skeleton tc-skeleton-card" />
        </div>
      </div>
    )
  }

  if (error || !book) {
    return (
      <div className="tc-empty-state">
        <SearchX size={40} strokeWidth={1.6} />
        <div>
          <h3>Kitab tidak ditemukan</h3>
          <p>{error || "Data kitab tidak tersedia."}</p>
        </div>
        <button type="button" className="tc-button tc-button-primary" onClick={() => router.back()}>
          Kembali
        </button>
      </div>
    )
  }

  return (
    <section className="tc-section-stack">
      <div className="tc-page-head">
        <div className="tc-breadcrumbs">
          <Link href="/">Beranda</Link>
          <span>/</span>
          <Link href="/cari">Cari</Link>
          <span>/</span>
          <span>{book.slug}</span>
        </div>
        <div className="tc-section-header">
          <div>
            <h1 className="tc-compare-title arabic">{book.titleAr}</h1>
            <div className="tc-panel-meta">
              <span>{book.transliteration || book.titleEn || "-"}</span>
              <span>·</span>
              <span>{book.author.nameAr}</span>
              <span>·</span>
              <span>{formatYearDeath(book.author.yearDeath)}</span>
            </div>
          </div>

          <div className="tc-action-row">
            <Link href="/cari" className="tc-chip">
              <ArrowLeft size={14} />
              Kembali
            </Link>
            <button type="button" className="tc-chip" onClick={saveChain} disabled={saving}>
              {saving ? <Loader2 size={14} /> : <BookmarkPlus size={14} />}
              Simpan
            </button>
            <CompareLink leftSlug={book.slug} rightSlug={firstCompareSlug} />
          </div>
        </div>
      </div>

      <div className="tc-grid-2">
        <div className="tc-panel">
          <h2 className="tc-panel-title">Metadata</h2>
          <div className="tc-badge-row">
            {book.genres.map((entry) => (
              <span key={entry.genreId} className="tc-badge genre">
                {entry.genre.nameEn || entry.genre.nameAr || entry.genre.id}
              </span>
            ))}
          </div>
          <div className="tc-floating-note">
            <strong>Pengarang:</strong> {book.author.nameAr}
            <br />
            <strong>Nama latin:</strong> {book.author.nameEn || "-"}
            <br />
            <strong>Slug:</strong> {book.slug}
          </div>
        </div>

        <div className="tc-panel">
          <h2 className="tc-panel-title">Catatan simpan</h2>
          <div className="tc-form-grid">
            <textarea
              className="tc-textarea"
              rows={5}
              placeholder="Tulis catatan pribadi untuk rantai ini..."
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <p className="tc-form-note">Catatan ini disimpan bersama rantai yang dipilih dan bisa dipakai sebagai label pribadi.</p>
          </div>
        </div>
      </div>

      {preview && (
        <div className="tc-panel">
          <div className="tc-section-header">
            <h2 className="tc-panel-title">Cuplikan teks</h2>
            <span className="tc-muted tc-small">
              {preview.value} · {preview.source}
            </span>
          </div>
          <div className="tc-snippet">{preview.text || "Cuplikan teks belum tersedia."}</div>
        </div>
      )}

      <div className="tc-panel" id="rantai">
        <div className="tc-section-header">
          <h2 className="tc-panel-title">Rantai relasi</h2>
          <span className="tc-muted tc-small">Maksimal 10 level sesuai PRD</span>
        </div>
        {chain ? <ChainTree node={chain} /> : <div className="tc-empty-state">Data rantai belum tersedia untuk kitab ini.</div>}
      </div>

      <div className="tc-panel">
        <h2 className="tc-panel-title">Relasi langsung</h2>
        <div className="tc-grid-2">
          <div>
            <h3 className="tc-section-subtitle">Menjadi sumber untuk</h3>
            <div className="tc-results-list" style={{ marginTop: 12 }}>
              {book.relations.length > 0 ? (
                book.relations.map((relation) => (
                  <div key={relation.id} className="tc-card">
                    <div className="tc-badge-row">
                      <RelationPill relationType={relation.relationType} />
                    </div>
                    <Link href={`/kitab/${relation.targetBook.slug}`} className="tc-book-title">
                      {relation.targetBook.titleAr}
                    </Link>
                    <p className="tc-book-subtitle">
                      {relation.targetBook.transliteration || relation.targetBook.titleEn || "-"} · {relation.targetBook.author.nameAr}
                    </p>
                  </div>
                ))
              ) : (
                <div className="tc-floating-note">Data relasi belum tersedia.</div>
              )}
            </div>
          </div>

          <div>
            <h3 className="tc-section-subtitle">Berasal dari</h3>
            <div className="tc-results-list" style={{ marginTop: 12 }}>
              {book.relatedFrom.length > 0 ? (
                book.relatedFrom.map((relation) => (
                  <div key={relation.id} className="tc-card">
                    <div className="tc-badge-row">
                      <RelationPill relationType={relation.relationType} />
                    </div>
                    <Link href={`/kitab/${relation.sourceBook.slug}`} className="tc-book-title">
                      {relation.sourceBook.titleAr}
                    </Link>
                    <p className="tc-book-subtitle">
                      {relation.sourceBook.transliteration || relation.sourceBook.titleEn || "-"} · {relation.sourceBook.author.nameAr}
                    </p>
                    <div className="tc-action-row" style={{ marginTop: 12 }}>
                      <Link href={`/bandingkan?left=${encodeURIComponent(relation.sourceBook.slug)}&right=${encodeURIComponent(book.slug)}`} className="tc-chip">
                        Bandingkan
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="tc-floating-note">Data relasi belum tersedia.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
