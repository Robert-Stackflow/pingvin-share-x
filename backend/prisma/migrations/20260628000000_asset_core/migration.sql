-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "ownerId" TEXT,
    "shareId" TEXT,
    "clipboardId" TEXT,
    "name" TEXT,
    "size" TEXT,
    "mimeType" TEXT,
    "storage" TEXT,
    "content" TEXT,
    "url" TEXT,
    CONSTRAINT "Asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Asset_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "Share" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Asset_clipboardId_fkey" FOREIGN KEY ("clipboardId") REFERENCES "Clipboard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Clipboard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "ownerId" TEXT,
    "roomId" TEXT,
    "name" TEXT,
    "passcodeHash" TEXT,
    CONSTRAINT "Clipboard_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShortLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT,
    "targetType" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "visits" INTEGER NOT NULL DEFAULT 0,
    "ownerId" TEXT,
    CONSTRAINT "ShortLink_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShortLinkVisit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shortLinkId" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "referer" TEXT,
    CONSTRAINT "ShortLinkVisit_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Asset_ownerId_idx" ON "Asset"("ownerId");

-- CreateIndex
CREATE INDEX "Asset_shareId_idx" ON "Asset"("shareId");

-- CreateIndex
CREATE INDEX "Asset_clipboardId_idx" ON "Asset"("clipboardId");

-- CreateIndex
CREATE UNIQUE INDEX "Clipboard_roomId_key" ON "Clipboard"("roomId");

-- CreateIndex
CREATE INDEX "Clipboard_ownerId_idx" ON "Clipboard"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "ShortLink_code_key" ON "ShortLink"("code");

-- CreateIndex
CREATE INDEX "ShortLink_ownerId_idx" ON "ShortLink"("ownerId");

-- CreateIndex
CREATE INDEX "ShortLink_targetType_idx" ON "ShortLink"("targetType");

-- CreateIndex
CREATE INDEX "ShortLinkVisit_shortLinkId_createdAt_idx" ON "ShortLinkVisit"("shortLinkId", "createdAt");

-- CreateIndex
CREATE INDEX "ShortLinkVisit_createdAt_idx" ON "ShortLinkVisit"("createdAt");

-- DropTable
DROP TABLE "File";
