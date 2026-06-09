import { Prisma } from "@prisma/client"
import { Hono } from "hono"
import { prisma } from "../db/prisma"

export const catalogSearchRoutes = new Hono()

const DEFAULT_LIMIT = 20

type CatalogGenre = {
  id: string
  nameAr: string | null
  nameEn: string | null
}

type CatalogBookResult = {
  id: string
  slug: string
  titleAr: string
  titleEn: string | null
  transliteration: string | null
  author: {
    id: string
    nameAr: string
    nameEn: string | null
    yearDeath: number | null
  }
  genres: CatalogGenre[]
  authorWorks: {
    id: string
    slug: string
    titleAr: string
  }[]
}

type CatalogAuthorResult = {
  id: string
  nameAr: string
  nameEn: string | null
  yearDeath: number | null
  works: {
    id: string
    slug: string
    titleAr: string
    genres: {
      id: string
      nameAr: string | null
    }[]
  }[]
}

function parseBoundedInt(value: string | undefined, fallback: number, max = 20) {
  const parsed = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return fallback
  return Math.min(max, Math.max(1, parsed))
}

function buildBookWhere(words: string[]): Prisma.BookWhereInput {
  return {
    AND: words.map((word) => ({
      OR: [
        { titleAr: { contains: word, mode: "insensitive" } },
        { titleEn: { contains: word, mode: "insensitive" } },
        { transliteration: { contains: word, mode: "insensitive" } },
      ],
    })),
  }
}

function buildAuthorWhere(words: string[]): Prisma.AuthorWhereInput {
  return {
    AND: words.map((word) => ({
      OR: [
        { nameAr: { contains: word, mode: "insensitive" } },
        { nameEn: { contains: word, mode: "insensitive" } },
      ],
    })),
  }
}

function mapGenres(genres: Array<{ genre: { id: string; nameAr: string | null; nameEn: string | null } }>): CatalogGenre[] {
  return genres.map(({ genre }) => ({
    id: genre.id,
    nameAr: genre.nameAr,
    nameEn: genre.nameEn,
  }))
}

catalogSearchRoutes.get("/", async (c) => {
  const q = c.req.query("q")?.trim()
  const page = parseBoundedInt(c.req.query("page"), 1, Number.MAX_SAFE_INTEGER)
  const limit = parseBoundedInt(c.req.query("limit"), DEFAULT_LIMIT, DEFAULT_LIMIT)

  if (!q) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Kata kunci pencarian wajib diisi" } }, 400)
  }

  const words = q.split(/\s+/).filter(Boolean)

  if (words.length === 0) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Kata kunci pencarian wajib diisi" } }, 400)
  }

  const bookWhere = buildBookWhere(words)
  const authorWhere = buildAuthorWhere(words)
  const skip = (page - 1) * limit

  try {
    const [totalBooks, totalAuthors, matchedBooks, matchedAuthors] = await Promise.all([
      prisma.book.count({ where: bookWhere }),
      prisma.author.count({ where: authorWhere }),
      prisma.book.findMany({
        where: bookWhere,
        include: {
          author: true,
          genres: { include: { genre: true } },
        },
        orderBy: { titleAr: "asc" },
        skip,
        take: limit,
      }),
      prisma.author.findMany({
        where: authorWhere,
        include: {
          books: {
            include: {
              genres: { include: { genre: true } },
            },
            orderBy: { titleAr: "asc" },
          },
        },
        orderBy: { nameAr: "asc" },
        skip,
        take: limit,
      }),
    ])

    const bookAuthorIds = Array.from(new Set(matchedBooks.map((book) => book.authorId)))
    const authorBookCatalog = bookAuthorIds.length
      ? await prisma.book.findMany({
          where: { authorId: { in: bookAuthorIds } },
          select: {
            id: true,
            slug: true,
            titleAr: true,
            authorId: true,
          },
          orderBy: { titleAr: "asc" },
        })
      : []

    const authorBooksByAuthorId = new Map<string, typeof authorBookCatalog>()
    for (const book of authorBookCatalog) {
      const list = authorBooksByAuthorId.get(book.authorId) ?? []
      list.push(book)
      authorBooksByAuthorId.set(book.authorId, list)
    }

    const books: CatalogBookResult[] = matchedBooks.map((book) => {
      const authorWorks = (authorBooksByAuthorId.get(book.authorId) ?? [])
        .filter((item) => item.id !== book.id)
        .map((item) => ({
          id: item.id,
          slug: item.slug,
          titleAr: item.titleAr,
        }))

      return {
        id: book.id,
        slug: book.slug,
        titleAr: book.titleAr,
        titleEn: book.titleEn,
        transliteration: book.transliteration,
        author: {
          id: book.author.id,
          nameAr: book.author.nameAr,
          nameEn: book.author.nameEn,
          yearDeath: book.author.yearDeath,
        },
        genres: mapGenres(book.genres),
        authorWorks,
      }
    })

    const authors: CatalogAuthorResult[] = matchedAuthors.map((author) => ({
      id: author.id,
      nameAr: author.nameAr,
      nameEn: author.nameEn,
      yearDeath: author.yearDeath,
      works: author.books.map((book) => ({
        id: book.id,
        slug: book.slug,
        titleAr: book.titleAr,
        genres: book.genres.map(({ genre }) => ({
          id: genre.id,
          nameAr: genre.nameAr,
        })),
      })),
    }))

    return c.json({
      data: {
        books,
        authors,
      },
      meta: {
        totalBooks,
        totalAuthors,
        page,
        limit,
      },
    })
  } catch (error) {
    console.error("[CatalogSearchRoute] Search failed:", error)
    return c.json({ error: { code: "SEARCH_FAILED", message: "Gagal mencari katalog kitab dan muallif" } }, 500)
  }
})
