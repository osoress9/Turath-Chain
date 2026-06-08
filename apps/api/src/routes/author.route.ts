import { Hono } from "hono"
import { prisma } from "../db/prisma"

export const authorRoutes = new Hono()

authorRoutes.get("/:id", async (c) => {
  const id = c.req.param("id")

  try {
    const author = await prisma.author.findUnique({
      where: { id },
      include: {
        books: {
          include: {
            genres: { include: { genre: true } },
          },
          orderBy: { titleAr: "asc" },
        },
        teachers: {
          include: {
            teacher: true,
          },
        },
        students: {
          include: {
            student: true,
          },
        },
      },
    })

    if (!author) {
      return c.json({ error: { code: "NOT_FOUND", message: "Pengarang tidak ditemukan" } }, 404)
    }

    return c.json({ data: author })
  } catch (error) {
    console.error("[AuthorRoute] Fetch author failed:", error)
    return c.json({ error: { code: "FETCH_FAILED", message: "Gagal mengambil detail pengarang" } }, 500)
  }
})
