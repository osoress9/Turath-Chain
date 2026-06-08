import type { BookVersion } from "@prisma/client"

const DEFAULT_USUL_ASSETS_URL = "https://assets.usul.ai"
const MAX_PREVIEW_LENGTH = 2_000
const MAX_CONTENT_SEARCH_RESULTS = 10

export interface IUsulPage {
  text?: unknown
  vol?: unknown
  page?: unknown
}

export interface IUsulBookContent {
  pages?: unknown
  sections?: unknown
}

export interface IBookContentPreview {
  textContent: string | null
  version: {
    id: string
    source: string
    value: string
  } | null
}

export interface IBookContentSearchResult {
  text: string
  page: string | null
  volume: string | null
  version: {
    id: string
    source: string
    value: string
  }
}

export function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function normalizeForSearch(input: string): string {
  return stripHtml(input)
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase()
}

export function makeSnippet(text: string, query: string): string {
  const cleanText = stripHtml(text)
  const normalizedText = normalizeForSearch(cleanText)
  const normalizedQuery = normalizeForSearch(query)
  const index = normalizedText.indexOf(normalizedQuery)
  const start = Math.max(0, index === -1 ? 0 : index - 140)
  const end = Math.min(cleanText.length, (index === -1 ? 0 : index) + normalizedQuery.length + 220)

  return cleanText.slice(start, end).trim()
}

function extractTextFromContent(content: IUsulBookContent): string | null {
  if (Array.isArray(content.pages)) {
    const pageText = content.pages
      .map((page: unknown) => {
        const candidate = page as IUsulPage
        return typeof candidate.text === "string" ? candidate.text : ""
      })
      .filter(Boolean)
      .join("\n\n")

    if (pageText.trim()) {
      return stripHtml(pageText).slice(0, MAX_PREVIEW_LENGTH)
    }
  }

  if (Array.isArray(content.sections)) {
    const sectionText = content.sections
      .map((section: unknown) => {
        const candidate = section as IUsulPage
        return typeof candidate.text === "string" ? candidate.text : ""
      })
      .filter(Boolean)
      .join("\n\n")

    if (sectionText.trim()) {
      return stripHtml(sectionText).slice(0, MAX_PREVIEW_LENGTH)
    }
  }

  return null
}

export async function fetchVersionContent(version: BookVersion): Promise<IUsulBookContent | null> {
  const baseUrl = process.env.USUL_ASSETS_URL ?? DEFAULT_USUL_ASSETS_URL
  const url = `${baseUrl.replace(/\/$/, "")}/book-content/${version.source}/${version.value}.json`

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
    })

    if (!response.ok) {
      return null
    }

    return (await response.json()) as IUsulBookContent
  } catch (error) {
    console.error(`[BookContentService] Failed to fetch content for ${version.id}:`, error)
    return null
  }
}

export function extractPagesFromContent(content: IUsulBookContent): IUsulPage[] {
  if (!Array.isArray(content.pages)) return []

  return content.pages
    .map((page: unknown) => page as IUsulPage)
    .filter((page) => typeof page.text === "string")
}

export async function getBookContentPreview(versions: BookVersion[]): Promise<IBookContentPreview> {
  for (const version of versions) {
    const content = await fetchVersionContent(version)
    if (!content) continue

    const textContent = extractTextFromContent(content)
    if (textContent) {
      return {
        textContent,
        version: {
          id: version.id,
          source: version.source,
          value: version.value,
        },
      }
    }
  }

  return {
    textContent: null,
    version: null,
  }
}

export async function searchBookContent(
  versions: BookVersion[],
  query: string
): Promise<IBookContentSearchResult[]> {
  const normalizedQuery = normalizeForSearch(query)
  if (!normalizedQuery) return []

  const results: IBookContentSearchResult[] = []

  for (const version of versions) {
    const content = await fetchVersionContent(version)
    if (!content) continue

    for (const candidate of extractPagesFromContent(content)) {
      if (typeof candidate.text !== "string") continue
      if (!normalizeForSearch(candidate.text).includes(normalizedQuery)) continue

      results.push({
        text: makeSnippet(candidate.text, query),
        page: typeof candidate.page === "string" || typeof candidate.page === "number"
          ? String(candidate.page)
          : null,
        volume: typeof candidate.vol === "string" || typeof candidate.vol === "number"
          ? String(candidate.vol)
          : null,
        version: {
          id: version.id,
          source: version.source,
          value: version.value,
        },
      })

      if (results.length >= MAX_CONTENT_SEARCH_RESULTS) {
        return results
      }
    }
  }

  return results
}
