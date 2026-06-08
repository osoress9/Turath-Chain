"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { BookmarkMinus, LogIn, Trash2, UserRound } from "lucide-react"
import { deleteSavedChain, fetchProfile, fetchSavedChains } from "@/lib/api"
import { formatDate, formatYearDeath } from "@/lib/format"
import type { ProfileSummary, SavedChain } from "@/lib/types"

function SavedChainCard({
  item,
  onDelete,
}: {
  item: SavedChain
  onDelete: (id: string) => void
}) {
  return (
    <article className="tc-card tc-animate-in">
      <div className="tc-card-header">
        <div className="tc-card-main">
          <div className="tc-badge-row">
            <span className="tc-badge genre">{item.book.genres[0]?.genre.nameEn || item.book.genres[0]?.genre.nameAr || "Book"}</span>
          </div>
          <h3 className="tc-book-title">{item.book.titleAr}</h3>
          <p className="tc-book-subtitle">
            {item.book.transliteration || item.book.titleEn || "-"} · {item.book.author.nameAr} · {formatYearDeath(item.book.author.yearDeath)}
          </p>
        </div>
        <span className="tc-badge exact">Tersimpan</span>
      </div>

      <div className="tc-floating-note">
        <strong>Query:</strong> {item.query || "-"}
        <br />
        <strong>Catatan:</strong> {item.note || "Tidak ada catatan"}
      </div>

      <div className="tc-card-footer">
        <span className="tc-muted tc-small">{formatDate(item.createdAt)}</span>
        <div className="tc-action-row">
          <Link href={`/kitab/${item.book.slug}`} className="tc-chip">
            Buka
          </Link>
          <button type="button" className="tc-chip" onClick={() => onDelete(item.id)}>
            <Trash2 size={14} />
            Hapus
          </button>
        </div>
      </div>
    </article>
  )
}

