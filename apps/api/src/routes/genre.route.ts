import { Hono } from "hono"
import { prisma } from "../db/prisma"

export const genreRoutes = new Hono()

// GET /api/genres
genreRoutes.get("/", async (c) => {
  try {
    const genres = await prisma.genre.findMany({
      orderBy: { id: "asc" },
    })
    return c.json({ data: genres })
  } catch (error) {
    console.error("[GenreRoute] Error fetching genres:", error)
    return c.json({ error: { code: "FETCH_FAILED", message: "Gagal mengambil daftar genre" } }, 500)
  }
})
