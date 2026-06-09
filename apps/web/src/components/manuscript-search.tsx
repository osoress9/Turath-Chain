"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Search, SearchX } from "lucide-react"
import {
  fetchContentStatus,
  fetchGenres,
  fetchManuscriptSemanticStatus,
  searchManuscriptLexical,
  searchManuscriptSemantic,
} from "@/lib/api"
import type { Genre, ManuscriptLexicalResult, ManuscriptSemanticResult } from "@/lib/types"
import { formatYearDeath, joinClasses } from "@/lib/format"

type ManuscriptTab = "semantic" | "lexical"

const SEMANTIC_DEFAULT_TOP_K = 10
const LEXICAL_DEFAULT_LIMIT = 20

function SemanticSkeleton() {
  return (
    <div className="tc-results-list">
      {Array.from({ length: 3 }).map((_, index) => (
        <article key={index} className="tc-card">
          <div className="tc-skeleton-stack">
            <div className="tc-skeleton tc-skeleton-line short" />
            <div className="tc-skeleton tc-skeleton-line long" />
            <div className="tc-skeleton tc-skeleton-line medium" />
            <div className="tc-skeleton tc-skeleton-line long" style={{ height: 92 }} />
          </div>
        </article>
      ))}
    </div>
  )
}

function LexicalSkeleton() {
  return (
    <div className="tc-results-list">
      {Array.from({ length: 3 }).map((_, index) => (
        <article key={index} className="tc-card">
          <div className="tc-skeleton-stack">
            <div className="tc-skeleton tc-skeleton-line short" />
            <div className="tc-skeleton tc-skeleton-line long" />
            <div className="tc-skeleton tc-skeleton-line medium" />
            <div className="tc-skeleton tc-skeleton-line long" style={{ height: 96 }} />
          </div>
        </article>
      ))}
    </div>
  )
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
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

function SemanticCard({ item }: { item: ManuscriptSemanticResult }) {
  const scorePercent = Math.round(item.score * 100)
  const genreLabel = item.book.genres[0]?.nameEn || item.book.genres[0]?.nameAr || "General"

  return (
    <article className="tc-card tc-animate-in">
      <div className="tc-card-header">
        <div className="tc-card-main">
          <div className="tc-badge-row">
            <span className="tc-badge exact">{scorePercent}% cocok</span>
            <span className="tc-badge genre">{genreLabel}</span>
          </div>
          <h3 className="tc-book-title arabic">{item.book.titleAr}</h3>
          <p className="tc-book-subtitle">
            {item.book.author.nameAr} · {item.book.author.yearDeath ? formatYearDeath(item.book.author.yearDeath) : "Tahun wafat belum tersedia"}
          </p>
          <p className="tc-book-subtitle">
            {item.babTitle ? `Bab: ${item.babTitle}` : "Bab belum tersedia"}
            {item.pageRef ? ` · Halaman: ${item.pageRef}` : ""}
          </p>
        </div>
      </div>

      <div className="tc-snippet arabic" style={{ fontSize: 16, lineHeight: 1.95 }}>
        {item.textAr || "Cuplikan teks tidak tersedia."}
      </div>
    </article>
  )
}

function LexicalCard({ item }: { item: ManuscriptLexicalResult }) {
  const genreLabel = item.book.genres[0]?.nameEn || item.book.genres[0]?.nameAr || "General"

  return (
    <article className="tc-card tc-animate-in">
      <div className="tc-card-header">
        <div className="tc-card-main">
          <div className="tc-badge-row">
            <span className="tc-badge exact">Leksikal</span>
            <span className="tc-badge genre">{genreLabel}</span>
          </div>
          <h3 className="tc-book-title arabic">{item.book.titleAr}</h3>
          <p className="tc-book-subtitle">
            {item.book.author.nameAr} · {item.book.author.yearDeath ? formatYearDeath(item.book.author.yearDeath) : "Tahun wafat belum tersedia"}
          </p>
          <p className="tc-book-subtitle">
            {item.page ? `Halaman: ${item.page}` : "Halaman belum tersedia"}
            {item.volume ? ` · Jilid: ${item.volume}` : ""}
          </p>
        </div>
      </div>

      <div className="tc-snippet arabic" dir="rtl" style={{ fontSize: 16, lineHeight: 1.95 }}>
        {item.snippet.before ? <span>{item.snippet.before}</span> : null}
        {item.snippet.match ? <mark>{item.snippet.match}</mark> : null}
        <span>{item.snippet.after}</span>
      </div>
    </article>
  )
}

function StatusPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="tc-stat-card" style={{ minWidth: 180 }}>
      <div className="tc-stat-value">{value}</div>
      <div className="tc-stat-label">{label}</div>
    </div>
  )
}

