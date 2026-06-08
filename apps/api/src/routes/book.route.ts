import { Hono } from "hono"
import { prisma } from "../db/prisma"
import { Prisma, type BookRelation } from "@prisma/client"
import { getBookContentPreview, searchBookContent } from "../services/book-content.service"

// Tipe untuk node chain (rekursif)
interface ChainNode {
  book: {
    id: string
    slug: string
    titleAr: string
    titleEn: string | null
    transliteration: string | null
    author: { id: string; nameAr: string; nameEn: string | null; yearDeath: number | null }
  }
  relationType: BookRelation["relationType"] | null
  children: ChainNode[]
}

export const bookRoutes = new Hono()

// Jumlah hasil per halaman sesuai PRD Goal 1: 20 hasil per halaman
const RESULTS_PER_PAGE = 20
// Kedalaman rantai maksimal sesuai PRD Goal 2: max 10 level
const MAX_CHAIN_DEPTH = 10

// GET /api/books?q=...&genre=...&page=...
// Dipakai juga sebagai /api/search (alias di index.ts)
bookRoutes.get("/", async (c) => {
  const q = c.req.query("q")?.trim()
  const genre = c.req.query("genre")
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1"))
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query("limit") ?? String(RESULTS_PER_PAGE))))

  try {
    const where: Prisma.BookWhereInput = {}
    if (q) {
      const words = q.split(/\s+/).filter(Boolean)
      where.AND = words.map((word) => ({
        titleAr: { contains: word, mode: "insensitive" },
      }))
    }
    if (genre) {
      where.genres = { some: { genreId: genre } }
    }

    const total = await prisma.book.count({ where })
    const totalPages = Math.ceil(total / limit)

    const books = await prisma.book.findMany({
      where,
      include: {
        author: true,
        genres: { include: { genre: true } },
      },
      // Urutan: pengarang termuda (tahun wafat terbesar) di atas — PRD Goal 1
      orderBy: {
        author: { yearDeath: "desc" },
      },
      skip: (page - 1) * limit,
      take: limit,
    })

    return c.json({
      data: books,
      meta: { total, page, limit, totalPages },
    })
  } catch (error) {
    console.error("[BookRoute] Search failed:", error)
    return c.json({ error: { code: "SEARCH_FAILED", message: "Gagal mencari kitab" } }, 500)
  }
})

// GET /api/books/:id — Detail satu kitab
bookRoutes.get("/:id/content/search", async (c) => {
  const id = c.req.param("id")
  const q = c.req.query("q")?.trim()

  if (!q) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Kata kunci pencarian wajib diisi" } }, 400)
  }

  try {
    const book = await prisma.book.findFirst({
      where: {
        OR: [
          { slug: id },
          { id: id },
        ],
      },
      include: {
        versions: true,
      },
    })

    if (!book) {
      return c.json({ error: { code: "NOT_FOUND", message: "Kitab tidak ditemukan" } }, 404)
    }

    const results = await searchBookContent(book.versions, q)
    return c.json({ data: results, meta: { total: results.length } })
  } catch (error) {
    console.error("[BookRoute] Search content failed:", error)
    return c.json({ error: { code: "SEARCH_FAILED", message: "Gagal mencari dalam isi kitab" } }, 500)
  }
})

bookRoutes.get("/:id/content", async (c) => {
  const id = c.req.param("id")

  try {
    const book = await prisma.book.findFirst({
      where: {
        OR: [
          { slug: id },
          { id: id },
        ],
      },
      include: {
        versions: true,
      },
    })

    if (!book) {
      return c.json({ error: { code: "NOT_FOUND", message: "Kitab tidak ditemukan" } }, 404)
    }

    const contentPreview = await getBookContentPreview(book.versions)
    return c.json({ data: contentPreview })
  } catch (error) {
    console.error("[BookRoute] Fetch content preview failed:", error)
    return c.json({ error: { code: "FETCH_FAILED", message: "Gagal mengambil cuplikan teks" } }, 500)
  }
})

