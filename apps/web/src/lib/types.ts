export type ApiError = {
  code: string
  message: string
}

export type Author = {
  id: string
  nameAr: string
  nameEn: string | null
  yearDeath: number | null
}

export type Genre = {
  id: string
  nameAr: string | null
  nameEn: string | null
}

export type CatalogGenre = {
  id: string
  nameAr: string | null
  nameEn: string | null
}

export type BookGenre = {
  bookId: string
  genreId: string
  genre: Genre
}

export type Book = {
  id: string
  slug: string
  titleAr: string
  titleEn: string | null
  transliteration: string | null
  authorId: string
  author: Author
  genres: BookGenre[]
}

export type RelationType = "SHARH" | "MUKHTASAR" | "HASHIYA" | "TALKHIS" | "RELATED"

export type BookRelation = {
  id: string
  sourceBookId: string
  targetBookId: string
  relationType: RelationType
  source: string
  targetBook?: Book
  sourceBook?: Book
}

export type ChainNode = {
  book: Book
  relationType: RelationType | null
  children: ChainNode[]
}

export type SavedChain = {
  id: string
  userId: string
  bookId: string
  note: string | null
  query: string | null
  createdAt: string
  book: Book
}

export type LoginEvent = {
  id: string
  userId: string
  provider: string
  createdAt: string
}

export type ProfileSummary = {
  user: {
    id: string
    email: string
    name: string | null
    image: string | null
    createdAt: string
    accounts: Array<{
      provider: string
      providerAccountId: string
    }>
  }
  stats: {
    savedCount: number
    uniqueBooksCount: number
    loginCount: number
    connectedProviders: string[]
    firstLoginAt: string
    lastLoginAt: string
    lastSavedAt: string | null
  }
  recentSavedChains: SavedChain[]
  loginHistory: LoginEvent[]
}

export type SearchMeta = {
  total: number
  page: number
  limit: number
  totalPages: number
}

export type ContentSearchResult = {
  id: string
  bookId: string
  versionId: string
  volume: string | null
  page: string | null
  text: string
  source: string
  value: string
  createdAt: string
  book: Book
}

export type CatalogBookResult = {
  id: string
  slug: string
  titleAr: string
  titleEn: string | null
  transliteration: string | null
  author: Author
  genres: CatalogGenre[]
  authorWorks: {
    id: string
    slug: string
    titleAr: string
  }[]
}

export type CatalogAuthorResult = {
  id: string
  nameAr: string
  nameEn: string | null
  yearDeath: number | null
  works: {
    id: string
    slug: string
    titleAr: string
    genres: {
      id: string
      nameAr: string | null
    }[]
  }[]
}

export type CatalogSearchResponse = {
  data: {
    books: CatalogBookResult[]
    authors: CatalogAuthorResult[]
  }
  meta: {
    totalBooks: number
    totalAuthors: number
    page: number
    limit: number
  }
}

export type HistoricalBookSummary = {
  id: string
  slug: string
  titleAr: string
  titleEn: string | null
  transliteration: string | null
  genres: Genre[]
}

export type HistoricalAuthorSummary = {
  id: string
  nameAr: string
  nameEn: string | null
  yearDeath: number | null
  works: HistoricalBookSummary[]
}

export type HistoricalYearItem = {
  book: HistoricalBookSummary
  author: Author
  filterReason: string
}

export type HistoricalYearSearchResponse = {
  data: HistoricalYearItem[]
  meta: SearchMeta
}

export type HistoricalLineageResponse = {
  data: {
    author: HistoricalAuthorSummary
    teachers: HistoricalAuthorSummary[]
    students: HistoricalAuthorSummary[]
    dataNote: string
  }
}

export type ManuscriptGenre = {
  id: string
  nameAr: string | null
  nameEn: string | null
}

export type ManuscriptBook = {
  id: string
  slug: string
  titleAr: string
  titleEn: string | null
  author: Author
  genres: ManuscriptGenre[]
}

export type ManuscriptSemanticResult = {
  score: number
  textAr: string
  babTitle: string | null
  pageRef: string | null
  book: ManuscriptBook
}

export type ManuscriptSemanticSearchResponse = {
  data: ManuscriptSemanticResult[]
  meta: {
    topK: number
    total: number
  }
}

export type ManuscriptSemanticStatusResponse = {
  data: {
    indexedBooks: number
    totalVectors: number
  }
}

export type ManuscriptLexicalSnippet = {
  before: string
  match: string
  after: string
}

export type ManuscriptLexicalResult = {
  bookId: string
  book: ManuscriptBook
  page: string | null
  volume: string | null
  snippet: ManuscriptLexicalSnippet
}

export type ManuscriptLexicalSearchResponse = {
  data: ManuscriptLexicalResult[]
  meta: SearchMeta
}
