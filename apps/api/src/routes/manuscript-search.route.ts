import { Prisma } from "@prisma/client"
import { Hono } from "hono"
import { prisma } from "../db/prisma"
import { getQdrantClient, getQdrantCollection } from "../db/qdrant"
import { embedQuery } from "../services/embedding.service"
import { makeLexicalSnippet, normalizeForSearch } from "../services/book-content.service"

export const manuscriptSearchRoutes = new Hono()

const DEFAULT_TOP_K = 10
const MAX_TOP_K = 50
const QDRANT_UNAVAILABLE_MESSAGE =
  "Index semantik belum tersedia. 150 kitab sudah ter-embed, sisanya dalam proses."

type ManuscriptGenre = {
  id: string
  nameAr: string | null
  nameEn: string | null
}

type ManuscriptAuthor = {
  id: string
  nameAr: string
  nameEn: string | null
  yearDeath: number | null
}

type ManuscriptBook = {
  id: string
  slug: string
  titleAr: string
  titleEn: string | null
  author: ManuscriptAuthor
  genres: ManuscriptGenre[]
}

type ManuscriptSemanticResult = {
  score: number
  textAr: string
  babTitle: string | null
  pageRef: string | null
  book: ManuscriptBook
}

type QdrantPayload = {
  bookId?: string
  qdrant_string_id?: string
  textAr?: string
  text?: string
  babTitle?: string
  bab_title?: string
  pageRef?: string
  page_ref?: string
  genres?: string[] | string
}

type ManuscriptLexicalSnippet = {
  before: string
  match: string
  after: string
}

type ManuscriptLexicalResult = {
  bookId: string
  book: ManuscriptBook
  page: string | null
  volume: string | null
  snippet: ManuscriptLexicalSnippet
}

function parsePositiveInt(value: string | undefined, fallback: number, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return fallback
  return Math.min(max, Math.max(1, parsed))
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function extractPayload(point: { payload?: unknown }): QdrantPayload {
  return (point.payload && typeof point.payload === "object" ? point.payload : {}) as QdrantPayload
}

function mapBook(book: {
  id: string
  slug: string
  titleAr: string
  titleEn: string | null
  author: {
    id: string
    nameAr: string
    nameEn: string | null
    yearDeath: number | null
  }
  genres: Array<{ genre: { id: string; nameAr: string | null; nameEn: string | null } }>
}): ManuscriptBook {
  return {
    id: book.id,
    slug: book.slug,
    titleAr: book.titleAr,
    titleEn: book.titleEn,
    author: {
      id: book.author.id,
      nameAr: book.author.nameAr,
      nameEn: book.author.nameEn,
      yearDeath: book.author.yearDeath,
    },
    genres: book.genres.map(({ genre }) => ({
      id: genre.id,
      nameAr: genre.nameAr,
      nameEn: genre.nameEn,
    })),
  }
}

async function resolveBooksByIds(bookIds: string[]): Promise<Map<string, ManuscriptBook>> {
  if (bookIds.length === 0) return new Map()

  const books = await prisma.book.findMany({
    where: { id: { in: bookIds } },
    include: {
      author: true,
      genres: { include: { genre: true } },
    },
  })

  return new Map(books.map((book) => [book.id, mapBook(book)]))
}

async function resolveBookIdsFromChunks(qdrantIds: string[]): Promise<Map<string, string>> {
  if (qdrantIds.length === 0) return new Map()

  const chunks = await prisma.textChunk.findMany({
    where: { qdrantId: { in: qdrantIds } },
    select: {
      qdrantId: true,
      bookId: true,
    },
  })

  return new Map(chunks.map((chunk) => [chunk.qdrantId, chunk.bookId]))
}

function createQdrantUnavailableResponse() {
  return { error: { code: "QDRANT_UNAVAILABLE", message: QDRANT_UNAVAILABLE_MESSAGE } }
}

function buildLexicalSnippet(text: string, normalizedQuery: string): ManuscriptLexicalSnippet {
  return makeLexicalSnippet(text, normalizedQuery)
}

manuscriptSearchRoutes.get("/semantic", async (c) => {
  const q = c.req.query("q")?.trim()
  const genre = c.req.query("genre")?.trim()
  const topK = parsePositiveInt(c.req.query("topK"), DEFAULT_TOP_K, MAX_TOP_K)

  if (!q) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Parameter q wajib diisi" } }, 400)
  }

  let vector: number[]
  try {
    vector = await embedQuery(q)
  } catch (error) {
    console.error("[ManuscriptSearchRoute] Embedding failed:", error)
    return c.json(
      {
        error: {
          code: "EMBEDDING_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "Gagal membuat embedding query untuk pencarian semantik",
        },
      },
      503
    )
  }

  try {
    const filter =
      genre && genre.length > 0
        ? {
            must: [
              {
                key: "genres",
                match: {
                  value: genre,
                },
              },
            ],
          }
        : undefined

    const searchResult = await getQdrantClient().search(getQdrantCollection(), {
      vector,
      limit: topK,
      filter,
      with_payload: true,
      with_vector: false,
    })

    const payloads = searchResult.map((point) => extractPayload(point))
    const qdrantIds = payloads
      .map((payload) => normalizeText(payload.qdrant_string_id))
      .filter(Boolean)

    const bookIdsFromPayload = payloads
      .map((payload) => normalizeText(payload.bookId))
      .filter(Boolean)

    const qdrantIdToBookId = await resolveBookIdsFromChunks(qdrantIds)
    const bookIds = Array.from(
      new Set([
        ...bookIdsFromPayload,
        ...qdrantIds.map((id) => qdrantIdToBookId.get(id)).filter((id): id is string => Boolean(id)),
      ])
    )

    const bookMap = await resolveBooksByIds(bookIds)

    const data: ManuscriptSemanticResult[] = searchResult
      .map((point) => {
        const payload = extractPayload(point)
        const qdrantId = normalizeText(payload.qdrant_string_id)
        const bookId = normalizeText(payload.bookId) || qdrantIdToBookId.get(qdrantId) || null

        if (!bookId) return null

        const book = bookMap.get(bookId)
        if (!book) return null

        const textAr =
          normalizeText(payload.textAr) ||
          normalizeText(payload.text) ||
          ""

        return {
          score: point.score,
          textAr,
          babTitle: normalizeText(payload.babTitle) || normalizeText(payload.bab_title) || null,
          pageRef: normalizeText(payload.pageRef) || normalizeText(payload.page_ref) || null,
          book,
        }
      })
      .filter((item): item is ManuscriptSemanticResult => item != null)

    return c.json({
      data,
      meta: {
        topK,
        total: data.length,
      },
    })
  } catch (error) {
    console.error("[ManuscriptSearchRoute] Semantic search failed:", error)
    return c.json(createQdrantUnavailableResponse(), 503)
  }
})

