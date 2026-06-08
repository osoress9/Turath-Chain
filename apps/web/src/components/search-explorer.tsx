"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Search,
  SearchX,
  SlidersHorizontal,
} from "lucide-react"
import { createSavedChain, fetchContentStatus, fetchGenres, fetchHealth, searchBooks, searchContent } from "@/lib/api"
import type { Book, ContentSearchResult, Genre, SearchMeta } from "@/lib/types"
import { formatYearDeath, joinClasses } from "@/lib/format"

type SearchMode = "topic" | "exact"

type SearchExplorerProps = {
  compact?: boolean
}

type ResultItem =
  | { kind: "book"; book: Book }
  | { kind: "content"; item: ContentSearchResult }

const hintQueries = [
  "جواز الجمع في الحضر",
  "أحكام الطهارة",
  "فضل العلم",
]

function normalizeWords(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function highlightText(text: string, query: string) {
  const words = normalizeWords(query)
  if (words.length === 0) return text

  const regex = new RegExp(`(${words.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi")
  const nodes: React.ReactNode[] = []
  let lastIndex = 0

  text.replace(regex, (match, _group, offset) => {
    if (offset > lastIndex) {
      nodes.push(text.slice(lastIndex, offset))
    }
    nodes.push(<mark key={`${offset}-${match}`}>{match}</mark>)
    lastIndex = offset + match.length
    return match
  })

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes.length > 0 ? nodes : text
}

function getFirstGenre(book: Book) {
  return book.genres[0]?.genre.nameEn || book.genres[0]?.genre.nameAr || "General"
}

function SearchResultCard({
  item,
  query,
  onSave,
  userId,
}: {
  item: ResultItem
  query: string
  onSave: (book: Book) => void
  userId?: string | null
}) {
  const book = item.kind === "book" ? item.book : item.item.book
  const genreLabel = getFirstGenre(book)

  return (
    <article className="tc-card tc-animate-in">
      <div className="tc-card-header">
        <div className="tc-card-main">
          <div className="tc-badge-row">
            <span className="tc-badge genre">{genreLabel}</span>
            {item.kind === "content" && <span className="tc-badge exact">Teks Persis</span>}
          </div>
          <h3 className="tc-book-title">{book.titleAr}</h3>
          <p className="tc-book-subtitle">
            {book.transliteration || book.titleEn || "-"} · {book.author.nameAr} · {formatYearDeath(book.author.yearDeath)}
          </p>
        </div>

        <span className={joinClasses("tc-badge", item.kind === "content" ? "exact" : "develop")}>
          {item.kind === "content" ? "Passage" : "Kitab"}
        </span>
      </div>

      {item.kind === "content" ? (
        <div className="tc-snippet">{highlightText(item.item.text, query)}</div>
      ) : (
        <div className="tc-snippet">{book.transliteration || book.titleEn || "Cuplikan belum tersedia."}</div>
      )}

      <div className="tc-card-footer">
        <div className="tc-score">
          <div className="tc-score-bar">
            <div className="tc-score-fill" style={{ width: item.kind === "content" ? "86%" : "72%" }} />
          </div>
          <span className="tc-score-label">{item.kind === "content" ? "pencocokan teks" : "kecocokan tema"}</span>
        </div>

        <div className="tc-action-row">
          <Link href={`/kitab/${book.slug}`} className="tc-chip">
            Detail
          </Link>
          <Link href={`/kitab/${book.slug}#rantai`} className="tc-chip">
            Rantai
          </Link>
          <button
            type="button"
            className="tc-chip"
            onClick={() => onSave(book)}
            title={userId ? "Simpan rantai" : "Login dulu"}
          >
            <BookmarkPlus size={14} />
            Simpan
          </button>
        </div>
      </div>
    </article>
  )
}

function LoadingList() {
  return (
    <div className="tc-results-list">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="tc-card">
          <div className="tc-skeleton-stack">
            <div className="tc-skeleton tc-skeleton-line short" />
            <div className="tc-skeleton tc-skeleton-line long" />
            <div className="tc-skeleton tc-skeleton-line medium" />
            <div className="tc-skeleton tc-skeleton-line long" style={{ height: 72 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="tc-empty-state">
      <SearchX size={40} strokeWidth={1.6} />
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
    </div>
  )
}

export function SearchExplorer({ compact }: SearchExplorerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamString = searchParams?.toString() ?? ""
  const callbackPath = pathname ?? "/"
  const { data: session } = useSession()

  const [mode, setMode] = useState<SearchMode>("topic")
  const [query, setQuery] = useState("")
  const [genre, setGenre] = useState("")
  const [page, setPage] = useState(1)
  const [sortAscending, setSortAscending] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [didSearch, setDidSearch] = useState(false)
  const [genres, setGenres] = useState<Genre[]>([])
  const [items, setItems] = useState<ResultItem[]>([])
  const [meta, setMeta] = useState<SearchMeta | null>(null)
  const [stats, setStats] = useState({ indexedPages: 0, indexedBooks: 0, totalBooks: 0 })
  const [health, setHealth] = useState<string>("")

  const hasBootstrapSearch = useRef(false)

  useEffect(() => {
    let mounted = true

    Promise.all([fetchGenres(), fetchContentStatus(), fetchHealth()])
      .then(([genreList, status, healthy]) => {
        if (!mounted) return
        setGenres(genreList)
        setStats(status)
        setHealth(healthy.message)
      })
      .catch(() => {
        if (!mounted) return
        setGenres([])
        setStats({ indexedPages: 0, indexedBooks: 0, totalBooks: 0 })
      })

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (hasBootstrapSearch.current) return
    const params = new URLSearchParams(searchParamString)
    const q = params.get("q")?.trim() ?? ""
    if (!q) return

    hasBootstrapSearch.current = true
    setQuery(q)
    setGenre(params.get("genre") ?? "")
    setMode(params.get("mode") === "exact" ? "exact" : "topic")
    const nextPage = Math.max(1, Number(params.get("page") ?? "1"))
    setPage(nextPage)
    void runSearch(q, {
      nextMode: params.get("mode") === "exact" ? "exact" : "topic",
      nextGenre: params.get("genre") ?? "",
      nextPage,
      updateUrl: false,
    })
  // Bootstrap only from the initial query string.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParamString])

  const sortToggleLabel = useMemo(() => {
    return sortAscending ? "Urutan tua → muda" : "Urutan muda → tua"
  }, [sortAscending])

  async function runSearch(
    nextQuery: string,
    options?: {
      nextMode?: SearchMode
      nextGenre?: string
      nextPage?: number
      updateUrl?: boolean
    }
  ) {
    const trimmedQuery = nextQuery.trim()
    const selectedMode = options?.nextMode ?? mode
    const selectedGenre = options?.nextGenre ?? genre
    const nextPage = options?.nextPage ?? page

    if (!trimmedQuery) {
      setError("Masukkan kata kunci terlebih dahulu.")
      setItems([])
      setMeta(null)
      return
    }

    setLoading(true)
    setError(null)
    setDidSearch(true)

    try {
      let nextItems: ResultItem[] = []
      let nextMeta: SearchMeta | null = null

      if (selectedMode === "exact") {
        const response = await searchContent({ q: trimmedQuery, page: nextPage, limit: 20 })
        nextItems = response.data.map((item) => ({ kind: "content" as const, item }))
        nextMeta = response.meta
      } else {
        const response = await searchBooks({
          q: trimmedQuery,
          genre: selectedGenre || undefined,
          page: nextPage,
          limit: 20,
        })
        nextItems = response.data.map((book) => ({ kind: "book" as const, book }))
        nextMeta = response.meta
      }

      setItems(nextItems)
      setMeta(nextMeta)
      setMode(selectedMode)
      setGenre(selectedGenre)
      setPage(nextPage)

      if (options?.updateUrl !== false) {
        const params = new URLSearchParams()
        params.set("q", trimmedQuery)
        params.set("mode", selectedMode)
        params.set("page", String(nextPage))
        if (selectedGenre) params.set("genre", selectedGenre)
        router.replace(`${callbackPath}?${params.toString()}`, { scroll: false })
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Pencarian gagal.")
      setItems([])
      setMeta(null)
    } finally {
      setLoading(false)
    }
  }

  function handleSave(book: Book) {
    if (!session?.user?.id) {
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackPath)}`)
      return
    }

    const note = window.prompt("Catatan pribadi untuk rantai ini (opsional):", "")
    void createSavedChain(
      {
        bookId: book.id,
        query: book.titleAr || null,
        note: note?.trim() || null,
      },
      session.user.id
    )
      .then(() => {
        window.alert("Rantai tersimpan.")
      })
      .catch((saveError) => {
        window.alert(saveError instanceof Error ? saveError.message : "Gagal menyimpan rantai.")
      })
  }

  const sortedItems = useMemo(() => {
    const copy = [...items]

    const yearOf = (item: ResultItem) => (item.kind === "book" ? item.book.author.yearDeath ?? 0 : item.item.book.author.yearDeath ?? 0)

    copy.sort((left, right) => {
      const leftYear = yearOf(left)
      const rightYear = yearOf(right)
      return sortAscending ? leftYear - rightYear : rightYear - leftYear
    })

    return copy
  }, [items, sortAscending])

  return (
    <section className={joinClasses("tc-section-stack", compact && "tc-search-compact")}>
      {!compact && (
        <div className="tc-hero">
          <div className="tc-hero-badge">
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor", display: "inline-block" }} />
            Corpus OpenITI + Usul.ai
          </div>
          <h1 className="tc-hero-title">
            Telusuri rantai
            <br />
            <span className="accent">teks Islam klasik</span>
          </h1>
          <p className="tc-hero-subtitle">
            Cari topik, baca hubungan kitab, dan ikuti jalur perkembangan ilmu dari sumber yang lebih baru menuju
            sumber paling awal yang masih bisa dilacak.
          </p>
        </div>
      )}

      <div className="tc-search-box">
        <div className="tc-search-top">
          <div className="tc-tab-group" role="tablist" aria-label="Mode pencarian">
            <button type="button" className={joinClasses("tc-tab", mode === "topic" && "is-active")} onClick={() => setMode("topic")}>
              Topik
            </button>
            <button type="button" className={joinClasses("tc-tab", mode === "exact" && "is-active")} onClick={() => setMode("exact")}>
              Teks Persis
            </button>
          </div>

          <button
            type="button"
            className="tc-chip"
            onClick={() => setSortAscending((current) => !current)}
            title={sortToggleLabel}
          >
            <SlidersHorizontal size={14} />
            {sortToggleLabel}
          </button>
        </div>

        <div className="tc-search-grid">
          <input
            className="tc-input arabic"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={mode === "exact" ? "ابحث عن نص محدد..." : "ابحث عن موضوع..."}
            dir="rtl"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                void runSearch(query, { updateUrl: true, nextMode: mode, nextGenre: genre, nextPage: 1 })
              }
            }}
          />

          <div className="tc-filter-control" title="Filter genre">
            <Filter size={14} />
            <select
              className="tc-select"
              value={genre}
              onChange={(event) => setGenre(event.target.value)}
              disabled={mode === "exact"}
            >
              <option value="">Semua genre</option>
              {genres.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nameEn || item.nameAr || item.id}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="tc-button tc-button-primary tc-search-button"
            onClick={() => void runSearch(query, { updateUrl: true, nextMode: mode, nextGenre: genre, nextPage: 1 })}
            disabled={loading}
          >
            {loading ? <Loader2 size={14} className="tc-spinner" /> : <Search size={14} />}
            {loading ? "Mencari..." : "Cari"}
          </button>
        </div>

        <div className="tc-hints">
          <span className="tc-hints-label">Coba:</span>
          {hintQueries.map((hint) => (
            <button
              key={hint}
              type="button"
              className="tc-hint-chip"
              onClick={() => {
                setQuery(hint)
                void runSearch(hint, { updateUrl: true, nextMode: mode, nextGenre: genre, nextPage: 1 })
              }}
            >
              {hint}
            </button>
          ))}
        </div>
      </div>

      {!compact && (
        <div className="tc-stats-grid">
          <div className="tc-stat-card">
            <div className="tc-stat-value">{stats.totalBooks || "15k+"}</div>
            <div className="tc-stat-label">KITAB</div>
          </div>
          <div className="tc-stat-card">
            <div className="tc-stat-value">{stats.indexedBooks || "6k+"}</div>
            <div className="tc-stat-label">INDEXED</div>
          </div>
          <div className="tc-stat-card">
            <div className="tc-stat-value">{stats.indexedPages || "900 H"}</div>
            <div className="tc-stat-label">PAGES</div>
          </div>
          <div className="tc-stat-card">
            <div className="tc-stat-value">Real</div>
            <div className="tc-stat-label">{health || "SOURCE"}</div>
          </div>
        </div>
      )}

      {didSearch && (
        <div className="tc-section-stack">
          <div className="tc-section-header">
            <div>
              <h2 className="tc-section-title">Hasil pencarian</h2>
              <p className="tc-section-subtitle">
                {meta ? `${meta.total} hasil ditemukan` : "Data hasil akan muncul di sini."}
              </p>
            </div>
            {meta && (
              <div className="tc-results-meta">
                Halaman {meta.page} / {meta.totalPages}
              </div>
            )}
          </div>

          {error ? (
            <EmptyState title="Tidak ditemukan" subtitle={error} />
          ) : loading ? (
            <LoadingList />
          ) : sortedItems.length > 0 ? (
            <div className="tc-results-list">
              {sortedItems.map((item) => (
                <div key={item.kind === "book" ? item.book.id : item.item.id} className="tc-timeline-item">
                  <div className="tc-timeline-year">
                    <span className="tc-year-pill">{formatYearDeath(item.kind === "book" ? item.book.author.yearDeath : item.item.book.author.yearDeath)}</span>
                    <span className="tc-year-rail" />
                  </div>
                  <div className="tc-timeline-card">
                    <SearchResultCard
                      item={item}
                      query={query}
                      onSave={handleSave}
                      userId={session?.user?.id}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Tidak ditemukan"
              subtitle="Coba kata kunci lain, ubah mode pencarian, atau perluas filter genre."
            />
          )}

          {meta && meta.totalPages > 1 && (
            <div className="tc-pagination">
              <button
                type="button"
                onClick={() => void runSearch(query, { updateUrl: true, nextMode: mode, nextGenre: genre, nextPage: Math.max(1, page - 1) })}
                disabled={page <= 1 || loading}
              >
                <ChevronLeft size={16} />
              </button>

              {Array.from({ length: Math.min(meta.totalPages, 5) }).map((_, index) => {
                const target = index + 1
                return (
                  <button
                    key={target}
                    type="button"
                    className={joinClasses(target === page && "is-active")}
                    onClick={() => void runSearch(query, { updateUrl: true, nextMode: mode, nextGenre: genre, nextPage: target })}
                    disabled={loading}
                  >
                    {target}
                  </button>
                )
              })}

              <button
                type="button"
                onClick={() => void runSearch(query, { updateUrl: true, nextMode: mode, nextGenre: genre, nextPage: Math.min(meta.totalPages, page + 1) })}
                disabled={page >= meta.totalPages || loading}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
