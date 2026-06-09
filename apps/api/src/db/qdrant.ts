import { QdrantClient } from "@qdrant/qdrant-js"

export const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION ?? "turath_chunks"

export const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL ?? "http://localhost:6333",
  apiKey: process.env.QDRANT_API_KEY || undefined,
})
