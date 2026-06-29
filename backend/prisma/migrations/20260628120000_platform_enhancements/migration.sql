-- CreateTable
CREATE TABLE "AccessPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "passwordHash" TEXT,
    "expiresAt" DATETIME,
    "maxViews" INTEGER,
    "views" INTEGER NOT NULL DEFAULT 0,
    "allowDownload" BOOLEAN NOT NULL DEFAULT true,
    "allowAnonymous" BOOLEAN NOT NULL DEFAULT true,
    "oneTime" BOOLEAN NOT NULL DEFAULT false,
    "shareId" TEXT,
    "clipboardId" TEXT,
    "shortLinkId" TEXT,
    "reverseShareId" TEXT,
    CONSTRAINT "AccessPolicy_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "Share" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccessPolicy_clipboardId_fkey" FOREIGN KEY ("clipboardId") REFERENCES "Clipboard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccessPolicy_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccessPolicy_reverseShareId_fkey" FOREIGN KEY ("reverseShareId") REFERENCES "ReverseShare" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InboxSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "reverseShareId" TEXT NOT NULL,
    CONSTRAINT "InboxSubmission_reverseShareId_fkey" FOREIGN KEY ("reverseShareId") REFERENCES "ReverseShare" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "favorite" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Asset" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'UPLOAD';
ALTER TABLE "Asset" ADD COLUMN "lastAccessedAt" DATETIME;
ALTER TABLE "Asset" ADD COLUMN "inboxSubmissionId" TEXT REFERENCES "InboxSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "AssetTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "AssetTag_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetTagAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assetId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    CONSTRAINT "AssetTagAssignment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetTagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "AssetTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "actorId" TEXT,
    CONSTRAINT "ActivityEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Migrate legacy access settings into AccessPolicy.
INSERT INTO "AccessPolicy" (
    "id",
    "createdAt",
    "updatedAt",
    "passwordHash",
    "expiresAt",
    "maxViews",
    "views",
    "shareId"
)
SELECT
    lower(hex(randomblob(4))) || '-' ||
    lower(hex(randomblob(2))) || '-' ||
    '4' || substr(lower(hex(randomblob(2))), 2) || '-' ||
    substr('89ab', abs(random()) % 4 + 1, 1) ||
    substr(lower(hex(randomblob(2))), 2) || '-' ||
    lower(hex(randomblob(6))),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    "ShareSecurity"."password",
    CASE
        WHEN strftime('%s', "Share"."expiration") = '0' THEN NULL
        ELSE "Share"."expiration"
    END,
    "ShareSecurity"."maxViews",
    "Share"."views",
    "Share"."id"
FROM "Share"
LEFT JOIN "ShareSecurity" ON "ShareSecurity"."shareId" = "Share"."id"
WHERE "ShareSecurity"."password" IS NOT NULL
   OR "ShareSecurity"."maxViews" IS NOT NULL
   OR strftime('%s', "Share"."expiration") != '0';

INSERT INTO "AccessPolicy" (
    "id",
    "createdAt",
    "updatedAt",
    "passwordHash",
    "clipboardId"
)
SELECT
    lower(hex(randomblob(4))) || '-' ||
    lower(hex(randomblob(2))) || '-' ||
    '4' || substr(lower(hex(randomblob(2))), 2) || '-' ||
    substr('89ab', abs(random()) % 4 + 1, 1) ||
    substr(lower(hex(randomblob(2))), 2) || '-' ||
    lower(hex(randomblob(6))),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    "passcodeHash",
    "id"
FROM "Clipboard"
WHERE "type" = 'ROOM' AND "passcodeHash" IS NOT NULL;

INSERT INTO "AccessPolicy" (
    "id",
    "createdAt",
    "updatedAt",
    "expiresAt",
    "reverseShareId"
)
SELECT
    lower(hex(randomblob(4))) || '-' ||
    lower(hex(randomblob(2))) || '-' ||
    '4' || substr(lower(hex(randomblob(2))), 2) || '-' ||
    substr('89ab', abs(random()) % 4 + 1, 1) ||
    substr(lower(hex(randomblob(2))), 2) || '-' ||
    lower(hex(randomblob(6))),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    "shareExpiration",
    "id"
FROM "ReverseShare";

-- CreateIndex
CREATE UNIQUE INDEX "AccessPolicy_shareId_key" ON "AccessPolicy"("shareId");
CREATE UNIQUE INDEX "AccessPolicy_clipboardId_key" ON "AccessPolicy"("clipboardId");
CREATE UNIQUE INDEX "AccessPolicy_shortLinkId_key" ON "AccessPolicy"("shortLinkId");
CREATE UNIQUE INDEX "AccessPolicy_reverseShareId_key" ON "AccessPolicy"("reverseShareId");
CREATE INDEX "AccessPolicy_expiresAt_idx" ON "AccessPolicy"("expiresAt");

CREATE INDEX "InboxSubmission_reverseShareId_idx" ON "InboxSubmission"("reverseShareId");
CREATE INDEX "InboxSubmission_status_idx" ON "InboxSubmission"("status");
CREATE INDEX "InboxSubmission_createdAt_idx" ON "InboxSubmission"("createdAt");

CREATE INDEX "Asset_inboxSubmissionId_idx" ON "Asset"("inboxSubmissionId");
CREATE INDEX "Asset_source_idx" ON "Asset"("source");
CREATE INDEX "Asset_favorite_idx" ON "Asset"("favorite");
CREATE INDEX "Asset_lastAccessedAt_idx" ON "Asset"("lastAccessedAt");

CREATE UNIQUE INDEX "AssetTag_ownerId_name_key" ON "AssetTag"("ownerId", "name");
CREATE INDEX "AssetTag_ownerId_idx" ON "AssetTag"("ownerId");

CREATE UNIQUE INDEX "AssetTagAssignment_assetId_tagId_key" ON "AssetTagAssignment"("assetId", "tagId");
CREATE INDEX "AssetTagAssignment_tagId_idx" ON "AssetTagAssignment"("tagId");

CREATE INDEX "ActivityEvent_actorId_createdAt_idx" ON "ActivityEvent"("actorId", "createdAt");
CREATE INDEX "ActivityEvent_targetType_targetId_createdAt_idx" ON "ActivityEvent"("targetType", "targetId", "createdAt");
CREATE INDEX "ActivityEvent_action_createdAt_idx" ON "ActivityEvent"("action", "createdAt");
CREATE INDEX "ActivityEvent_createdAt_idx" ON "ActivityEvent"("createdAt");
