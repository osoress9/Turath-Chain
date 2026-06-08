import { Hono } from "hono"
import { prisma } from "../db/prisma"

type Variables = {
  userId: string
}

export const profileRoutes = new Hono<{ Variables: Variables }>()

profileRoutes.use("*", async (c, next) => {
  const userId = c.req.header("x-user-id")

  if (!userId) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Harap login terlebih dahulu" } },
      401
    )
  }

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

profileRoutes.get("/", async (c) => {
  const userId = c.get("userId")

  try {
    const [user, savedChains, loginEvents] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          createdAt: true,
          accounts: {
            select: {
              provider: true,
              providerAccountId: true,
            },
          },
        },
      }),
      prisma.savedChain.findMany({
        where: { userId },
        include: {
          book: {
            select: {
              id: true,
              slug: true,
              titleAr: true,
              titleEn: true,
              transliteration: true,
              author: {
                select: {
                  id: true,
                  nameAr: true,
                  nameEn: true,
                  yearDeath: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.loginEvent.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ])

    if (!user) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Profil pengguna tidak ditemukan" } },
        404
      )
    }

    return c.json({
      data: {
        user,
        stats: {
          savedCount: savedChains.length,
          uniqueBooksCount: new Set(savedChains.map((item) => item.bookId)).size,
          loginCount: loginEvents.length,
          connectedProviders: user.accounts.map((account) => account.provider),
          firstLoginAt: loginEvents.at(-1)?.createdAt ?? user.createdAt,
          lastLoginAt: loginEvents[0]?.createdAt ?? user.createdAt,
          lastSavedAt: savedChains[0]?.createdAt ?? null,
        },
        recentSavedChains: savedChains.slice(0, 4),
        loginHistory: loginEvents,
      },
    })
  } catch (error) {
    console.error("[ProfileRoute] Error fetching profile summary:", error)
    return c.json(
      { error: { code: "FETCH_FAILED", message: "Gagal mengambil data profil" } },
      500
    )
  }
})
