import { GoogleGenAI } from "@google/genai"
import { getQdrantCollectionVectorSize } from "../db/qdrant"

function parseEmbedding(values: unknown): number[] | null {
  if (Array.isArray(values) && values.every((value) => typeof value === "number")) {
    return values as number[]
  }
  return null
}

function getEmbeddingModel(): string {
  return process.env.EMBEDDING_MODEL ?? "gemini-embedding-001"
}

const DEFAULT_VERTEX_EMBEDDING_DIMENSION = 1024

async function embedWithLocal(text: string): Promise<number[]> {
  const url = process.env.LOCAL_EMBEDDING_URL
  if (!url) {
    throw new Error("LOCAL_EMBEDDING_URL belum diatur")
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new Error(`Local embedding gagal: ${response.status} ${response.statusText}`)
  }

  const payload = await response.json()
  const embedding =
    parseEmbedding(payload?.embedding) ??
    parseEmbedding(payload?.data?.embedding) ??
    parseEmbedding(payload?.vector)

  if (!embedding) {
    throw new Error("Response embedding lokal tidak valid")
  }

  return embedding
}

async function embedWithGeminiKey(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum diatur")
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(getEmbeddingModel())}:embedContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: {
          parts: [{ text }],
        },
      }),
      signal: AbortSignal.timeout(15_000),
    }
  )

  if (!response.ok) {
    throw new Error(`Gemini embedding gagal: ${response.status} ${response.statusText}`)
  }

  const payload = await response.json()
  const embedding =
    parseEmbedding(payload?.embedding?.values) ??
    parseEmbedding(payload?.embedding?.value) ??
    parseEmbedding(payload?.embedding) ??
    parseEmbedding(payload?.data?.embedding?.values)

  if (!embedding) {
    throw new Error("Response embedding Gemini tidak valid")
  }

  return embedding
}

async function embedWithVertex(text: string): Promise<number[]> {
  const project = process.env.GOOGLE_CLOUD_PROJECT
  if (!project) {
    throw new Error("GOOGLE_CLOUD_PROJECT belum diatur")
  }

  const outputDimensionality =
    (await getQdrantCollectionVectorSize()) ?? DEFAULT_VERTEX_EMBEDDING_DIMENSION

  const ai = new GoogleGenAI({
    vertexai: true,
    project,
    location: process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1",
  })

  const result = await ai.models.embedContent({
    model: getEmbeddingModel(),
    contents: text,
    config: {
      outputDimensionality,
    },
  })

  const values = result.embeddings?.[0]?.values
  if (!values) {
    throw new Error("Response Vertex AI tidak valid")
  }

  return values
}

export async function embedQuery(text: string): Promise<number[]> {
  const provider = (process.env.EMBEDDING_PROVIDER ?? "gemini").toLowerCase()

  if (provider === "local") {
    return embedWithLocal(text)
  }

  if (provider === "gemini") {
    return embedWithGeminiKey(text)
  }

  if (provider === "vertex") {
    return embedWithVertex(text)
  }

  throw new Error(`EMBEDDING_PROVIDER tidak didukung: ${provider}`)
}