export function SavedView() {
  const { data: session } = useSession()
  const router = useRouter()

  const [items, setItems] = useState<SavedChain[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.user?.id) {
      setLoading(false)
      return
    }

    let mounted = true
    setLoading(true)

    fetchSavedChains(session.user.id)
      .then((saved) => {
        if (!mounted) return
        setItems(saved)
      })
      .catch((requestError) => {
        if (!mounted) return
        setError(requestError instanceof Error ? requestError.message : "Gagal memuat data tersimpan.")
      })
      .finally(() => {
        if (!mounted) return
        setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [session?.user?.id])

  async function handleDelete(id: string) {
    if (!session?.user?.id) return
    if (!window.confirm("Hapus rantai tersimpan ini?")) return

    await deleteSavedChain(id, session.user.id)
    setItems((current) => current.filter((item) => item.id !== id))
  }

  if (!session?.user?.id) {
    return (
      <div className="tc-empty-state">
        <LogIn size={40} strokeWidth={1.6} />
        <div>
          <h3>Perlu login</h3>
          <p>Login terlebih dahulu untuk melihat rantai yang Anda simpan.</p>
        </div>
        <Link href="/login" className="tc-button tc-button-primary">
          Masuk
        </Link>
      </div>
    )
  }

  return (
    <section className="tc-section-stack">
      <div className="tc-section-header">
        <div>
          <h1 className="tc-section-title">Rantai tersimpan</h1>
          <p className="tc-section-subtitle">Daftar penelusuran yang pernah Anda simpan.</p>
        </div>
        <div className="tc-results-meta">
          <BookmarkMinus size={14} />
          {items.length} item
        </div>
      </div>

      {loading ? (
        <div className="tc-grid-2">
          <div className="tc-skeleton tc-skeleton-card" />
          <div className="tc-skeleton tc-skeleton-card" />
        </div>
      ) : error ? (
        <div className="tc-empty-state">
          <UserRound size={40} strokeWidth={1.6} />
          <div>
            <h3>Gagal memuat</h3>
            <p>{error}</p>
          </div>
        </div>
      ) : items.length > 0 ? (
        <div className="tc-grid-2">
          {items.map((item) => (
            <SavedChainCard key={item.id} item={item} onDelete={handleDelete} />
          ))}
        </div>
      ) : (
        <div className="tc-empty-state">
          <BookmarkMinus size={40} strokeWidth={1.6} />
          <div>
            <h3>Belum ada simpanan</h3>
            <p>Coba cari kitab lalu simpan rantainya dari halaman detail.</p>
          </div>
          <button type="button" className="tc-button tc-button-primary" onClick={() => router.push("/cari")}>
            Mulai cari
          </button>
        </div>
      )}
    </section>
  )
}

export function ProfileView() {
  const { data: session } = useSession()

  const [profile, setProfile] = useState<ProfileSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.user?.id) {
      setLoading(false)
      return
    }

    let mounted = true
    setLoading(true)

    fetchProfile(session.user.id)
      .then((data) => {
        if (!mounted) return
        setProfile(data ?? null)
      })
      .catch((requestError) => {
        if (!mounted) return
        setError(requestError instanceof Error ? requestError.message : "Gagal memuat profil.")
      })
      .finally(() => {
        if (!mounted) return
        setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [session?.user?.id])

  if (!session?.user?.id) {
    return (
      <div className="tc-empty-state">
        <LogIn size={40} strokeWidth={1.6} />
        <div>
          <h3>Perlu login</h3>
          <p>Login terlebih dahulu untuk membuka profil Anda.</p>
        </div>
        <Link href="/login" className="tc-button tc-button-primary">
          Masuk
        </Link>
      </div>
    )
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

  if (error || !profile) {
    return (
      <div className="tc-empty-state">
        <UserRound size={40} strokeWidth={1.6} />
        <div>
          <h3>Gagal memuat profil</h3>
          <p>{error || "Profil belum tersedia."}</p>
        </div>
      </div>
    )
  }

  return (
    <section className="tc-section-stack">
      <div className="tc-page-head">
        <div className="tc-section-header">
          <div>
            <h1 className="tc-section-title">Profil pengguna</h1>
            <p className="tc-section-subtitle">{profile.user.email}</p>
          </div>
          <div className="tc-results-meta">Aktif</div>
        </div>
      </div>

      <div className="tc-grid-2">
        <div className="tc-panel">
          <h2 className="tc-panel-title">Statistik</h2>
          <div className="tc-stats-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <div className="tc-stat-card">
              <div className="tc-stat-value">{profile.stats.savedCount}</div>
              <div className="tc-stat-label">TERSIMPAN</div>
            </div>
            <div className="tc-stat-card">
              <div className="tc-stat-value">{profile.stats.uniqueBooksCount}</div>
              <div className="tc-stat-label">KITAB UNIK</div>
            </div>
            <div className="tc-stat-card">
              <div className="tc-stat-value">{profile.stats.loginCount}</div>
              <div className="tc-stat-label">LOGIN</div>
            </div>
            <div className="tc-stat-card">
              <div className="tc-stat-value">{profile.stats.connectedProviders.length}</div>
              <div className="tc-stat-label">PROVIDER</div>
            </div>
          </div>
        </div>

        <div className="tc-panel">
          <h2 className="tc-panel-title">Akun</h2>
          <div className="tc-floating-note">
            <strong>Nama:</strong> {profile.user.name || "-"}
            <br />
            <strong>Email:</strong> {profile.user.email}
            <br />
            <strong>Login terakhir:</strong> {formatDate(profile.stats.lastLoginAt)}
            <br />
            <strong>Simpan terakhir:</strong> {profile.stats.lastSavedAt ? formatDate(profile.stats.lastSavedAt) : "-"}
          </div>
          <div className="tc-badge-row" style={{ marginTop: 12 }}>
            {profile.stats.connectedProviders.map((provider) => (
              <span key={provider} className="tc-badge exact">
                {provider}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="tc-grid-2">
        <div className="tc-panel">
          <h2 className="tc-panel-title">Rantai terbaru</h2>
          <div className="tc-results-list">
            {profile.recentSavedChains.length > 0 ? (
              profile.recentSavedChains.map((item) => (
                <div key={item.id} className="tc-card">
                  <h3 className="tc-book-title">{item.book.titleAr}</h3>
                  <p className="tc-book-subtitle">{item.note || "Tanpa catatan"}</p>
                </div>
              ))
            ) : (
              <div className="tc-floating-note">Belum ada simpanan.</div>
            )}
          </div>
        </div>

        <div className="tc-panel">
          <h2 className="tc-panel-title">Riwayat login</h2>
          <div className="tc-results-list">
            {profile.loginHistory.length > 0 ? (
              profile.loginHistory.map((entry) => (
                <div key={entry.id} className="tc-card">
                  <div className="tc-panel-meta">
                    <span className="tc-badge exact">{entry.provider}</span>
                    <span>{formatDate(entry.createdAt)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="tc-floating-note">Belum ada riwayat login.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
