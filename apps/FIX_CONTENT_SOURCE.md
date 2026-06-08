# FIX_CONTENT_SOURCE.md
# Instruksi Agent: Ganti Sumber Konten dari Usul.ai ke OpenITI GitHub
# 
# MASALAH: assets.usul.ai mengembalikan 403 untuk semua request dari luar.
# SOLUSI: Fetch teks langsung dari raw.githubusercontent.com/OpenITI
#
# JANGAN ubah apapun selain yang tertulis di sini.

---

## FILE 1 — Ubah `apps/api/src/services/book-content.service.ts`

### Langkah 1.1 — Hapus konstanta lama, tambah konstanta baru

CARI dan HAPUS baris ini:
```ts
const DEFAULT_USUL_ASSETS_URL = "https://assets.usul.ai"
const MAX_PREVIEW_LENGTH = 2_000
const MAX_CONTENT_SEARCH_RESULTS = 10
```

GANTI dengan:
```ts
const MAX_PREVIEW_LENGTH = 2_000
const MAX_CONTENT_SEARCH_RESULTS = 10
const OPENITI_RAW_BASE = "https://raw.githubusercontent.com/OpenITI"
```

---

### Langkah 1.2 — Tambah interface baru untuk OpenITI

Tepat SETELAH interface `IUsulBookContent`, TAMBAHKAN:
```ts
// Format teks mentah OpenITI (plain text mARkdown)
export interface IOpenITIRawContent {
  rawText: string
  pages: IUsulPage[]
}
```

---

### Langkah 1.3 — Tambah fungsi baru untuk OpenITI

Tepat SEBELUM fungsi `fetchVersionContent`, TAMBAHKAN dua fungsi baru berikut:

```ts
/**
 * Hitung nama repo OpenITI berdasarkan tahun wafat dari version.value
 * Contoh: "0911Suyuti.TadribRawi.Shamela..." → repo "0925AH"
 */
function getOpenITIRepo(versionValue: string): string | null {
  const match = versionValue.match(/^(\d{4})/)
  if (!match) return null
  const year = parseInt(match[1])
  const repo = Math.ceil(year / 25) * 25
  return `${String(repo).padStart(4, "0")}AH`
}

/**
 * Fetch teks kitab langsung dari OpenITI GitHub (plain text mARkdown)
 * URL format: https://raw.githubusercontent.com/OpenITI/{repo}/master/data/{author}/{author.book}/{version}
 */
export async function fetchOpenITIContent(version: BookVersion): Promise<IUsulBookContent | null> {
  const repo = getOpenITIRepo(version.value)
  if (!repo) return null

  // Ekstrak author dan book dari version.value
  // Format: "0911Suyuti.TadribRawi.Shamela0001234-ara1"
  const parts = version.value.split(".")
  if (parts.length < 2) return null

  const authorId = parts[0]
  const bookShort = parts[1]
  const url = `${OPENITI_RAW_BASE}/${repo}/master/data/${authorId}/${authorId}.${bookShort}/${version.value}`

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "TurathChain/1.0" },
    })

    if (!response.ok) return null

    const rawText = await response.text()
    if (!rawText || rawText.startsWith("404")) return null

    // Parse mARkdown menjadi pages
    const pages = parseOpenITIMarkdown(rawText)
    if (pages.length === 0) return null

    return { pages }
  } catch (error) {
    console.error(`[BookContentService] OpenITI fetch failed for ${version.value}:`, error)
    return null
  }
}

/**
 * Parse format mARkdown OpenITI menjadi array pages
 * Hapus: header metadata, page markers, milestone markers
 * Simpan: teks Arab bersih dengan referensi halaman
 */
function parseOpenITIMarkdown(rawText: string): IUsulPage[] {
  const lines = rawText.split("\n")
  const pages: IUsulPage[] = []

  let currentPageText: string[] = []
  let currentPage = "1"
  let currentVol = "1"
  let inHeader = true

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip header metadata OpenITI
    if (inHeader) {
      if (trimmed.startsWith("#META#") || trimmed.startsWith("######OpenITI#")) continue
      // Teks utama dimulai setelah baris kosong pertama setelah metadata
      if (trimmed === "" && currentPageText.length === 0) continue
      if (/^[\u0600-\u06FF]/.test(trimmed)) inHeader = false
    }

    // Deteksi page marker: PageV01P001
    const pageMatch = trimmed.match(/^PageV(\d+)P(\d+)/)
    if (pageMatch) {
      // Simpan halaman sebelumnya
      if (currentPageText.length > 0) {
        pages.push({
          text: currentPageText.join(" ").trim(),
          vol: currentVol,
          page: currentPage,
        })
        currentPageText = []
      }
      currentVol = String(parseInt(pageMatch[1]))
      currentPage = String(parseInt(pageMatch[2]))
      continue
    }

    // Skip milestone markers: ms001
    if (/^ms\d+/.test(trimmed)) continue

    // Skip baris metadata lain
    if (trimmed.startsWith("#") && !trimmed.startsWith("###")) continue

    // Ambil teks dari header bab: ### الباب الأول → ambil teksnya
    if (trimmed.startsWith("###")) {
      const babText = trimmed.replace(/^#+\s*/, "").trim()
      if (babText) currentPageText.push(babText)
      continue
    }

    // Ambil teks biasa — hanya baris yang mengandung Arab
    if (trimmed && /[\u0600-\u06FF]/.test(trimmed)) {
      // Hapus karakter non-Arab kecuali spasi dan tanda baca umum
      const cleanLine = trimmed.replace(/[%~@|]/g, " ").replace(/\s+/g, " ").trim()
      if (cleanLine) currentPageText.push(cleanLine)
    }
  }

  // Simpan halaman terakhir
  if (currentPageText.length > 0) {
    pages.push({
      text: currentPageText.join(" ").trim(),
      vol: currentVol,
      page: currentPage,
    })
  }

  return pages
}
```