manuscriptSearchRoutes.get("/semantic/status", async (c) => {
  try {
    let offset: string | number | undefined = undefined
    const uniqueBookIds = new Set<string>()
    let totalVectors = 0

    do {
      const response = await getQdrantClient().scroll(getQdrantCollection(), {
        limit: 256,
        offset,
        with_payload: true,
        with_vector: false,
      })

      const points = response.points ?? []
      totalVectors += points.length

      for (const point of points) {
        const payload = extractPayload(point)
        const bookId = normalizeText(payload.bookId)
        if (bookId) {
          uniqueBookIds.add(bookId)
        }
      }

      const nextOffset = response.next_page_offset
      offset =
        typeof nextOffset === "string" || typeof nextOffset === "number"
          ? nextOffset
          : undefined
    } while (offset)

    return c.json({
      data: {
        indexedBooks: uniqueBookIds.size,
        totalVectors,
      },
    })
  } catch (error) {
    console.error("[ManuscriptSearchRoute] Status failed:", error)
    return c.json(createQdrantUnavailableResponse(), 503)
  }
})

manuscriptSearchRoutes.get("/lexical", async (c) => {
  const q = c.req.query("q")?.trim()
  const genre = c.req.query("genre")?.trim()
  const page = parsePositiveInt(c.req.query("page"), 1)
  const limit = parsePositiveInt(c.req.query("limit"), 20, 50)

  if (!q) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Parameter q wajib diisi" } }, 400)
  }

  const normalizedQuery = normalizeForSearch(q)
  const words = normalizedQuery.split(/\s+/).filter(Boolean)

  if (words.length === 0) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Parameter q wajib diisi" } }, 400)
  }

  try {
    const where: Prisma.BookContentPageWhereInput = {
      AND: words.map((word) => ({
        normalizedText: {
          contains: word,
        },
      })),
    }

    if (genre) {
      where.book = {
        genres: {
          some: {
            genreId: genre,
          },
        },
      }
    }

    const [total, pages] = await Promise.all([
      prisma.bookContentPage.count({ where }),
      prisma.bookContentPage.findMany({
        where,
        include: {
          book: {
            include: {
              author: true,
              genres: { include: { genre: true } },
            },
          },
        },
        orderBy: [
          { bookId: "asc" },
          { volume: "asc" },
          { page: "asc" },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    const data: ManuscriptLexicalResult[] = pages.map((item) => ({
      bookId: item.bookId,
      book: mapBook({
        id: item.book.id,
        slug: item.book.slug,
        titleAr: item.book.titleAr,
        titleEn: item.book.titleEn,
        author: item.book.author,
        genres: item.book.genres,
      }),
      page: item.page,
      volume: item.volume,
      snippet: buildLexicalSnippet(item.text, normalizedQuery),
    }))

    return c.json({
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    })
  } catch (error) {
    console.error("[ManuscriptSearchRoute] Lexical search failed:", error)
    return c.json({ error: { code: "SEARCH_FAILED", message: "Gagal mencari kata atau frasa persis dalam isi kitab" } }, 500)
  }
})
