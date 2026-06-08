-- CreateTable
CREATE TABLE "BookContentPage" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "volume" TEXT,
    "page" TEXT,
    "text" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookContentPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookContentPage_versionId_volume_page_key" ON "BookContentPage"("versionId", "volume", "page");

-- CreateIndex
CREATE INDEX "BookContentPage_bookId_idx" ON "BookContentPage"("bookId");

-- CreateIndex
CREATE INDEX "BookContentPage_versionId_idx" ON "BookContentPage"("versionId");

-- AddForeignKey
ALTER TABLE "BookContentPage" ADD CONSTRAINT "BookContentPage_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookContentPage" ADD CONSTRAINT "BookContentPage_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "BookVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
