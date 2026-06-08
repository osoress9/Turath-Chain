-- CreateTable
CREATE TABLE "TextChunk" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "textAr" TEXT NOT NULL,
    "babTitle" TEXT,
    "pageRef" TEXT,
    "qdrantId" TEXT NOT NULL,

    CONSTRAINT "TextChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TextChunk_qdrantId_key" ON "TextChunk"("qdrantId");

-- CreateIndex
CREATE UNIQUE INDEX "TextChunk_bookId_chunkIndex_key" ON "TextChunk"("bookId", "chunkIndex");

-- CreateIndex
CREATE INDEX "TextChunk_bookId_idx" ON "TextChunk"("bookId");

-- AddForeignKey
ALTER TABLE "TextChunk" ADD CONSTRAINT "TextChunk_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
