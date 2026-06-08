import { Hono } from "hono"
import { prisma } from "../db/prisma"

type Variables = {
  userId: string
}

export const savedRoutes = new Hono<{ Variables: Variables }>()

// Middleware auth — verifikasi user ID dari header
// Frontend mengirim user ID dari session NextAuth via header x-user-id
// ⚠️ UNVERIFIED: Di production perlu JWT verification penuh. Saat ini menggunakan user ID langsung
// karena NextAuth v5 JWT verification memerlukan @auth/core/jwt yang belum diimplementasi
savedRoutes.use("*", async (c, next) => {
  // Coba baca dari header x-user-id (dikirim frontend dari session NextAuth)
  const userId = c.req.header("x-user-id")

  if (!userId) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Harap login terlebih dahulu" } },
      401
    )
  }

  // Verifikasi user benar-benar ada di database
  const userExists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!userExists) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Sesi tidak valid, harap login ulang" } },
      401
    )
  }

  c.set("userId", userId)
  await next()
})

// GET /api/saved — Daftar rantai tersimpan user yang login
savedRoutes.get("/", async (c) => {
  const userId = c.get("userId")
  try {
    const saved = await prisma.savedChain.findMany({
      where: { userId },
      include: {
        book: { include: { author: true } },
      },
      orderBy: { createdAt: "desc" },
    })
    return c.json({ data: saved })
  } catch (error) {
    console.error("[SavedRoute] Error fetching saved chains:", error)
    return c.json(
      { error: { code: "FETCH_FAILED", message: "Gagal mengambil daftar tersimpan" } },
      500
    )
  }
})

// POST /api/saved — Simpan rantai baru
savedRoutes.post("/", async (c) => {
  const userId = c.get("userId")
  const body = await c.req.json<{ bookId?: string; note?: string; query?: string }>()

  if (!body.bookId) {
    return c.json({ error: { code: "BAD_REQUEST", message: "bookId wajib diisi" } }, 400)
  }

  try {
    const saved = await prisma.savedChain.create({
      data: {
        userId,
        bookId: body.bookId,
        note: body.note ?? null,
        query: body.query ?? null,
      },
      include: {
        book: { include: { author: true } },
      },
    })
    return c.json({ data: saved }, 201)
  } catch (error) {
    console.error("[SavedRoute] Error saving chain:", error)
    return c.json({ error: { code: "SAVE_FAILED", message: "Gagal menyimpan rantai" } }, 500)
  }
})

// DELETE /api/saved/:id — Hapus rantai tersimpan milik user yang login
savedRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId")
  const id = c.req.param("id")

  try {
    // Verifikasi kepemilikan sebelum hapus — jangan biarkan user hapus milik orang lain
    const existing = await prisma.savedChain.findUnique({ where: { id } })
    if (!existing || existing.userId !== userId) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Item tidak ditemukan atau bukan milik Anda" } },
        404
      )
    }

    await prisma.savedChain.delete({ where: { id } })
    return c.json({ data: { success: true } })
  } catch (error) {
    console.error("[SavedRoute] Error deleting saved chain:", error)
    return c.json(
      { error: { code: "DELETE_FAILED", message: "Gagal menghapus rantai tersimpan" } },
      500
    )
  }
})
