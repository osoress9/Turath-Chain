import { QdrantClient } from "@qdrant/qdrant-js"

function getQdrantConfig() {
  return {
    collection: process.env.QDRANT_COLLECTION ?? "turath_chunks",
    url: process.env.QDRANT_URL ?? "http://localhost:6333",
    apiKey: process.env.QDRANT_API_KEY || undefined,
  }
}

let qdrantClient: QdrantClient | null = null
let collectionVectorSizePromise: Promise<number | null> | null = null

export function getQdrantCollection(): string {
  return getQdrantConfig().collection
}

export function getQdrantClient(): QdrantClient {
  if (!qdrantClient) {
    const { url, apiKey } = getQdrantConfig()
    qdrantClient = new QdrantClient({
      url,
      apiKey,
    })
  }

  return qdrantClient
}

function readVectorSizeFromConfig(config: unknown): number | null {
  if (!config || typeof config !== "object") {
    return null
  }

  const params = (config as { params?: unknown }).params
  if (!params || typeof params !== "object") {
    return null
  }

  const vectors = (params as { vectors?: unknown }).vectors
  if (!vectors || typeof vectors !== "object") {
    return null
  }

  if ("size" in vectors && typeof (vectors as { size?: unknown }).size === "number") {
    return (vectors as { size: number }).size
  }

  const firstNamedVector = Object.values(vectors as Record<string, unknown>).find(
    (value) => value && typeof value === "object" && typeof (value as { size?: unknown }).size === "number"
  ) as { size?: number } | undefined

  return firstNamedVector?.size ?? null
}

export async function getQdrantCollectionVectorSize(): Promise<number | null> {
  if (!collectionVectorSizePromise) {
    collectionVectorSizePromise = (async () => {
      try {
        const result = await getQdrantClient().api().getCollection({
          collection_name: getQdrantCollection(),
        })

        return readVectorSizeFromConfig(result.data?.result?.config ?? null)
      } catch {
        return null
      }
    })()
  }

  return collectionVectorSizePromise
}
