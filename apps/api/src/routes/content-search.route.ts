import { Hono } from "hono"
import { prisma } from "../db/prisma"
import { makeSnippet, normalizeForSearch } from "../services/book-content.service"

export const contentSearchRoutes = new Hono()

const DEFAULT_LIMIT = 20

contentSearchRoutes.get("/status", async (c) => {
  try {
    const [indexedPages, indexedBooks, totalBooks] = await Promise.all([
      prisma.bookContentPage.count(),
      prisma.bookContentPage.findMany({
        distinct: ["bookId"],
        select: { bookId: true },
      }),
      prisma.book.count(),
    ])

    return c.json({
      data: {
        indexedPages,
        indexedBooks: indexedBooks.length,
        totalBooks,
      },
    })
  } catch (error) {
    console.error("[ContentSearchRoute] Status failed:", error)
    return c.json({ error: { code: "FETCH_FAILED", message: "Gagal mengambil status indeks" } }, 500)
  }
})

contentSearchRoutes.get("/", async (c) => {
  const q = c.req.query("q")?.trim()
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1"))
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query("limit") ?? String(DEFAULT_LIMIT))))

  if (!q) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Kata kunci pencarian wajib diisi" } }, 400)
  }

  const normalizedQuery = normalizeForSearch(q)

  try {
    const where = {
      normalizedText: {
        contains: normalizedQuery,
      },
    }

    const total = await prisma.bookContentPage.count({ where })
    const results = await prisma.bookContentPage.findMany({
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
        { page: "asc" },
      ],
      skip: (page - 1) * limit,
      take: limit,
    })

    const data = results.map((result) => ({
      ...result,
      text: makeSnippet(result.text, q),
    }))

    return c.json({
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("[ContentSearchRoute] Search failed:", error)
    return c.json({ error: { code: "SEARCH_FAILED", message: "Gagal mencari indeks isi kitab" } }, 500)
  }
})
