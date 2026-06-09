const DEFAULT_MODEL = process.env.EMBEDDING_MODEL ?? "gemini-embedding-001"

function parseEmbedding(values: unknown): number[] | null {
  if (Array.isArray(values) && values.every((value) => typeof value === "number")) {
    return values as number[]
  }
  return null
}

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

async function embedWithGemini(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum diatur")
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(DEFAULT_MODEL)}:embedContent?key=${encodeURIComponent(apiKey)}`,
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

export async function embedQuery(text: string): Promise<number[]> {
  const provider = (process.env.EMBEDDING_PROVIDER ?? "gemini").toLowerCase()

  if (provider === "local") {
    return embedWithLocal(text)
  }

  if (provider === "gemini" || provider === "vertex") {
    return embedWithGemini(text)
  }

  throw new Error(`EMBEDDING_PROVIDER tidak didukung: ${provider}`)
}
