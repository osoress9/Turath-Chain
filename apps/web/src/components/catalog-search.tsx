"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Loader2, Search, SearchX } from "lucide-react"
import { catalogSearch } from "@/lib/api"
import type { CatalogAuthorResult, CatalogBookResult, CatalogSearchResponse } from "@/lib/types"
import { formatYearDeath, joinClasses } from "@/lib/format"

const DEFAULT_META: CatalogSearchResponse["meta"] = {
  totalBooks: 0,
  totalAuthors: 0,
  page: 1,
  limit: 20,
}

const suggestionQueries = ["الشافعي", "ابن تيمية", "الموافقات"]

function totalPagesFrom(meta: CatalogSearchResponse["meta"]) {
  return Math.max(Math.ceil(meta.totalBooks / meta.limit), Math.ceil(meta.totalAuthors / meta.limit), 1)
}

function genreLabel(genre: { nameAr: string | null; nameEn: string | null; id: string }) {
  return genre.nameAr || genre.nameEn || genre.id
}

function CatalogSkeleton() {
  return (
    <div className="tc-results-list">
      {Array.from({ length: 3 }).map((_, index) => (
        <article key={index} className="tc-card">
          <div className="tc-skeleton-stack">
            <div className="tc-skeleton tc-skeleton-line short" />
            <div className="tc-skeleton tc-skeleton-line long" />
            <div className="tc-skeleton tc-skeleton-line medium" />
            <div className="tc-skeleton tc-skeleton-line long" style={{ height: 88 }} />
          </div>
        </article>
      ))}
    </div>
  )
}

function EmptySection({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <div className="tc-empty-state">
      <SearchX size={36} strokeWidth={1.6} />
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
    </div>
  )
}

function BookCard({ book }: { book: CatalogBookResult }) {
  return (
    <article className="tc-card tc-animate-in">
      <div className="tc-card-header">
        <div className="tc-card-main">
          <div className="tc-badge-row">
            <span className="tc-badge genre">Kitab</span>
            <span className="tc-badge exact">Hasil Judul</span>
          </div>
          <h3 className="tc-book-title arabic">{book.titleAr}</h3>
          <p className="tc-book-subtitle">
            {book.transliteration || book.titleEn || "-"} · {book.author.nameAr} ·{" "}
            {book.author.yearDeath ? formatYearDeath(book.author.yearDeath) : "Tahun wafat belum tersedia"}
          </p>
        </div>
        <Link href={`/kitab/${book.slug}`} className="tc-chip">
          Detail
        </Link>
      </div>

      <div className="tc-section-stack" style={{ gap: 10 }}>
        <div className="tc-badge-row">
          {book.genres.length > 0 ? (
            book.genres.map((genre) => (
              <span key={genre.id} className="tc-badge summary">
                {genreLabel(genre)}
              </span>
            ))
          ) : (
            <span className="tc-muted">Genre belum tersedia</span>
          )}
        </div>

        <div className="tc-snippet arabic">
          <strong>Karangan lain:</strong> {book.authorWorks.length > 0 ? book.authorWorks.map((item) => item.titleAr).join("، ") : "Belum ada karangan lain di database"}
        </div>
      </div>
    </article>
  )
}

