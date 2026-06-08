"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { useState } from "react"
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react"

type AuthViewProps = {
  googleEnabled: boolean
}

export function AuthView({ googleEnabled }: AuthViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = (searchParams?.get("callbackUrl") ?? "/").trim() || "/"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCredentialsSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const response = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    })

    setLoading(false)

    if (response?.error) {
      setError(response.error)
      return
    }

    router.push(response?.url || callbackUrl)
  }

  async function handleGoogleSignIn() {
    setLoading(true)
    setError(null)
    try {
      await signIn("google", {
        callbackUrl,
      })
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Google sign-in gagal.")
      setLoading(false)
    }
  }

  return (
    <div className="tc-auth-layout">
      <div className="tc-auth-card">
        <div className="tc-brand" style={{ marginBottom: 20 }}>
          <span className="tc-brand-mark">
            <ShieldCheck size={18} strokeWidth={2.2} />
          </span>
          <span className="tc-brand-name">Turath Chain</span>
        </div>

        <h1 className="tc-auth-title">Selamat Datang</h1>
        <p className="tc-auth-subtitle">
          Masuk untuk menyimpan rantai, memberi catatan pribadi, dan mengakses profil Anda.
        </p>

        <button
          type="button"
          className="tc-button tc-button-primary"
          style={{ width: "100%" }}
          onClick={handleGoogleSignIn}
          disabled={!googleEnabled || loading}
        >
          {loading ? <Loader2 size={14} /> : <ShieldCheck size={14} />}
          {googleEnabled ? "Masuk dengan Google" : "Google OAuth belum dikonfigurasi"}
        </button>

        <p className="tc-form-note">
          Jika `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` belum diisi, tombol Google akan tetap muncul tetapi
          tidak aktif.
        </p>

        <div className="tc-separator">atau</div>

        <form className="tc-form-grid" onSubmit={handleCredentialsSubmit}>
          <input
            className="tc-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
          <input
            className="tc-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            minLength={6}
            required
          />
          {error && <div className="tc-floating-note">{error}</div>}
          <button type="submit" className="tc-button tc-button-primary" disabled={loading}>
            {loading ? <Loader2 size={14} /> : <ArrowRight size={14} />}
            Masuk dengan Email
          </button>
        </form>

        <p className="tc-form-note">
          Akun baru akan dibuat jika email belum terdaftar. Lihat juga{" "}
          <Link href="/profil" className="tc-chip" style={{ padding: "2px 8px" }}>
            profil
          </Link>{" "}
          setelah masuk.
        </p>
      </div>
    </div>
  )
}
