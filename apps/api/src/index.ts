import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { bookRoutes } from "./routes/book.route"
import { authorRoutes } from "./routes/author.route"
import { authRoutes } from "./routes/auth.route"
import { contentSearchRoutes } from "./routes/content-search.route"
import { genreRoutes } from "./routes/genre.route"
import { profileRoutes } from "./routes/profile.route"
import { savedRoutes } from "./routes/saved.route"

const app = new Hono()

// Middleware global
app.use("*", logger())
app.use(
  "/api/*",
  cors({
    origin: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization", "x-user-id"],
  })
)

// Health check — GET /api/health
app.get("/api/health", (c) => {
  return c.json({ status: "ok", message: "Turath Chain API is running" })
})

// Register routes sesuai PRD §API Endpoints
app.route("/api/books", bookRoutes)
app.route("/api/authors", authorRoutes)
app.route("/api/content-search", contentSearchRoutes)
app.route("/api/genres", genreRoutes)
app.route("/api/saved", savedRoutes)
app.route("/api/auth", authRoutes)
app.route("/api/profile", profileRoutes)

// /api/search dialihkan ke /api/books agar endpoint konsisten dengan PRD
// GET /api/search?q=...&genre=...&page=...
app.route("/api/search", bookRoutes)

const port = process.env.PORT ? parseInt(process.env.PORT) : 3001

console.log(`[TurathChain] API server starting on http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port,
})
