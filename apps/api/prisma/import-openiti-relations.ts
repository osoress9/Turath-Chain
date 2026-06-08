import { PrismaClient, RelationType } from "@prisma/client"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

const prisma = new PrismaClient()

interface IImportOptions {
  dir: string | null
  limit: number | null
}

interface IBookRelationCandidate {
  sourceBookId: string
  targetBookId: string
  relationType: RelationType
}

interface IAuthorRelationCandidate {
  teacherId: string
  studentId: string
}

function readOptions(): IImportOptions {
  const options: IImportOptions = {
    dir: process.env.OPENITI_DATA_DIR ?? null,
    limit: null,
  }

  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.split("=")
    if (key === "--dir" && value) {
      options.dir = value
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

function listYmlFiles(rootDir: string, limit: number | null): string[] {
  const files: string[] = []

  function visit(currentDir: string): void {
    if (limit && files.length >= limit) return

    for (const entry of readdirSync(currentDir)) {
      if (limit && files.length >= limit) return

      const fullPath = path.join(currentDir, entry)
      const stats = statSync(fullPath)

      if (stats.isDirectory()) {
        visit(fullPath)
        continue
      }

      if (entry.endsWith(".yml")) {
        files.push(fullPath)
      }
    }
  }

  visit(rootDir)
  return files
}

function collectField(content: string, fieldPrefix: string): string[] {
  const lines = content.split(/\r?\n/)
  const values: string[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line.includes(fieldPrefix)) continue

    const valueParts = [line.slice(line.indexOf(":") + 1)]

    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      const nextLine = lines[nextIndex]
      if (/^\s*\d{2}#/.test(nextLine)) break
      valueParts.push(nextLine)
    }

    values.push(valueParts.join("\n"))
  }

  return values
}

function extractUriTokens(value: string): string[] {
  const matches = value.match(/\b\d{4}[A-Za-z0-9][A-Za-z0-9_-]*(?:\.[A-Za-z0-9][A-Za-z0-9_-]*){1,2}\b/g)
  if (!matches) return []

  return Array.from(new Set(matches.map((match) => match.split(".").slice(0, 2).join("."))))
}

function extractAuthorUriTokens(value: string): string[] {
  const matches = value.match(/\b\d{4}[A-Za-z0-9][A-Za-z0-9_-]*\b/g)
  return matches ? Array.from(new Set(matches)) : []
}

function getSingleBookUri(content: string, fieldPrefix: string): string | null {
  const value = collectField(content, fieldPrefix).join("\n")
  return extractUriTokens(value)[0] ?? null
}

function getSingleAuthorUri(content: string, fieldPrefix: string): string | null {
  const value = collectField(content, fieldPrefix).join("\n")
  return extractAuthorUriTokens(value)[0] ?? null
}

function inferRelationType(value: string): RelationType {
  if (/شرح|sharh/i.test(value)) return RelationType.SHARH
  if (/مختصر|mukhtasar/i.test(value)) return RelationType.MUKHTASAR
  if (/حاشية|hashiya|haashiya/i.test(value)) return RelationType.HASHIYA
  if (/تلخيص|talkhis/i.test(value)) return RelationType.TALKHIS
  return RelationType.RELATED
}

function parseBookRelations(content: string): IBookRelationCandidate[] {
  const sourceBookId = getSingleBookUri(content, "00#BOOK#URI")
  if (!sourceBookId) return []

  return collectField(content, "40#BOOK#RELATED").flatMap((fieldValue) =>
    extractUriTokens(fieldValue)
      .filter((targetBookId) => targetBookId !== sourceBookId)
      .map((targetBookId) => ({
        sourceBookId,
        targetBookId,
        relationType: inferRelationType(fieldValue),
      }))
  )
}

function parseAuthorRelations(content: string): IAuthorRelationCandidate[] {
  const authorId = getSingleAuthorUri(content, "00#AUTH#URI")
  if (!authorId) return []

  const teachers = collectField(content, "40#AUTH#TEACHERS")
    .flatMap(extractAuthorUriTokens)
    .map((teacherId) => ({ teacherId, studentId: authorId }))

  const students = collectField(content, "40#AUTH#STUDENTS")
    .flatMap(extractAuthorUriTokens)
    .map((studentId) => ({ teacherId: authorId, studentId }))

  return [...teachers, ...students]
}

async function importBookRelations(candidates: IBookRelationCandidate[]): Promise<number> {
  let created = 0

  for (const candidate of candidates) {
    const [sourceBook, targetBook] = await Promise.all([
      prisma.book.findUnique({ where: { id: candidate.sourceBookId }, select: { id: true } }),
      prisma.book.findUnique({ where: { id: candidate.targetBookId }, select: { id: true } }),
    ])

    if (!sourceBook || !targetBook) continue

    await prisma.bookRelation.upsert({
      where: {
        sourceBookId_targetBookId_relationType: candidate,
      },
      update: { source: "openiti_yml" },
      create: {
        ...candidate,
        source: "openiti_yml",
      },
    })
    created += 1
  }

  return created
}

async function importAuthorRelations(candidates: IAuthorRelationCandidate[]): Promise<number> {
  let created = 0

  for (const candidate of candidates) {
    const [teacher, student] = await Promise.all([
      prisma.author.findUnique({ where: { id: candidate.teacherId }, select: { id: true } }),
      prisma.author.findUnique({ where: { id: candidate.studentId }, select: { id: true } }),
    ])

    if (!teacher || !student || candidate.teacherId === candidate.studentId) continue

    await prisma.authorRelation.upsert({
      where: {
        teacherId_studentId: candidate,
      },
      update: {},
      create: candidate,
    })
    created += 1
  }

  return created
}

async function main(): Promise<void> {
  const options = readOptions()

  if (!options.dir || !existsSync(options.dir)) {
    console.log("OPENITI_DATA_DIR belum tersedia. Lewati import relasi OpenITI.")
    return
  }

  const ymlFiles = listYmlFiles(options.dir, options.limit)
  console.log(`Membaca ${ymlFiles.length} file YML OpenITI...`)

  let bookRelationCount = 0
  let authorRelationCount = 0

  for (const filePath of ymlFiles) {
    const content = readFileSync(filePath, "utf8")
    bookRelationCount += await importBookRelations(parseBookRelations(content))
    authorRelationCount += await importAuthorRelations(parseAuthorRelations(content))
  }

  console.log(`Import selesai. Relasi kitab: ${bookRelationCount}. Relasi guru-murid: ${authorRelationCount}.`)
}

main()
  .catch((error) => {
    console.error("[OpenITIImporter] Import relasi gagal:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