function AuthorCard({ author }: { author: CatalogAuthorResult }) {
  return (
    <article className="tc-card tc-animate-in">
      <div className="tc-card-header">
        <div className="tc-card-main">
          <div className="tc-badge-row">
            <span className="tc-badge develop">Muallif</span>
            <span className="tc-badge summary">Hasil Nama</span>
          </div>
          <h3 className="tc-book-title arabic">{author.nameAr}</h3>
          <p className="tc-book-subtitle">{author.yearDeath ? formatYearDeath(author.yearDeath) : "Tahun wafat belum tersedia"}</p>
        </div>
        <span className="tc-badge exact">{author.works.length} kitab</span>
      </div>

      <div className="tc-snippet arabic">
        <strong>Karangan:</strong>{" "}
        {author.works.length > 0 ? author.works.map((work) => work.titleAr).join("، ") : "Belum ada karangan lain di database"}
      </div>

      {author.works.length > 0 && (
        <div className="tc-section-stack" style={{ gap: 10 }}>
          {author.works.map((work) => (
            <div key={work.id} className="tc-card" style={{ padding: 16, background: "var(--surface-2)", boxShadow: "none" }}>
              <div className="tc-card-main">
                <h4 className="tc-book-title arabic" style={{ fontSize: 17, marginBottom: 4 }}>
                  {work.titleAr}
                </h4>
                <div className="tc-badge-row">
                  {work.genres.length > 0 ? (
                    work.genres.map((genre) => (
                      <span key={genre.id} className="tc-badge genre">
                        {genre.nameAr || "Genre"}
                      </span>
                    ))
                  ) : (
                    <span className="tc-muted">Genre belum tersedia</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  )
}

export function CatalogSearch() {
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [meta, setMeta] = useState(DEFAULT_META)
  const [books, setBooks] = useState<CatalogBookResult[]>([])
  const [authors, setAuthors] = useState<CatalogAuthorResult[]>([])

  const totalPages = useMemo(() => totalPagesFrom(meta), [meta])

  async function executeSearch(trimmedQuery: string, nextPage = 1) {
    setLoading(true)
    setError(null)
    setHasSearched(true)

    try {
      const response = await catalogSearch(trimmedQuery, nextPage)
      setBooks(response.data.books)
      setAuthors(response.data.authors)
      setMeta(response.meta)
      setPage(nextPage)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Pencarian katalog gagal.")
      setBooks([])
      setAuthors([])
      setMeta(DEFAULT_META)
    } finally {
      setLoading(false)
    }
  }

  async function runSearch(nextPage = 1) {
    const trimmedQuery = query.trim()

    if (!trimmedQuery) {
      setError("Masukkan nama kitab atau muallif terlebih dahulu.")
      setBooks([])
      setAuthors([])
      setMeta(DEFAULT_META)
      setHasSearched(true)
      return
    }

    await executeSearch(trimmedQuery, nextPage)
  }

  return (
    <section className="tc-section-stack">
      <div className="tc-page-head">
        <div className="tc-badge-row">
          <span className="tc-badge exact">Katalog</span>
          <span className="tc-badge genre">Kitab & Muallif</span>
        </div>
        <h1 className="tc-section-title">Katalog Kitab & Muallif</h1>
        <p className="tc-section-subtitle">
          Cari nama kitab atau muallif dari satu kolom input. Hasil kitab dan hasil muallif ditampilkan terpisah.
        </p>
      </div>

      <form
        className="tc-search-box"
        onSubmit={(event) => {
          event.preventDefault()
          void runSearch(1)
        }}
      >
        <div className="tc-search-grid">
          <input
            className="tc-input arabic"
            dir="rtl"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث عن اسم الكتاب أو المؤلف..."
          />
          <button type="submit" className="tc-button tc-button-primary tc-search-button" disabled={loading}>
            {loading ? <Loader2 size={14} className="tc-spinner" /> : <Search size={14} />}
            {loading ? "Mencari..." : "Cari"}
          </button>
        </div>

        <div className="tc-hints">
          <span className="tc-hints-label">Coba:</span>
          {suggestionQueries.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="tc-hint-chip"
              onClick={() => {
                setQuery(suggestion)
                void executeSearch(suggestion, 1)
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </form>

      {hasSearched && (
        <div className="tc-section-stack">
          {error ? (
            <div className="tc-empty-state">
              <SearchX size={36} strokeWidth={1.6} />
              <div>
                <h3>Pencarian gagal</h3>
                <p>{error}</p>
              </div>
              <button type="button" className="tc-button tc-button-primary" onClick={() => void runSearch(page)}>
                Coba Lagi
              </button>
            </div>
          ) : loading ? (
            <CatalogSkeleton />
          ) : (
            <>
              <section className="tc-section-stack">
                <div className="tc-section-header">
                  <div>
                    <h2 className="tc-section-title">Hasil Kitab ({meta.totalBooks})</h2>
                    <p className="tc-section-subtitle">Hasil pencarian berdasarkan judul kitab.</p>
                  </div>
                </div>
                {books.length > 0 ? (
                  <div className="tc-results-list">
                    {books.map((book) => (
                      <BookCard key={book.id} book={book} />
                    ))}
                  </div>
                ) : (
                  <EmptySection
                    title="Tidak ada hasil kitab"
                    subtitle="Coba kata kunci lain atau cari nama muallif untuk memperluas hasil."
                  />
                )}
              </section>

              <section className="tc-section-stack">
                <div className="tc-section-header">
                  <div>
                    <h2 className="tc-section-title">Hasil Muallif ({meta.totalAuthors})</h2>
                    <p className="tc-section-subtitle">Hasil pencarian berdasarkan nama pengarang.</p>
                  </div>
                </div>
                {authors.length > 0 ? (
                  <div className="tc-results-list">
                    {authors.map((author) => (
                      <AuthorCard key={author.id} author={author} />
                    ))}
                  </div>
                ) : (
                  <EmptySection
                    title="Tidak ada hasil muallif"
                    subtitle="Coba ejaan lain atau gunakan nama Arab yang lebih lengkap."
                  />
                )}
              </section>

              {totalPages > 1 && (
                <div className="tc-pagination">
                  <button type="button" onClick={() => void runSearch(Math.max(1, page - 1))} disabled={page <= 1}>
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }).map((_, index) => {
                    const target = index + 1
                    return (
                      <button
                        key={target}
                        type="button"
                        className={joinClasses(target === page && "is-active")}
                        onClick={() => void runSearch(target)}
                      >
                        {target}
                      </button>
                    )
                  })}
                  <button type="button" onClick={() => void runSearch(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}