bookRoutes.get("/:id", async (c) => {
  const id = c.req.param("id")
  try {
    // Parameter id dari URL sebenarnya adalah slug, tetapi kita gunakan OR findFirst
    // sebagai fallback apabila client mengirimkan openiti ID secara utuh.
    const book = await prisma.book.findFirst({
      where: {
        OR: [
          { slug: id },
          { id: id }
        ]
      },
      include: {
        author: true,
        genres: { include: { genre: true } },
        relations: { include: { targetBook: { include: { author: true } } } },
        relatedFrom: { include: { sourceBook: { include: { author: true } } } },
        versions: true,
      },
    })

    if (!book) {
      return c.json({ error: { code: "NOT_FOUND", message: "Kitab tidak ditemukan" } }, 404)
    }

    return c.json({ data: book })
  } catch (error) {
    console.error("[BookRoute] Fetch detail failed:", error)
    return c.json({ error: { code: "FETCH_FAILED", message: "Gagal mengambil detail kitab" } }, 500)
  }
})

// GET /api/books/:id/chain — Rantai relasi rekursif, max depth 10
// ChainNode: { book, relationType, children: ChainNode[] }
bookRoutes.get("/:id/chain", async (c) => {
  const id = c.req.param("id")

  try {
    // Perbaikan N+1: Ambil data secara layer-by-layer (BFS) 
    // Maksimal kedalaman adalah MAX_CHAIN_DEPTH.
    // Query yang dijalankan maksimal 2 * MAX_CHAIN_DEPTH, jauh lebih efisien dari rekursi murni.
    
    // 1. Fetch root book
    const rootBook = await prisma.book.findFirst({
      where: {
        OR: [
          { slug: id },
          { id: id }
        ]
      },
      include: { author: true },
    })

    if (!rootBook) {
      return c.json({ error: { code: "NOT_FOUND", message: "Kitab tidak ditemukan untuk chain" } }, 404)
    }

    // Map untuk menampung data book berdasarkan id
    const booksMap = new Map<string, any>()
    booksMap.set(rootBook.id, rootBook)

    // Map relations: key = sourceBookId, value = array of relation records
    const relationsBySource = new Map<string, any[]>()

    let currentLayerIds = [rootBook.id]

    // Fetch relations and books layer by layer
    for (let depth = 0; depth < MAX_CHAIN_DEPTH; depth++) {
      if (currentLayerIds.length === 0) break

      // Fetch semua relasi di mana sourceBookId ada di layer saat ini
      const layerRelations = await prisma.bookRelation.findMany({
        where: { sourceBookId: { in: currentLayerIds } },
      })

      if (layerRelations.length === 0) break

      const nextLayerIds = new Set<string>()

      for (const rel of layerRelations) {
        if (!relationsBySource.has(rel.sourceBookId)) {
          relationsBySource.set(rel.sourceBookId, [])
        }
        relationsBySource.get(rel.sourceBookId)!.push(rel)
        nextLayerIds.add(rel.targetBookId)
      }

      const nextLayerIdsArray = Array.from(nextLayerIds)
      
      // Ambil detail buku yang belum ada di booksMap
      const missingBookIds = nextLayerIdsArray.filter(id => !booksMap.has(id))
      
      if (missingBookIds.length > 0) {
        const layerBooks = await prisma.book.findMany({
          where: { id: { in: missingBookIds } },
          include: { author: true },
        })
        for (const b of layerBooks) {
          booksMap.set(b.id, b)
        }
      }

      currentLayerIds = nextLayerIdsArray
    }

    // Fungsi rekursif di memori untuk menyusun tree
    function assembleTree(
      bookId: string,
      relationType: BookRelation["relationType"] | null = null,
      visited: Set<string> = new Set()
    ): ChainNode | null {
      const book = booksMap.get(bookId)
      if (!book) return null

      // Cegah infinite loop di memori jika ada circular relation
      if (visited.has(bookId)) return null
      const newVisited = new Set(visited)
      newVisited.add(bookId)

      const children: ChainNode[] = []
      const relations = relationsBySource.get(bookId) || []

      for (const rel of relations) {
        const childNode = assembleTree(rel.targetBookId, rel.relationType, newVisited)
        if (childNode) {
          children.push(childNode)
        }
      }

      return {
        book: {
          id: book.id,
          slug: book.slug,
          titleAr: book.titleAr,
          titleEn: book.titleEn,
          transliteration: book.transliteration,
          author: book.author,
        },
        relationType,
        children,
      }
    }

    const chain = assembleTree(rootBook.id)
    if (!chain) {
      return c.json({ error: { code: "NOT_FOUND", message: "Kitab tidak ditemukan untuk chain" } }, 404)
    }

    return c.json({ data: chain })
  } catch (error) {
    console.error("[BookRoute] Fetch chain failed:", error)
    return c.json({ error: { code: "FETCH_FAILED", message: "Gagal mengambil rantai kitab" } }, 500)
  }
})
