import { Hono } from "hono"
import { Prisma } from "@prisma/client"
import { prisma } from "../db/prisma"

export const historicalSearchRoutes = new Hono()

const DEFAULT_LIMIT = 20

type GenreSummary = {
  id: string
  nameAr: string | null
  nameEn: string | null
}

type HistoricalBookSummary = {
  id: string
  slug: string
  titleAr: string
  titleEn: string | null
  transliteration: string | null
  genres: GenreSummary[]
}

type HistoricalAuthorSummary = {
  id: string
  nameAr: string
  nameEn: string | null
  yearDeath: number | null
  works: HistoricalBookSummary[]
}

type HistoricalYearItem = {
  book: HistoricalBookSummary
  author: {
    id: string
    nameAr: string
    nameEn: string | null
    yearDeath: number | null
  }
  filterReason: string
}

function parsePositiveInt(value: string | undefined, fallback: number, max = 100) {
  const parsed = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return fallback
  return Math.min(max, Math.max(1, parsed))
}

function parseMaybeInt(value: string | undefined) {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function mapGenres(genres: Array<{ genre: { id: string; nameAr: string | null; nameEn: string | null } }>): GenreSummary[] {
  return genres.map(({ genre }) => ({
    id: genre.id,
    nameAr: genre.nameAr,
    nameEn: genre.nameEn,
  }))
}

function mapBookSummary(book: {
  id: string
  slug: string
  titleAr: string
  titleEn: string | null
  transliteration: string | null
  genres: Array<{ genre: { id: string; nameAr: string | null; nameEn: string | null } }>
}): HistoricalBookSummary {
  return {
    id: book.id,
    slug: book.slug,
    titleAr: book.titleAr,
    titleEn: book.titleEn,
    transliteration: book.transliteration,
    genres: mapGenres(book.genres),
  }
}

async function fetchAuthorSummariesByIds(authorIds: string[]): Promise<HistoricalAuthorSummary[]> {
  if (authorIds.length === 0) return []

  const authors = await prisma.author.findMany({
    where: { id: { in: authorIds } },
    include: {
      books: {
        include: {
          genres: { include: { genre: true } },
        },
        orderBy: { titleAr: "asc" },
      },
    },
  })

  const mapped = authors.map((author) => ({
    id: author.id,
    nameAr: author.nameAr,
    nameEn: author.nameEn,
    yearDeath: author.yearDeath,
    works: author.books.map(mapBookSummary),
  }))

  mapped.sort((left, right) => {
    const leftYear = left.yearDeath ?? Number.MAX_SAFE_INTEGER
    const rightYear = right.yearDeath ?? Number.MAX_SAFE_INTEGER
    if (leftYear !== rightYear) return leftYear - rightYear
    return left.nameAr.localeCompare(right.nameAr)
  })

  return mapped
}

async function collectRelatedAuthors(
  rootId: string,
  direction: "teachers" | "students",
  depth: 1 | 2
): Promise<string[]> {
  const relationField = direction === "teachers" ? "studentId" : "teacherId"
  const relatedField = direction === "teachers" ? "teacherId" : "studentId"

  const visited = new Set<string>([rootId])
  let frontier = [rootId]
  const results: string[] = []

  for (let level = 0; level < depth; level++) {
    if (frontier.length === 0) break

    const relations = await prisma.authorRelation.findMany({
      where: {
        [relationField]: { in: frontier },
      },
      select: {
        teacherId: true,
        studentId: true,
      },
    })

    const nextFrontier = new Set<string>()

    for (const relation of relations) {
      const relatedId = relation[relatedField]
      if (visited.has(relatedId)) continue
      visited.add(relatedId)
      results.push(relatedId)
      nextFrontier.add(relatedId)
    }

    frontier = Array.from(nextFrontier)
  }

  return results
}

historicalSearchRoutes.get("/year", async (c) => {
  const from = parseMaybeInt(c.req.query("from"))
  const to = parseMaybeInt(c.req.query("to"))
  const genre = c.req.query("genre")?.trim() || undefined
  const q = c.req.query("q")?.trim() || undefined
  const page = parsePositiveInt(c.req.query("page"), 1)
  const limit = parsePositiveInt(c.req.query("limit"), DEFAULT_LIMIT, DEFAULT_LIMIT)

  if (from == null || to == null) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Parameter from dan to wajib diisi" } }, 400)
  }

  try {
    const where: Prisma.BookWhereInput = {
      author: {
        yearDeath: {
          gte: from,
          lte: to,
        },
      },
    }

    if (genre) {
      where.genres = { some: { genreId: genre } }
    }

    if (q) {
      where.titleAr = { contains: q, mode: "insensitive" }
    }

    const [total, books] = await Promise.all([
      prisma.book.count({ where }),
      prisma.book.findMany({
        where,
        include: {
          author: true,
          genres: { include: { genre: true } },
        },
        orderBy: { author: { yearDeath: "asc" } },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    const data: HistoricalYearItem[] = books
      .filter((book) => book.author.yearDeath != null)
      .map((book) => ({
        book: mapBookSummary(book),
        author: {
          id: book.author.id,
          nameAr: book.author.nameAr,
          nameEn: book.author.nameEn,
          yearDeath: book.author.yearDeath,
        },
        filterReason: `Masuk rentang ${from}-${to} H berdasarkan tahun wafat muallif: ${book.author.yearDeath} H`,
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
    console.error("[HistoricalSearchRoute] Year search failed:", error)
    return c.json({ error: { code: "SEARCH_FAILED", message: "Gagal mencari kitab berdasarkan tahun wafat muallif" } }, 500)
  }
})

historicalSearchRoutes.get("/lineage", async (c) => {
  const q = c.req.query("q")?.trim()
  const depthRaw = c.req.query("depth")
  const depth = depthRaw === "2" ? 2 : 1

  if (!q) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Parameter q wajib diisi" } }, 400)
  }

  try {
    const rootAuthor =
      (await prisma.author.findUnique({
        where: { id: q },
        include: {
          books: {
            include: {
              genres: { include: { genre: true } },
            },
            orderBy: { titleAr: "asc" },
          },
        },
      })) ??
      (await prisma.author.findFirst({
        where: {
          OR: [
            { id: { contains: q, mode: "insensitive" } },
            { nameAr: { contains: q, mode: "insensitive" } },
          ],
        },
        include: {
          books: {
            include: {
              genres: { include: { genre: true } },
            },
            orderBy: { titleAr: "asc" },
          },
        },
        orderBy: { nameAr: "asc" },
      }))

    if (!rootAuthor) {
      return c.json({ error: { code: "NOT_FOUND", message: "Muallif tidak ditemukan" } }, 404)
    }

    const [teacherIds, studentIds] = await Promise.all([
      collectRelatedAuthors(rootAuthor.id, "teachers", depth),
      collectRelatedAuthors(rootAuthor.id, "students", depth),
    ])

    const [teachers, students] = await Promise.all([
      fetchAuthorSummariesByIds(teacherIds),
      fetchAuthorSummariesByIds(studentIds),
    ])

    const author: HistoricalAuthorSummary = {
      id: rootAuthor.id,
      nameAr: rootAuthor.nameAr,
      nameEn: rootAuthor.nameEn,
      yearDeath: rootAuthor.yearDeath,
      works: rootAuthor.books.map(mapBookSummary),
    }

    const dataNote =
      teachers.length === 0 && students.length === 0
        ? "Data relasi guru-murid untuk muallif ini belum tersedia di database. Data akan dilengkapi dari sumber OpenITI secara bertahap."
        : ""

    return c.json({
      data: {
        author,
        teachers,
        students,
        dataNote,
      },
    })
  } catch (error) {
    console.error("[HistoricalSearchRoute] Lineage search failed:", error)
    return c.json({ error: { code: "SEARCH_FAILED", message: "Gagal mengambil silsilah guru-murid" } }, 500)
  }
})
