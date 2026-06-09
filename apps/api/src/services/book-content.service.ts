import type { BookVersion } from "@prisma/client"

const MAX_PREVIEW_LENGTH = 2_000
const MAX_CONTENT_SEARCH_RESULTS = 10
const OPENITI_RAW_BASE = "https://raw.githubusercontent.com/OpenITI"

export interface IUsulPage {
  text?: unknown
  vol?: unknown
  page?: unknown
}

export interface IUsulBookContent {
  pages?: unknown
  sections?: unknown
}

export interface IOpenITIRawContent {
  rawText: string
  pages: IUsulPage[]
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

export function makeLexicalSnippet(
  text: string,
  normalizedQuery: string
): { before: string; match: string; after: string } {
  const cleanText = stripHtml(text)
  const normalizedText = normalizeForSearch(cleanText)
  const index = normalizedText.indexOf(normalizedQuery)

  if (index === -1) {
    return {
      before: "",
      match: "",
      after: cleanText.slice(0, 200),
    }
  }

  const before = cleanText.slice(Math.max(0, index - 100), index)
  const match = cleanText.slice(index, index + normalizedQuery.length)
  const after = cleanText.slice(index + normalizedQuery.length, index + normalizedQuery.length + 150)

  return { before, match, after }
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

/**
 * Hitung nama repo OpenITI berdasarkan tahun awal dari version.value.
 */
function getOpenITIRepo(versionValue: string): string | null {
  const match = versionValue.match(/^(\d{4})/)
  if (!match) return null

  const year = Number.parseInt(match[1], 10)
  const repo = Math.ceil(year / 25) * 25
  return `${String(repo).padStart(4, "0")}AH`
}

function parseOpenITIMarkdown(rawText: string): IUsulPage[] {
  const lines = rawText.split("\n")
  const pages: IUsulPage[] = []

  let currentPageText: string[] = []
  let currentPage = "1"
  let currentVol = "1"
  let sawBodyText = false

  const pushPage = (): void => {
    const text = currentPageText.join(" ").trim()
    if (!text) return

    pages.push({
      text,
      vol: currentVol,
      page: currentPage,
    })
    currentPageText = []
  }

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) {
      if (sawBodyText && currentPageText.length > 0) {
        currentPageText.push("")
      }
      continue
    }

    if (trimmed.startsWith("#META#") || trimmed.startsWith("######OpenITI#")) {
      continue
    }

    const pageMatch = trimmed.match(/^PageV(\d+)P(\d+)/)
    if (pageMatch) {
      pushPage()
      currentVol = String(Number.parseInt(pageMatch[1], 10))
      currentPage = String(Number.parseInt(pageMatch[2], 10))
      sawBodyText = true
      continue
    }

    if (/^ms\d+/.test(trimmed)) continue

    if (trimmed.startsWith("#") && !trimmed.startsWith("###")) {
      continue
    }

    if (trimmed.startsWith("###")) {
      const babText = trimmed.replace(/^#+\s*/, "").trim()
      if (babText) {
        currentPageText.push(babText)
        sawBodyText = true
      }
      continue
    }

    if (/[\u0600-\u06FF]/.test(trimmed)) {
      const cleanLine = trimmed.replace(/[%~@|]/g, " ").replace(/\s+/g, " ").trim()
      if (cleanLine) {
        currentPageText.push(cleanLine)
        sawBodyText = true
      }
    }
  }

  pushPage()

  return pages
}

export async function fetchOpenITIContent(version: BookVersion): Promise<IUsulBookContent | null> {
  const repo = getOpenITIRepo(version.value)
  if (!repo) return null

  const parts = version.value.split(".")
  if (parts.length < 2) return null

  const authorId = parts[0]
  const bookShort = parts[1]
  const url = `${OPENITI_RAW_BASE}/${repo}/master/data/${authorId}/${authorId}.${bookShort}/${version.value}`

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        "User-Agent": "TurathChain/1.0",
      },
    })

    if (!response.ok) return null

    const rawText = await response.text()
    if (!rawText || rawText.startsWith("404")) return null

    const pages = parseOpenITIMarkdown(rawText)
    if (pages.length === 0) return null

    return { pages }
  } catch (error) {
    console.error(`[BookContentService] OpenITI fetch failed for ${version.value}:`, error)
    return null
  }
}

export async function fetchVersionContent(version: BookVersion): Promise<IUsulBookContent | null> {
  return fetchOpenITIContent(version)
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
