import { PrismaClient } from "@prisma/client"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const prisma = new PrismaClient()

const USUL_DATA_BASE = "https://raw.githubusercontent.com/seemorg/usul-data/main"

type Translation = { locale?: string; text?: string }

function translated(
  item: { primaryNameTranslations?: Translation[]; nameTranslations?: Translation[] },
  locale: string
): string | null {
  return (
    item.primaryNameTranslations?.find((t) => t.locale === locale)?.text ??
    item.nameTranslations?.find((t) => t.locale === locale)?.text ??
    null
  )
}

function readLocalJson<T>(fileName: string): T[] | null {
  const candidates = [
    path.resolve(process.cwd(), "../../usul-data", fileName),
    path.resolve(process.cwd(), "../../../usul-data", fileName),
    path.resolve(process.cwd(), "usul-data", fileName),
  ]

  const localPath = candidates.find((candidate) => existsSync(candidate))
  if (!localPath) return null
  return JSON.parse(readFileSync(localPath, "utf8")) as T[]
}

async function loadUsulData<T>(fileName: string): Promise<T[]> {
  const local = readLocalJson<T>(fileName)
  if (local) {
    console.log(`Membaca ${fileName} dari usul-data lokal...`)
    return local
  }

  console.log(`Mengunduh ${fileName}...`)
  const response = await fetch(`${USUL_DATA_BASE}/${fileName}`)
  if (!response.ok) {
    throw new Error(`Gagal mengambil ${fileName}: ${response.status}`)
  }
  return response.json() as Promise<T[]>
}

async function createInChunks<T>(items: T[], write: (chunk: T[]) => Promise<unknown>): Promise<void> {
  const chunkSize = 1_000
  for (let i = 0; i < items.length; i += chunkSize) {
    await write(items.slice(i, i + chunkSize))
  }
}

async function main() {
  console.log("Memulai seeding data Turath Chain...")

  try {
    const genresData = await loadUsulData<any>("genres.json")
    const authorsData = await loadUsulData<any>("authors.json")
    const booksData = await loadUsulData<any>("books.json")

    // 2. Seed Genres
    console.log("Seeding Genres...")
    const genres = genresData.map((g) => ({
      id: g.id || "unknown",
      nameAr: translated(g, "ar"),
      nameEn: translated(g, "en") ?? g.transliteration ?? null,
    }))

    for (const genre of genres) {
      await prisma.genre.upsert({
        where: { id: genre.id },
        update: genre,
        create: genre,
      })
    }

    // 3. Seed Authors
    console.log("Seeding Authors...")
    const authorsToCreate = authorsData.map((a) => ({
      id: a.id,
      nameAr: translated(a, "ar") ?? a.transliteration ?? a.id,
      nameEn: translated(a, "en"),
      yearDeath: a.year ?? null,
    }))

    console.log(`Menyimpan ${authorsToCreate.length} penulis...`)
    for (const a of authorsToCreate) {
      await prisma.author.upsert({
        where: { id: a.id },
        update: a,
        create: a,
      })
    }

    // 4. Seed Books
    console.log("Seeding Books...")
    const booksToCreate = []
    const bookGenresToCreate = []

    const mappedBooks = booksData.map((b) => ({
      id: b.id,
      slug: b.slug || b.id.replace(/\./g, '-').toLowerCase(),
      titleAr: translated(b, "ar") ?? b.transliteration ?? b.id,
      titleEn: translated(b, "en"),
      transliteration: b.transliteration ?? null,
      authorId: b.authorId || "unknown",
      genres: b.genres?.map((g: any) => g.id ?? g) ?? [],
      versions: b.versions ?? [],
    }))

    const validBookIds = mappedBooks.map((b) => b.id)
    const validAuthorIds = Array.from(
      new Set([
        ...authorsToCreate.map((a) => a.id),
        ...mappedBooks.map((b) => b.authorId),
      ])
    )

    console.log("Membersihkan record lama yang tidak ada di usul-data aktual...")
    await prisma.savedChain.deleteMany({ where: { bookId: { notIn: validBookIds } } })
    await prisma.bookRelation.deleteMany({
      where: {
        OR: [
          { sourceBookId: { notIn: validBookIds } },
          { targetBookId: { notIn: validBookIds } },
        ],
      },
    })
    await prisma.bookGenre.deleteMany({ where: { bookId: { notIn: validBookIds } } })
    await prisma.bookVersion.deleteMany({ where: { bookId: { notIn: validBookIds } } })
    await prisma.book.deleteMany({ where: { id: { notIn: validBookIds } } })
    await prisma.authorRelation.deleteMany({
      where: {
        OR: [
          { teacherId: { notIn: validAuthorIds } },
          { studentId: { notIn: validAuthorIds } },
        ],
      },
    })
    await prisma.author.deleteMany({ where: { id: { notIn: validAuthorIds } } })

    for (const b of mappedBooks) {
      booksToCreate.push({
        id: b.id,
        slug: b.slug,
        titleAr: b.titleAr,
        titleEn: b.titleEn,
        transliteration: b.transliteration,
        authorId: b.authorId,
      })

      if (b.genres && Array.isArray(b.genres)) {
        for (const genreId of b.genres) {
          bookGenresToCreate.push({
            bookId: b.id,
            genreId
          })
        }
      }
    }

    console.log(`Menyimpan ${booksToCreate.length} kitab...`)
    
    // Batch check authors for N+1 prevention
    const allBookAuthorIds = Array.from(new Set(booksToCreate.map(b => b.authorId)))
    const existingAuthors = await prisma.author.findMany({
      where: { id: { in: allBookAuthorIds } },
      select: { id: true }
    })
    const existingAuthorSet = new Set(existingAuthors.map(a => a.id))

    // Buat author yang hilang secara bulk (optional) atau biarkan relasi upsert menanganinya jika upsert author digabung.
    // Kita buat author yang hilang
    const missingAuthorIds = allBookAuthorIds.filter(id => !existingAuthorSet.has(id))
    if (missingAuthorIds.length > 0) {
      console.log(`Membuat ${missingAuthorIds.length} author placeholder berbasis ID asli...`)
      await prisma.author.createMany({
        data: missingAuthorIds.map(id => ({ id, nameAr: id })),
        skipDuplicates: true,
      })
    }

    for (const b of booksToCreate) {
      await prisma.book.upsert({
        where: { id: b.id },
        update: b,
        create: b,
      })
    }

    console.log("Menghapus relasi kitab-genre dan versi lama sebelum rebuild...")
    await prisma.bookGenre.deleteMany()
    await prisma.bookVersion.deleteMany()

    console.log(`Menyimpan ${bookGenresToCreate.length} relasi kitab-genre...`)
    await createInChunks(bookGenresToCreate, (chunk) =>
      prisma.bookGenre.createMany({ data: chunk, skipDuplicates: true })
    )

    const versionsToCreate = mappedBooks.flatMap((b) =>
      b.versions.map((v: any) => ({
        id: String(v.id),
        bookId: b.id,
        value: String(v.value ?? ""),
        source: String(v.source ?? "unknown"),
      }))
    )

    console.log(`Menyimpan ${versionsToCreate.length} versi kitab...`)
    await createInChunks(versionsToCreate, (chunk) =>
      prisma.bookVersion.createMany({ data: chunk, skipDuplicates: true })
    )

    console.log("Seeding selesai!")
  } catch (error) {
    console.error("Terjadi kesalahan saat seeding:", error)
    process.exit(1)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
