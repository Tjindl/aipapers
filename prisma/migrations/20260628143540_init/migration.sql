-- CreateTable
CREATE TABLE "Paper" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT NOT NULL,
    "abstract" TEXT,
    "publishedDate" TIMESTAMP(3),
    "doi" TEXT,
    "arxivId" TEXT,
    "citationCount" INTEGER,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "categories" TEXT NOT NULL,
    "tags" TEXT NOT NULL,

    CONSTRAINT "Paper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperSource" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "pdfUrl" TEXT,

    CONSTRAINT "PaperSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Paper_doi_key" ON "Paper"("doi");

-- CreateIndex
CREATE UNIQUE INDEX "Paper_arxivId_key" ON "Paper"("arxivId");

-- CreateIndex
CREATE INDEX "PaperSource_source_idx" ON "PaperSource"("source");

-- CreateIndex
CREATE INDEX "PaperSource_paperId_idx" ON "PaperSource"("paperId");

-- CreateIndex
CREATE UNIQUE INDEX "PaperSource_paperId_source_key" ON "PaperSource"("paperId", "source");

-- AddForeignKey
ALTER TABLE "PaperSource" ADD CONSTRAINT "PaperSource_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;
