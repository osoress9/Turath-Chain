import { PrismaClient, type BookVersion } from "@prisma/client"
import {
  extractPagesFromContent,
  fetchVersionContent,
  normalizeForSearch,
  stripHtml,
} from "../src/services/book-content.service"

const prisma = new PrismaClient()

interface IIndexOptions {
  book?: string
  limit?: number
}

function readOptions(): IIndexOptions {
  const options: IIndexOptions = {}

  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.split("=")
    if (key === "--book" && value) {
      options.book = value
    }
    if (key === "--limit" && value) {
      const parsed = Number(value)
      if (Number.isInteger(parsed) && parsed > 0) {
        options.limit = parsed
      }
    }
  }

  return options
}

async function getVersions(options: IIndexOptions): Promise<BookVersion[]> {
  if (options.book) {
    const book = await prisma.book.findFirst({
      where: {
        OR: [
          { id: options.book },
          { slug: options.book },
        ],
      },
      include: {
        versions: true,
      },
    })

    return book?.versions ?? []
  }

  return prisma.bookVersion.findMany({
    orderBy: { id: "asc" },
    take: options.limit ?? 25,
  })
}

async function indexVersion(version: BookVersion): Promise<number> {
  const content = await fetchVersionContent(version)
  if (!content) return 0

  const pages = extractPagesFromContent(content)
  if (pages.length === 0) return 0

  await prisma.bookContentPage.deleteMany({
    where: { versionId: version.id },
  })

  await prisma.bookContentPage.createMany({
    data: pages.map((page, index) => {
      const text = stripHtml(String(page.text ?? ""))
      return {
        bookId: version.bookId,
        versionId: version.id,
        volume: typeof page.vol === "string" || typeof page.vol === "number"
          ? String(page.vol)
          : "1",
        page: typeof page.page === "string" || typeof page.page === "number"
          ? String(page.page)
          : `idx:${index + 1}`,
        text,
        normalizedText: normalizeForSearch(text),
        source: version.source,
        value: version.value,
      }
    }),
    skipDuplicates: true,
  })

  return pages.length
}

async function main(): Promise<void> {
  const options = readOptions()
  const versions = await getVersions(options)

  console.log(`Mengindeks ${versions.length} versi kitab...`)

  let indexedPages = 0
  let indexedVersions = 0

  for (const version of versions) {
    const count = await indexVersion(version)
    if (count > 0) {
      indexedVersions += 1
      indexedPages += count
      console.log(`Indexed ${version.id}: ${count} halaman`)
    }
  }

  console.log(`Selesai. Versi terindeks: ${indexedVersions}. Halaman terindeks: ${indexedPages}.`)
}

main()
  .catch((error) => {
    console.error("[ContentIndexer] Gagal mengindeks konten:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
