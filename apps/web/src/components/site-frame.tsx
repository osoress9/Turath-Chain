"use client"

import Link from "next/link"
import { Menu, BookOpenText, LogIn, LogOut, Search, LibraryBig, Bookmark, UserRound } from "lucide-react"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { joinClasses } from "@/lib/format"

type SiteFrameProps = {
  children: React.ReactNode
  minimal?: boolean
}

const navItems = [
  { href: "/", label: "Beranda", icon: BookOpenText },
  { href: "/cari", label: "Cari", icon: Search },
  { href: "/tersimpan", label: "Tersimpan", icon: Bookmark },
  { href: "/profil", label: "Profil", icon: UserRound },
]

export function SiteFrame({ children, minimal }: SiteFrameProps) {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <div className="tc-page-shell">
      <header className={joinClasses("tc-navbar", minimal && "tc-navbar-minimal")}>
        <div className="tc-container tc-navbar-inner">
          <Link href="/" className="tc-brand" aria-label="Turath Chain">
            <span className="tc-brand-mark">
              <LibraryBig size={18} strokeWidth={2.2} />
            </span>
            <span className="tc-brand-name">Turath Chain</span>
          </Link>

          {!minimal && (
            <>
              <nav className="tc-nav-links" aria-label="Navigasi utama">
                {navItems.map((item) => {
                  const active = pathname === item.href
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={joinClasses("tc-nav-link", active && "is-active")}
                    >
                      <Icon size={14} />
                      {item.label}
                    </Link>
                  )
                })}
              </nav>

              <details className="tc-mobile-menu">
                <summary className="tc-mobile-menu-trigger" aria-label="Buka menu">
                  <Menu size={18} />
                </summary>
                <div className="tc-mobile-menu-panel">
                  {navItems.map((item) => {
                    const active = pathname === item.href
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={joinClasses("tc-mobile-menu-link", active && "is-active")}
                      >
                        <Icon size={14} />
                        {item.label}
                      </Link>
                    )
                  })}
                  {session ? (
                    <button type="button" className="tc-mobile-menu-link" onClick={() => signOut({ callbackUrl: "/" })}>
                      <LogOut size={14} />
                      Keluar
                    </button>
                  ) : (
                    <Link href="/login" className="tc-mobile-menu-link">
                      <LogIn size={14} />
                      Masuk
                    </Link>
                  )}
                </div>
              </details>

              <div className="tc-desktop-actions">
                {session ? (
                  <>
                    <Link href="/profil" className="tc-user-pill">
                      <span className="tc-user-pill-avatar">{session.user?.name?.slice(0, 1)?.toUpperCase() || "U"}</span>
                      <span className="tc-user-pill-text">
                        <strong>{session.user?.name || session.user?.email}</strong>
                        <small>{session.user?.email}</small>
                      </span>
                    </Link>
                    <button type="button" className="tc-button tc-button-ghost" onClick={() => signOut({ callbackUrl: "/" })}>
                      <LogOut size={14} />
                      Keluar
                    </button>
                  </>
                ) : (
                  <Link href="/login" className="tc-button tc-button-primary">
                    <LogIn size={14} />
                    Masuk
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      <main className={joinClasses("tc-main", minimal && "tc-main-minimal")}>{children}</main>

      {!minimal && (
        <footer className="tc-footer">
          <div className="tc-container tc-footer-inner">
            <p>Turath Chain menghubungkan rantai intelektual teks Islam klasik.</p>
            <p className="tc-muted">OpenITI, Turath, dan Usul.ai sebagai sumber data.</p>
          </div>
        </footer>
      )}
    </div>
  )
}