export function ManuscriptSearch() {
  const [tab, setTab] = useState<ManuscriptTab>("semantic")
  const [genres, setGenres] = useState<Genre[]>([])

  const [semanticQuery, setSemanticQuery] = useState("")
  const [semanticGenre, setSemanticGenre] = useState("")
  const [semanticLoading, setSemanticLoading] = useState(false)
  const [semanticError, setSemanticError] = useState<string | null>(null)
  const [semanticHasSearched, setSemanticHasSearched] = useState(false)
  const [semanticResults, setSemanticResults] = useState<ManuscriptSemanticResult[]>([])

  const [lexicalQuery, setLexicalQuery] = useState("")
  const [lexicalGenre, setLexicalGenre] = useState("")
  const [lexicalPage, setLexicalPage] = useState(1)
  const [lexicalLoading, setLexicalLoading] = useState(false)
  const [lexicalError, setLexicalError] = useState<string | null>(null)
  const [lexicalHasSearched, setLexicalHasSearched] = useState(false)
  const [lexicalResults, setLexicalResults] = useState<ManuscriptLexicalResult[]>([])
  const [lexicalMeta, setLexicalMeta] = useState({ total: 0, page: 1, limit: LEXICAL_DEFAULT_LIMIT, totalPages: 1 })
  const [contentStatus, setContentStatus] = useState({ indexedPages: 0, indexedBooks: 0, totalBooks: 0 })
  const [contentStatusError, setContentStatusError] = useState<string | null>(null)
  const [contentStatusLoading, setContentStatusLoading] = useState(false)

  const [semanticIndexedBooks, setSemanticIndexedBooks] = useState<number | null>(null)
  const [semanticTotalVectors, setSemanticTotalVectors] = useState<number | null>(null)
  const [semanticStatusError, setSemanticStatusError] = useState<string | null>(null)
  const [semanticStatusLoading, setSemanticStatusLoading] = useState(false)

  useEffect(() => {
    let mounted = true

    fetchGenres()
      .then((data) => {
        if (mounted) setGenres(data)
      })
      .catch(() => {
        if (mounted) setGenres([])
      })

    setSemanticStatusLoading(true)
    fetchManuscriptSemanticStatus()
      .then((data) => {
        if (!mounted) return
        setSemanticIndexedBooks(data.indexedBooks)
        setSemanticTotalVectors(data.totalVectors)
        setSemanticStatusError(null)
      })
      .catch((error) => {
        if (!mounted) return
        setSemanticIndexedBooks(null)
        setSemanticTotalVectors(null)
        setSemanticStatusError(error instanceof Error ? error.message : "Gagal mengambil status indeks semantik")
      })
      .finally(() => {
        if (mounted) setSemanticStatusLoading(false)
      })

    setContentStatusLoading(true)
    fetchContentStatus()
      .then((data) => {
        if (!mounted) return
        setContentStatus(data)
        setContentStatusError(null)
      })
      .catch((error) => {
        if (!mounted) return
        setContentStatus({ indexedPages: 0, indexedBooks: 0, totalBooks: 0 })
        setContentStatusError(error instanceof Error ? error.message : "Gagal mengambil status indeks konten")
      })
      .finally(() => {
        if (mounted) setContentStatusLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  async function runSemanticSearch() {
    const trimmed = semanticQuery.trim()
    if (!trimmed) {
      setSemanticError("Masukkan kata kunci Arab terlebih dahulu.")
      setSemanticResults([])
      setSemanticHasSearched(true)
      return
    }

    setSemanticLoading(true)
    setSemanticError(null)
    setSemanticHasSearched(true)

    try {
      const response = await searchManuscriptSemantic({
        q: trimmed,
        topK: SEMANTIC_DEFAULT_TOP_K,
        genre: semanticGenre || undefined,
      })
      setSemanticResults(response.data)
    } catch (requestError) {
      setSemanticError(requestError instanceof Error ? requestError.message : "Pencarian semantik gagal.")
      setSemanticResults([])
    } finally {
      setSemanticLoading(false)
    }
  }

  async function runLexicalSearch(nextPage = 1) {
    const trimmed = lexicalQuery.trim()
    if (!trimmed) {
      setLexicalError("Masukkan kata atau frasa Arab terlebih dahulu.")
      setLexicalResults([])
      setLexicalHasSearched(true)
      return
    }

    setLexicalLoading(true)
    setLexicalError(null)
    setLexicalHasSearched(true)

    try {
      const response = await searchManuscriptLexical({
        q: trimmed,
        genre: lexicalGenre || undefined,
        page: nextPage,
        limit: LEXICAL_DEFAULT_LIMIT,
      })
      setLexicalResults(response.data)
      setLexicalMeta(response.meta)
      setLexicalPage(nextPage)
    } catch (requestError) {
      setLexicalError(requestError instanceof Error ? requestError.message : "Pencarian leksikal gagal.")
      setLexicalResults([])
      setLexicalMeta({ total: 0, page: 1, limit: LEXICAL_DEFAULT_LIMIT, totalPages: 1 })
    } finally {
      setLexicalLoading(false)
    }
  }

  const semanticStatusLabel = useMemo(() => {
    if (semanticStatusLoading) return "Memuat..."
    if (semanticStatusError) return semanticStatusError
    if (semanticIndexedBooks == null) return "Status semantik belum tersedia"
    return `Index semantik mencakup ${semanticIndexedBooks} kitab saat ini`
  }, [semanticIndexedBooks, semanticStatusError, semanticStatusLoading])

  const lexicalStatusLabel = useMemo(() => {
    if (contentStatusLoading) return "Memuat..."
    if (contentStatusError) return contentStatusError
    if (contentStatus.indexedPages === 0) return "Index konten kitab belum tersedia. Jalankan pnpm index:content untuk mengindeks."
    return `Index konten mencakup ${contentStatus.indexedBooks} kitab dan ${contentStatus.indexedPages} halaman`
  }, [contentStatus, contentStatusError, contentStatusLoading])

  return (
    <section className="tc-section-stack">
      <div className="tc-page-head">
        <div className="tc-badge-row">
          <span className="tc-badge exact">Naskah</span>
          <span className="tc-badge genre">Semantik + Leksikal</span>
        </div>
        <h1 className="tc-section-title">Pencarian Naskah</h1>
        <p className="tc-section-subtitle">
          Semantik = cari makna/topik, bukan kata persis. Leksikal = cari kata/frasa persis yang benar-benar muncul.
        </p>
      </div>

      <div className="tc-search-box">
        <div className="tc-tab-group" role="tablist" aria-label="Mode pencarian naskah">
          <button
            type="button"
            className={joinClasses("tc-tab", tab === "semantic" && "is-active")}
            onClick={() => setTab("semantic")}
          >
            Semantik
          </button>
          <button
            type="button"
            className={joinClasses("tc-tab", tab === "lexical" && "is-active")}
            onClick={() => setTab("lexical")}
          >
            Leksikal
          </button>
        </div>
      </div>

      {tab === "semantic" ? (
        <div className="tc-section-stack">
          <div className="tc-card" style={{ background: "var(--blue-50)", borderColor: "var(--blue-200)", boxShadow: "none" }}>
            <div className="tc-badge-row" style={{ marginBottom: 10 }}>
              <span className="tc-badge exact">
                <AlertTriangle size={14} />
              </span>
            </div>
            <p className="tc-snippet" style={{ margin: 0 }}>
              Cari makna/topik - menemukan pembahasan meski lafaznya berbeda.
            </p>
          </div>

          <div className="tc-search-box">
            <div className="tc-search-grid" style={{ gridTemplateColumns: "minmax(0, 1fr) auto auto" }}>
              <input
                className="tc-input arabic"
                dir="rtl"
                value={semanticQuery}
                onChange={(event) => setSemanticQuery(event.target.value)}
                placeholder="ابحث عن معنى أو موضوع..."
              />
              <select className="tc-select" value={semanticGenre} onChange={(event) => setSemanticGenre(event.target.value)}>
                <option value="">Semua genre</option>
                {genres.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nameEn || item.nameAr || item.id}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="tc-button tc-button-primary tc-search-button"
                onClick={() => void runSemanticSearch()}
                disabled={semanticLoading}
              >
                {semanticLoading ? <Loader2 size={14} className="tc-spinner" /> : <Search size={14} />}
                {semanticLoading ? "Mencari..." : "Cari"}
              </button>
            </div>

            <div className="tc-hints">
              <span className="tc-hints-label">Status:</span>
              <span className="tc-hint-chip" role="status">
                {semanticStatusLabel}
              </span>
              {semanticTotalVectors != null ? (
                <span className="tc-hint-chip">{semanticTotalVectors.toLocaleString("id-ID")} vektor</span>
              ) : null}
            </div>
          </div>

          <div className="tc-stats-grid">
            <StatusPill label="Kitab ter-embed" value={semanticIndexedBooks == null ? "-" : semanticIndexedBooks.toLocaleString("id-ID")} />
            <StatusPill label="Total vektor" value={semanticTotalVectors == null ? "-" : semanticTotalVectors.toLocaleString("id-ID")} />
            <StatusPill label="Mode" value="Qdrant" />
            <StatusPill label="Pencarian" value="Makna / Topik" />
          </div>

          {semanticHasSearched && (
            <div className="tc-section-stack">
              {semanticError ? (
                <div className="tc-empty-state">
                  <SearchX size={36} strokeWidth={1.6} />
                  <div>
                    <h3>Pencarian gagal</h3>
                    <p>{semanticError}</p>
                  </div>
                  <button type="button" className="tc-button tc-button-primary" onClick={() => void runSemanticSearch()}>
                    Coba Lagi
                  </button>
                </div>
              ) : semanticLoading ? (
                <SemanticSkeleton />
              ) : semanticResults.length > 0 ? (
                <div className="tc-results-list">
                  {semanticResults.map((item, index) => (
                    <SemanticCard key={`${item.book.id}-${index}`} item={item} />
                  ))}
                </div>
              ) : (
                <EmptyState title="Tidak ada hasil" subtitle="Coba kata kunci lain atau perluas filter genre." />
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="tc-section-stack">
          <div className="tc-card" style={{ background: "var(--surface-2)", boxShadow: "none" }}>
            <div className="tc-badge-row" style={{ marginBottom: 10 }}>
              <span className="tc-badge genre">Leksikal = kata/frasa persis</span>
            </div>
            <p className="tc-snippet" style={{ margin: 0 }}>
              Cari kata atau frasa yang benar-benar muncul dalam isi kitab. Highlight menunjukkan bagian yang cocok.
            </p>
          </div>

          <div className="tc-search-box">
            <div className="tc-search-grid" style={{ gridTemplateColumns: "minmax(0, 1fr) auto auto" }}>
              <input
                className="tc-input arabic"
                dir="rtl"
                value={lexicalQuery}
                onChange={(event) => setLexicalQuery(event.target.value)}
                placeholder="ابحث عن كلمة أو عبارة..."
              />
              <select className="tc-select" value={lexicalGenre} onChange={(event) => setLexicalGenre(event.target.value)}>
                <option value="">Semua genre</option>
                {genres.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nameEn || item.nameAr || item.id}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="tc-button tc-button-primary tc-search-button"
                onClick={() => void runLexicalSearch(1)}
                disabled={lexicalLoading}
              >
                {lexicalLoading ? <Loader2 size={14} className="tc-spinner" /> : <Search size={14} />}
                {lexicalLoading ? "Mencari..." : "Cari"}
              </button>
            </div>

            <div className="tc-hints">
              <span className="tc-hints-label">Status:</span>
              <span className="tc-hint-chip" role="status">
                {lexicalStatusLabel}
              </span>
            </div>
          </div>

          <div className="tc-stats-grid">
            <StatusPill label="Halaman terindeks" value={contentStatus.indexedPages.toLocaleString("id-ID")} />
            <StatusPill label="Kitab terindeks" value={contentStatus.indexedBooks.toLocaleString("id-ID")} />
            <StatusPill label="Total kitab" value={contentStatus.totalBooks.toLocaleString("id-ID")} />
            <StatusPill label="Mode" value="PostgreSQL" />
          </div>

          {lexicalHasSearched && (
            <div className="tc-section-stack">
              {lexicalError ? (
                <div className="tc-empty-state">
                  <SearchX size={36} strokeWidth={1.6} />
                  <div>
                    <h3>Pencarian gagal</h3>
                    <p>{lexicalError}</p>
                  </div>
                  <button type="button" className="tc-button tc-button-primary" onClick={() => void runLexicalSearch(lexicalPage)}>
                    Coba Lagi
                  </button>
                </div>
              ) : contentStatus.indexedPages === 0 ? (
                <EmptyState
                  title="Index konten belum tersedia"
                  subtitle="Jalankan pnpm index:content untuk mengindeks isi kitab terlebih dahulu."
                />
              ) : lexicalLoading ? (
                <LexicalSkeleton />
              ) : lexicalResults.length > 0 ? (
                <div className="tc-results-list">
                  {lexicalResults.map((item) => (
                    <LexicalCard key={`${item.bookId}-${item.page ?? "na"}-${item.volume ?? "na"}`} item={item} />
                  ))}
                </div>
              ) : (
                <EmptyState title="Tidak ada hasil" subtitle="Coba kata kunci lain atau perluas filter genre." />
              )}

              {lexicalMeta.totalPages > 1 && lexicalResults.length > 0 && (
                <div className="tc-pagination">
                  <button
                    type="button"
                    onClick={() => void runLexicalSearch(Math.max(1, lexicalPage - 1))}
                    disabled={lexicalPage <= 1 || lexicalLoading}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: Math.min(lexicalMeta.totalPages, 5) }).map((_, index) => {
                    const target = index + 1
                    return (
                      <button
                        key={target}
                        type="button"
                        className={joinClasses(target === lexicalPage && "is-active")}
                        onClick={() => void runLexicalSearch(target)}
                        disabled={lexicalLoading}
                      >
                        {target}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => void runLexicalSearch(Math.min(lexicalMeta.totalPages, lexicalPage + 1))}
                    disabled={lexicalPage >= lexicalMeta.totalPages || lexicalLoading}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
