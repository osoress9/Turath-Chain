import type {
  ApiError,
  Book,
  ChainNode,
  ContentSearchResult,
  Genre,
  ProfileSummary,
  SavedChain,
  SearchMeta,
} from "@/lib/types"

const DEFAULT_BASE_URL = "http://localhost:3001"

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || DEFAULT_BASE_URL).replace(/\/$/, "")

type ApiEnvelope<T> = {
  data?: T
  meta?: SearchMeta
  error?: ApiError | string
}

async function apiFetch<T>(path: string, init?: RequestInit, userId?: string | null): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set("Accept", "application/json")
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  if (userId && !headers.has("x-user-id")) {
    headers.set("x-user-id", userId)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  })

  const contentType = response.headers.get("content-type") ?? ""
  const payload = contentType.includes("application/json") ? await response.json() : null

  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : payload?.error?.message ?? response.statusText
    throw new Error(message || "Request gagal")
  }

  return payload as T
}

export async function fetchHealth() {
  return apiFetch<{ status: string; message: string }>("/api/health")
}

export async function fetchGenres() {
  const response = await apiFetch<ApiEnvelope<Genre[]>>("/api/genres")
  return response.data ?? []
}

export async function fetchContentStatus() {
  const response = await apiFetch<
    ApiEnvelope<{ indexedPages: number; indexedBooks: number; totalBooks: number }>
  >("/api/content-search/status")
  return response.data ?? { indexedPages: 0, indexedBooks: 0, totalBooks: 0 }
}

export async function searchBooks(params: {
  q: string
  genre?: string
  page?: number
  limit?: number
}) {
  const query = new URLSearchParams()
  query.set("q", params.q)
  if (params.genre) query.set("genre", params.genre)
  query.set("page", String(params.page ?? 1))
  query.set("limit", String(params.limit ?? 20))
  const response = await apiFetch<ApiEnvelope<Book[]>>(`/api/search?${query.toString()}`)
  return {
    data: response.data ?? [],
    meta: response.meta ?? { total: 0, page: 1, limit: params.limit ?? 20, totalPages: 1 },
  }
}

export async function searchContent(params: {
  q: string
  page?: number
  limit?: number
}) {
  const query = new URLSearchParams()
  query.set("q", params.q)
  query.set("page", String(params.page ?? 1))
  query.set("limit", String(params.limit ?? 20))
  const response = await apiFetch<ApiEnvelope<ContentSearchResult[]>>(
    `/api/content-search?${query.toString()}`
  )
  return {
    data: response.data ?? [],
    meta: response.meta ?? { total: 0, page: 1, limit: params.limit ?? 20, totalPages: 1 },
  }
}

export async function fetchBook(slug: string) {
  const response = await apiFetch<ApiEnvelope<Book & { relations: unknown[]; relatedFrom: unknown[]; versions: unknown[] }>>(
    `/api/books/${encodeURIComponent(slug)}`
  )
  return response.data
}

export async function fetchBookChain(slug: string) {
  const response = await apiFetch<ApiEnvelope<ChainNode>>(`/api/books/${encodeURIComponent(slug)}/chain`)
  return response.data
}

export async function fetchBookContentPreview(slug: string) {
  const response = await apiFetch<ApiEnvelope<{ text: string; source: string; value: string }>>(
    `/api/books/${encodeURIComponent(slug)}/content`
  )
  return response.data
}

export async function fetchBookContentSearch(slug: string, q: string) {
  const query = new URLSearchParams({ q })
  const response = await apiFetch<ApiEnvelope<ContentSearchResult[]>>(
    `/api/books/${encodeURIComponent(slug)}/content/search?${query.toString()}`
  )
  return {
    data: response.data ?? [],
    meta: response.meta ?? { total: 0, page: 1, limit: 20, totalPages: 1 },
  }
}

export async function fetchSavedChains(userId?: string | null) {
  const response = await apiFetch<ApiEnvelope<SavedChain[]>>("/api/saved", undefined, userId)
  return response.data ?? []
}

export async function createSavedChain(
  body: { bookId: string; note?: string | null; query?: string | null },
  userId?: string | null
) {
  const response = await apiFetch<ApiEnvelope<SavedChain>>("/api/saved", {
    method: "POST",
    body: JSON.stringify(body),
  }, userId)
  return response.data
}

export async function deleteSavedChain(id: string, userId?: string | null) {
  await apiFetch<ApiEnvelope<{ success: boolean }>>(`/api/saved/${encodeURIComponent(id)}`, {
    method: "DELETE",
  }, userId)
}

export async function fetchProfile(userId?: string | null) {
  const response = await apiFetch<ApiEnvelope<ProfileSummary>>("/api/profile", undefined, userId)
  return response.data
}

export async function loginWithCredentials(email: string, password: string) {
  return apiFetch<{ id: string; email: string; name: string | null; image: string | null }>(
    "/api/auth/verify-credentials",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }
  )
}

export async function loginWithGoogleProfile(payload: {
  email: string
  name?: string | null
  image?: string | null
  providerAccountId: string
}) {
  const response = await apiFetch<ApiEnvelope<{ id: string; email: string; name: string | null; image: string | null }>>(
    "/api/auth/oauth",
    {
      method: "POST",
      body: JSON.stringify({
        email: payload.email,
        name: payload.name ?? null,
        image: payload.image ?? null,
        provider: "google",
        providerAccountId: payload.providerAccountId,
      }),
    }
  )
  return response.data
}
