"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Search, SearchX, Users } from "lucide-react"
import { fetchGenres, historicalLineageSearch, historicalYearSearch } from "@/lib/api"
import type {
  Genre,
  HistoricalAuthorSummary,
  HistoricalLineageResponse,
  HistoricalYearItem,
  HistoricalYearSearchResponse,
} from "@/lib/types"
import { formatYearDeath, joinClasses } from "@/lib/format"

type HistoricalTab = "year" | "lineage"

const DEFAULT_YEAR_META: HistoricalYearSearchResponse["meta"] = {
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 1,
}

function HistoricalSkeleton() {
  return (
    <div className="tc-results-list">
      {Array.from({ length: 3 }).map((_, index) => (
        <article key={index} className="tc-card">
          <div className="tc-skeleton-stack">
            <div className="tc-skeleton tc-skeleton-line short" />
            <div className="tc-skeleton tc-skeleton-line long" />
            <div className="tc-skeleton tc-skeleton-line medium" />
            <div className="tc-skeleton tc-skeleton-line long" style={{ height: 90 }} />
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

function BookGenreBadges({ genres }: { genres: HistoricalYearItem["book"]["genres"] }) {
  if (genres.length === 0) {
    return <span className="tc-muted">Genre belum tersedia</span>
  }

  return (
    <>
      {genres.map((genre) => (
        <span key={genre.id} className="tc-badge summary">
          {genre.nameAr || genre.nameEn || genre.id}
        </span>
      ))}
    </>
  )
}

function YearResultCard({ item }: { item: HistoricalYearItem }) {
  return (
    <article className="tc-card tc-animate-in">
      <div className="tc-card-header">
        <div className="tc-card-main">
          <div className="tc-badge-row">
            <span className="tc-badge exact">Kitab</span>
            <span className="tc-badge genre">Berdasarkan Tahun</span>
          </div>
          <h3 className="tc-book-title arabic">{item.book.titleAr}</h3>
          <p className="tc-book-subtitle">
            {item.book.transliteration || item.book.titleEn || "-"} · {item.author.nameAr} ·{" "}
            {item.author.yearDeath ? formatYearDeath(item.author.yearDeath) : "Tahun wafat belum tersedia"}
          </p>
        </div>
      </div>

      <div className="tc-badge-row" style={{ marginBottom: 12 }}>
        <BookGenreBadges genres={item.book.genres} />
      </div>

      <div className="tc-snippet">{item.filterReason}</div>
    </article>
  )
}

function PersonCard({
  author,
  label,
}: {
  author: HistoricalAuthorSummary
  label: string
}) {
  return (
    <article className="tc-card tc-animate-in" style={{ height: "100%" }}>
      <div className="tc-card-header">
        <div className="tc-card-main">
          <div className="tc-badge-row">
            <span className="tc-badge develop">{label}</span>
            <span className="tc-badge summary">{author.works.length} kitab</span>
          </div>
          <h3 className="tc-book-title arabic">{author.nameAr}</h3>
          <p className="tc-book-subtitle">{author.yearDeath ? formatYearDeath(author.yearDeath) : "Tahun wafat belum tersedia"}</p>
        </div>
      </div>

      <div className="tc-section-stack" style={{ gap: 10 }}>
        {author.works.length > 0 ? (
          author.works.map((work) => (
            <div key={work.id} className="tc-card" style={{ padding: 14, background: "var(--surface-2)", boxShadow: "none" }}>
              <div className="tc-card-main">
                <h4 className="tc-book-title arabic" style={{ fontSize: 17, marginBottom: 4 }}>
                  {work.titleAr}
                </h4>
                <div className="tc-badge-row">
                  {work.genres.length > 0 ? (
                    work.genres.map((genre) => (
                      <span key={genre.id} className="tc-badge genre">
                        {genre.nameAr || genre.nameEn || genre.id}
                      </span>
                    ))
                  ) : (
                    <span className="tc-muted">Genre belum tersedia</span>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="tc-empty-state" style={{ padding: 0, border: 0, background: "transparent" }}>
            <SearchX size={28} strokeWidth={1.6} />
            <div>
              <h3>Belum ada karya</h3>
              <p>Data kitab untuk muallif ini belum tersedia di database.</p>
            </div>
          </div>
        )}
      </div>
    </article>
  )
}

function LineageGrid({
  author,
  teachers,
  students,
  dataNote,
}: HistoricalLineageResponse["data"]) {
  return (
    <div className="tc-section-stack">
      {dataNote ? (
        <div className="tc-card" style={{ background: "var(--blue-50)", borderColor: "var(--blue-200)", boxShadow: "none" }}>
          <div className="tc-badge-row" style={{ marginBottom: 10 }}>
            <span className="tc-badge exact">Info</span>
          </div>
          <p className="tc-snippet" style={{ margin: 0 }}>
            {dataNote}
          </p>
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 16,
        }}
      >
        <PersonCard author={author} label="Muallif Dipilih" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        <div className="tc-section-stack">
          <div className="tc-section-header">
            <div>
              <h3 className="tc-section-title">Guru</h3>
              <p className="tc-section-subtitle">Gurudan guru-dari-guru hingga kedalaman yang dipilih.</p>
            </div>
          </div>
          {teachers.length > 0 ? (
            <div className="tc-results-list">
              {teachers.map((teacher) => (
                <PersonCard key={teacher.id} author={teacher} label="Guru" />
              ))}
            </div>
          ) : (
            <EmptyState title="Tidak ada guru" subtitle="Relasi guru-murid untuk muallif ini belum tersimpan di database." />
          )}
        </div>

        <div className="tc-section-stack">
          <div className="tc-section-header">
            <div>
              <h3 className="tc-section-title">Murid</h3>
              <p className="tc-section-subtitle">Murid langsung dan murid-dari-murid hingga kedalaman yang dipilih.</p>
            </div>
          </div>
          {students.length > 0 ? (
            <div className="tc-results-list">
              {students.map((student) => (
                <PersonCard key={student.id} author={student} label="Murid" />
              ))}
            </div>
          ) : (
            <EmptyState title="Tidak ada murid" subtitle="Relasi guru-murid untuk muallif ini belum tersimpan di database." />
          )}
        </div>
      </div>
    </div>
  )
}

export function HistoricalSearch() {
  const [tab, setTab] = useState<HistoricalTab>("year")
  const [genres, setGenres] = useState<Genre[]>([])
  const [genre, setGenre] = useState("")
  const [q, setQ] = useState("")
  const [from, setFrom] = useState("300")
  const [to, setTo] = useState("400")
  const [yearPage, setYearPage] = useState(1)
  const [yearLoading, setYearLoading] = useState(false)
  const [yearError, setYearError] = useState<string | null>(null)
  const [yearHasSearched, setYearHasSearched] = useState(false)
  const [yearMeta, setYearMeta] = useState(DEFAULT_YEAR_META)
  const [yearItems, setYearItems] = useState<HistoricalYearItem[]>([])

  const [lineageQuery, setLineageQuery] = useState("")
  const [lineageDepth, setLineageDepth] = useState<1 | 2>(1)
  const [lineageLoading, setLineageLoading] = useState(false)
  const [lineageError, setLineageError] = useState<string | null>(null)
  const [lineageHasSearched, setLineageHasSearched] = useState(false)
  const [lineageData, setLineageData] = useState<HistoricalLineageResponse["data"] | null>(null)

  useEffect(() => {
    let mounted = true
    fetchGenres()
      .then((data) => {
        if (mounted) setGenres(data)
      })
      .catch(() => {
        if (mounted) setGenres([])
      })

    return () => {
      mounted = false
    }
  }, [])

  async function runYearSearch(nextPage = 1) {
    const fromValue = Number.parseInt(from, 10)
    const toValue = Number.parseInt(to, 10)

    if (Number.isNaN(fromValue) || Number.isNaN(toValue)) {
      setYearError("Masukkan angka tahun yang valid.")
      setYearItems([])
      setYearHasSearched(true)
      return
    }

    setYearLoading(true)
    setYearError(null)
    setYearHasSearched(true)

    try {
      const response = await historicalYearSearch({
        from: fromValue,
        to: toValue,
        genre: genre || undefined,
        q: q.trim() || undefined,
        page: nextPage,
        limit: 20,
      })
      setYearItems(response.data)
      setYearMeta(response.meta)
      setYearPage(nextPage)
    } catch (requestError) {
      setYearError(requestError instanceof Error ? requestError.message : "Pencarian tahun gagal.")
      setYearItems([])
      setYearMeta(DEFAULT_YEAR_META)
    } finally {
      setYearLoading(false)
    }
  }

  async function runLineageSearch() {
    const trimmed = lineageQuery.trim()
    if (!trimmed) {
      setLineageError("Masukkan nama muallif terlebih dahulu.")
      setLineageData(null)
      setLineageHasSearched(true)
      return
    }

    setLineageLoading(true)
    setLineageError(null)
    setLineageHasSearched(true)

    try {
      const response = await historicalLineageSearch(trimmed, lineageDepth)
      setLineageData(response.data)
    } catch (requestError) {
      setLineageError(requestError instanceof Error ? requestError.message : "Pencarian silsilah gagal.")
      setLineageData(null)
    } finally {
      setLineageLoading(false)
    }
  }

  const totalPages = useMemo(() => Math.max(1, yearMeta.totalPages), [yearMeta.totalPages])

  return (
    <section className="tc-section-stack">
      <div className="tc-page-head">
        <div className="tc-badge-row">
          <span className="tc-badge exact">Sejarah</span>
          <span className="tc-badge genre">Silsilah Guru-Murid</span>
        </div>
        <h1 className="tc-section-title">Sejarah & Silsilah</h1>
        <p className="tc-section-subtitle">
          Telusuri kitab berdasarkan masa muallif dan lihat hubungan guru-murid sampai kedalaman yang dibutuhkan.
        </p>
      </div>

      <div className="tc-search-box">
        <div className="tc-tab-group" role="tablist" aria-label="Mode sejarah">
          <button
            type="button"
            className={joinClasses("tc-tab", tab === "year" && "is-active")}
            onClick={() => setTab("year")}
          >
            Tahun
          </button>
          <button
            type="button"
            className={joinClasses("tc-tab", tab === "lineage" && "is-active")}
            onClick={() => setTab("lineage")}
          >
            Silsilah Kitab
          </button>
        </div>
      </div>

      {tab === "year" ? (
        <div className="tc-section-stack">
          <div className="tc-card" style={{ background: "var(--blue-50)", borderColor: "var(--blue-200)", boxShadow: "none" }}>
            <div className="tc-badge-row" style={{ marginBottom: 10 }}>
              <span className="tc-badge exact">
                <AlertTriangle size={14} />
              </span>
            </div>
            <p className="tc-snippet" style={{ margin: 0 }}>
              Berdasarkan masa muallif, bukan tahun pasti penulisan kitab.
            </p>
          </div>

          <div className="tc-search-box">
            <div className="tc-search-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr)) auto" }}>
              <input
                className="tc-input"
                type="number"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                placeholder="Dari"
              />
              <input
                className="tc-input"
                type="number"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                placeholder="Sampai"
              />
              <select className="tc-select" value={genre} onChange={(event) => setGenre(event.target.value)}>
                <option value="">Semua genre</option>
                {genres.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nameEn || item.nameAr || item.id}
                  </option>
                ))}
              </select>
              <input
                className="tc-input arabic"
                dir="rtl"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="كلمة مفتاحية اختيارية..."
              />
              <button type="button" className="tc-button tc-button-primary tc-search-button" onClick={() => void runYearSearch(1)}>
                {yearLoading ? <Loader2 size={14} className="tc-spinner" /> : <Search size={14} />}
                {yearLoading ? "Mencari..." : "Tampilkan"}
              </button>
            </div>
          </div>

          {yearHasSearched && (
            <>
              {yearError ? (
                <div className="tc-empty-state">
                  <SearchX size={36} strokeWidth={1.6} />
                  <div>
                    <h3>Pencarian tahun gagal</h3>
                    <p>{yearError}</p>
                  </div>
                  <button type="button" className="tc-button tc-button-primary" onClick={() => void runYearSearch(yearPage)}>
                    Coba Lagi
                  </button>
                </div>
              ) : yearLoading ? (
                <HistoricalSkeleton />
              ) : yearItems.length > 0 ? (
                <>
                  <div className="tc-results-list">
                    {yearItems.map((item, index) => (
                      <YearResultCard key={`${item.book.id}-${index}`} item={item} />
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <div className="tc-pagination">
                      <button
                        type="button"
                        onClick={() => void runYearSearch(Math.max(1, yearPage - 1))}
                        disabled={yearPage <= 1}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      {Array.from({ length: Math.min(totalPages, 5) }).map((_, index) => {
                        const target = index + 1
                        return (
                          <button
                            key={target}
                            type="button"
                            className={joinClasses(target === yearPage && "is-active")}
                            onClick={() => void runYearSearch(target)}
                          >
                            {target}
                          </button>
                        )
                      })}
                      <button
                        type="button"
                        onClick={() => void runYearSearch(Math.min(totalPages, yearPage + 1))}
                        disabled={yearPage >= totalPages}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <EmptyState title="Tidak ada hasil" subtitle="Coba rentang tahun lain atau ubah filter genre." />
              )}
            </>
          )}
        </div>
      ) : (
        <div className="tc-section-stack">
          <div className="tc-card" style={{ background: "var(--surface-2)", boxShadow: "none" }}>
            <div className="tc-badge-row" style={{ marginBottom: 10 }}>
              <span className="tc-badge genre">Cari guru dan murid</span>
            </div>
            <p className="tc-snippet" style={{ margin: 0 }}>
              Gunakan nama muallif atau ID untuk melihat relasi guru-murid. Kedalaman maksimum 2.
            </p>
          </div>

          <div className="tc-search-box">
            <div className="tc-search-grid" style={{ gridTemplateColumns: "minmax(0, 1fr) auto auto" }}>
              <input
                className="tc-input arabic"
                dir="rtl"
                value={lineageQuery}
                onChange={(event) => setLineageQuery(event.target.value)}
                placeholder="ابحث عن اسم المؤلف أو المعرّف..."
              />
              <select
                className="tc-select"
                value={lineageDepth}
                onChange={(event) => setLineageDepth(Number(event.target.value) as 1 | 2)}
              >
                <option value={1}>Kedalaman 1</option>
                <option value={2}>Kedalaman 2</option>
              </select>
              <button type="button" className="tc-button tc-button-primary tc-search-button" onClick={() => void runLineageSearch()}>
                {lineageLoading ? <Loader2 size={14} className="tc-spinner" /> : <Users size={14} />}
                {lineageLoading ? "Mencari..." : "Cari"}
              </button>
            </div>
          </div>

          {lineageHasSearched && (
            <>
              {lineageError ? (
                <div className="tc-empty-state">
                  <SearchX size={36} strokeWidth={1.6} />
                  <div>
                    <h3>Pencarian silsilah gagal</h3>
                    <p>{lineageError}</p>
                  </div>
                  <button type="button" className="tc-button tc-button-primary" onClick={() => void runLineageSearch()}>
                    Coba Lagi
                  </button>
                </div>
              ) : lineageLoading ? (
                <HistoricalSkeleton />
              ) : lineageData ? (
                <LineageGrid {...lineageData} />
              ) : (
                <EmptyState title="Tidak ada data" subtitle="Masukkan nama muallif untuk melihat silsilah." />
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}
