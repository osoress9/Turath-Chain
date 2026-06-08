import bcrypt from "bcryptjs"
import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { prisma } from "../db/prisma"

export const authRoutes = new Hono()

const userResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  image: z.string().nullable(),
})

function serializeUser(user: {
  id: string
  email: string
  name: string | null
  image: string | null
}): z.infer<typeof userResponseSchema> {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
  }
}

async function recordLoginEvent(userId: string, provider: string): Promise<void> {
  await prisma.loginEvent.create({
    data: {
      userId,
      provider,
    },
  })
}

// POST /api/auth/verify-credentials
authRoutes.post(
  "/verify-credentials",
  zValidator(
    "json",
    z.object({
      email: z.string().email(),
      password: z.string().min(6, "Password must be at least 6 characters"),
    })
  ),
  async (c) => {
    const { email, password } = c.req.valid("json")

    try {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      })

      let user = existingUser

      if (user) {
        if (!user.password) {
          return c.json(
            { error: "Akun ini terdaftar menggunakan Google. Silakan login dengan Google." },
            401
          )
        }

        const isPasswordValid = await bcrypt.compare(password, user.password)
        if (!isPasswordValid) {
          return c.json({ error: "Email atau password salah." }, 401)
        }
      } else {
        const hashedPassword = await bcrypt.hash(password, 10)
        user = await prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            name: email.split("@")[0],
          },
        })
      }

      await recordLoginEvent(user.id, "credentials")
      return c.json(serializeUser(user))
    } catch (error) {
      console.error("Auth error:", error)
      return c.json({ error: "Internal server error" }, 500)
    }
  }
)

// POST /api/auth/oauth
authRoutes.post(
  "/oauth",
  zValidator(
    "json",
    z.object({
      email: z.string().email(),
      name: z.string().nullable().optional(),
      image: z.string().nullable().optional(),
      provider: z.string().min(1),
      providerAccountId: z.string().min(1),
    })
  ),
  async (c) => {
    const payload = c.req.valid("json")

    try {
      const user = await prisma.user.upsert({
        where: { email: payload.email },
        update: {
          name: payload.name ?? undefined,
          image: payload.image ?? undefined,
        },
        create: {
          email: payload.email,
          name: payload.name ?? payload.email.split("@")[0],
          image: payload.image ?? null,
        },
      })

      await prisma.account.upsert({
        where: {
          provider_providerAccountId: {
            provider: payload.provider,
            providerAccountId: payload.providerAccountId,
          },
        },
        update: {
          userId: user.id,
        },
        create: {
          userId: user.id,
          provider: payload.provider,
          providerAccountId: payload.providerAccountId,
        },
      })

      await recordLoginEvent(user.id, payload.provider)
      return c.json({ data: serializeUser(user) })
    } catch (error) {
      console.error("OAuth auth error:", error)
      return c.json({ error: "Internal server error" }, 500)
    }
  }
)