---

### Langkah 1.4 — Ubah fungsi `fetchVersionContent` untuk pakai OpenITI sebagai fallback

CARI fungsi ini (ganti seluruh isinya):
```ts
export async function fetchVersionContent(version: BookVersion): Promise<IUsulBookContent | null> {
  const baseUrl = process.env.USUL_ASSETS_URL ?? DEFAULT_USUL_ASSETS_URL
  const url = `${baseUrl.replace(/\/$/, "")}/book-content/${version.source}/${version.value}.json`

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
    })

    if (!response.ok) {
      return null
    }

    return (await response.json()) as IUsulBookContent
  } catch (error) {
    console.error(`[BookContentService] Failed to fetch content for ${version.id}:`, error)
    return null
  }
}
```

GANTI dengan:
```ts
export async function fetchVersionContent(version: BookVersion): Promise<IUsulBookContent | null> {
  // Langsung fetch dari OpenITI GitHub
  // assets.usul.ai mengembalikan 403 untuk semua request eksternal
  return fetchOpenITIContent(version)
}
```

---

## FILE 2 — Tidak ada perubahan di `index-content.ts`

`index-content.ts` memanggil `fetchVersionContent` yang sudah kita ubah di atas.
Tidak perlu diubah.

---

## FILE 3 — Update `.env.example` root dan `apps/api/.env.example`

HAPUS baris ini jika ada:
```
USUL_ASSETS_URL=https://assets.usul.ai
```

Tidak diperlukan lagi karena kita langsung fetch dari OpenITI GitHub.

---

## VERIFIKASI SETELAH PERUBAHAN

Jalankan di PowerShell untuk test apakah fetch berhasil:
```powershell
cd apps/api
pnpm tsx -e "
import { fetchVersionContent } from './src/services/book-content.service.ts'
const version = {
  id: 'test',
  bookId: 'test',
  source: 'openiti',
  value: '0179Malik.Muwatta.Shamela0001757-ara1',
  createdAt: new Date()
}
fetchVersionContent(version).then(r => {
  if (r?.pages) console.log('✅ Berhasil! Pages:', r.pages.length)
  else console.log('❌ Gagal, null dikembalikan')
})
"
```

Harus muncul: `✅ Berhasil! Pages: [angka]`

---

## SETELAH PERUBAHAN BERHASIL

Jalankan indexing konten untuk kitab fiqh:
```powershell
cd apps/api
pnpm tsx prisma/index-content.ts --limit=100
```

Ini akan mengisi tabel `BookContentPage` dengan teks Arab dari OpenITI.
Setelah ini "Cuplikan teks belum tersedia" tidak akan muncul lagi untuk kitab yang berhasil diindex.
