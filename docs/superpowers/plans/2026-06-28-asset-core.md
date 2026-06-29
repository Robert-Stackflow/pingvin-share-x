# Asset Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old `File` persistence model with top-level `Asset` records that support `FILE`, `TEXT`, and `LINK`, while preserving the existing share upload/download flows.

**Architecture:** Build the backend foundation first: Prisma `Asset` schema, `AssetService` invariants, and storage-by-asset-id. Keep the existing `/shares/:shareId/files` route shape temporarily as a compatibility facade while its internals move to assets. Add frontend pages only after the backend contracts are stable.

**Tech Stack:** NestJS 11, Prisma 6, SQLite, local/S3 storage services, Next.js 14, Mantine 8.

---

## File Structure

- Modify: `backend/prisma/schema.prisma` for `AssetType`, `StorageProvider`, `Asset`, `Share.assets`, and `User.assets`.
- Create: `backend/src/asset/asset.service.ts` for asset creation, validation, metadata reads, owner listing, and file stream access.
- Create: `backend/src/asset/asset.module.ts` and `backend/src/asset/asset.controller.ts` for `/api/assets`.
- Create: `backend/src/asset/storage/local.storage.ts` and `backend/src/asset/storage/s3.storage.ts` for asset-id based file bytes.
- Modify: `backend/src/app.module.ts` to import `AssetModule`.
- Modify: `backend/src/share/share.service.ts` to include/project `assets` while preserving `files` in share responses.
- Modify: `backend/src/file/*` only as a temporary compatibility layer, then delete or shrink it once `/shares/:shareId/files` is backed by `AssetService`.
- Create: `frontend/src/services/asset.service.ts`, `frontend/src/types/asset.type.ts`, and `frontend/src/pages/account/assets.tsx` after backend endpoints exist.

## Task 1: Asset Schema And Core Service

- [x] **Step 1: Write failing tests for Asset invariants**

Create `backend/src/asset/asset.service.spec.ts` using Node's built-in test runner with `ts-node/register`. Cover:

```ts
await service.createText({ content: "hello" }, { id: "user-1" } as User);
await assert.rejects(() => service.createText({ content: "" }, user));
await service.createLink({ url: "https://example.com" }, user);
await assert.rejects(() => service.createLink({ url: "notaurl" }, user));
```

Run:

```bash
cd /Users/danqiong/ProgramData/pingvin-share-x/backend
node -r ts-node/register --test src/asset/asset.service.spec.ts
```

Expected before implementation: FAIL because `src/asset/asset.service.ts` does not exist.

- [x] **Step 2: Add Prisma Asset schema**

Update `backend/prisma/schema.prisma` with:

```prisma
enum AssetType {
  FILE
  TEXT
  LINK
}

enum StorageProvider {
  LOCAL
  S3
}

model Asset {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())

  type    AssetType
  ownerId String?
  owner   User? @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  shareId String?
  share   Share? @relation(fields: [shareId], references: [id], onDelete: Cascade)

  name     String?
  size     String?
  mimeType String?
  storage  StorageProvider?
  content  String?
  url      String?

  @@index([shareId])
  @@index([ownerId])
}
```

Also add `assets Asset[]` to `User`, replace `Share.files File[]` with `Share.assets Asset[]`, and remove `model File`.

Run:

```bash
cd /Users/danqiong/ProgramData/pingvin-share-x/backend
DATABASE_URL="file:../data/pingvin-share-dev.db" npx prisma db push
```

Expected: Prisma Client generation succeeds.

- [x] **Step 3: Implement minimal `AssetService`**

Create `backend/src/asset/asset.service.ts` with `createText`, `createLink`, and private validators. It should write only valid type-specific fields and connect `owner`/`share` only when supplied.

- [x] **Step 4: Verify green**

Run:

```bash
cd /Users/danqiong/ProgramData/pingvin-share-x/backend
node -r ts-node/register --test src/asset/asset.service.spec.ts
npm run build
```

Expected: tests pass and backend builds.

## Task 2: `/assets` API

- [x] Add DTOs for `AssetDTO` and `CreateAssetDTO`.
- [x] Add authenticated `POST /assets`, `GET /assets`, `GET /assets/:id`, and `DELETE /assets/:id` routes for standalone TEXT/LINK/FILE.
- [x] Add owner guard tests for cross-user access denial.
- [x] Verify with `npm run build` and smoke requests against `http://localhost:8081/api/assets`.

## Task 3: FILE Assets And Share Compatibility

- [x] Move local storage paths from `uploads/shares/{shareId}/{fileId}` to `uploads/assets/{assetId}`.
- [x] Back `/shares/:shareId/files` with FILE `Asset` persistence.
- [x] Project share `assets` back to `files` for existing frontend compatibility.
- [x] Update zip generation to read FILE assets by `assetId` and zip by `asset.name`.
- [x] Verify create-share, upload, complete, download, and zip flows through the running frontend.

## Task 4: Frontend Standalone Assets Page

- [x] Add `Asset` frontend type and `asset.service.ts`.
- [x] Add `/account/assets` list with type/name/created/size actions.
- [x] Add delete and FILE download actions.
- [x] Verify frontend build and manual smoke test.

## Task 5: Share Mixed Assets Increment

- [x] Add `POST /shares/:id/assets` for TEXT/LINK assets in a Share container.
- [x] Return full `assets` in Share DTOs while preserving `files` as FILE-only compatibility projection.
- [x] Add public share mixed Asset table for FILE/TEXT/LINK rows.
- [x] Add share edit composer for appending TEXT/LINK assets.
- [x] Verify service/controller tests, backend build, frontend typecheck/build, API smoke, and browser smoke.

## Task 6: Shared Frontend Asset Table

- [x] Add `frontend/src/components/asset/AssetTable.tsx` for common Asset type, value, size, created-at, loading, and action-column rendering.
- [x] Refactor `/account/assets`, clipboard asset tables, and public share mixed asset lists to use the shared table/value/type helpers.
- [x] Keep page-specific actions in their owning surfaces: account download/delete, clipboard file download, and share copy/preview/download actions.
- [x] Verify with `npx tsc --noEmit`, `npm run build`, and browser smokes for `/account/assets`, `/clipboard`, `/clipboard/rooms/TmfkOH7s`, and `/share/assetmixmqwpxhqg`.

## Task 7: Share Mixed Asset Management And Deletion

- [x] Add owner-only `DELETE /shares/:id/assets/:assetId` route and service method for share-owned TEXT/LINK assets.
- [x] Delete FILE asset bytes before metadata removal when the shared deletion path is used for a FILE asset.
- [x] Add share service/controller tests for successful owner deletion and cross-share denial.
- [x] Add a non-FILE asset management table on `/share/[shareId]/edit` with per-row delete action and confirmation modal.
- [x] Verify with targeted share tests, broad asset/clipboard/short-link backend regression, backend build, frontend typecheck/build, API smoke, and browser smoke for add/delete/public-absence on `/share/assetmixmqwpxhqg`.

## Task 8: Asset FILE Storage Provider Selection

- [x] Add an `AssetStorageService` interface shared by Asset FILE storage backends.
- [x] Add `AssetS3StorageService` using the same `assets/{assetId}` S3 key layout as the share compatibility S3 path.
- [x] Make `AssetService.createFile` choose `StorageProvider.S3` when `s3.enabled` is active, while keeping LOCAL as the default.
- [x] Make Asset download/delete select storage by the persisted `asset.storage`, so standalone assets and clipboard assets can be read/removed from S3 as well as local disk.
- [x] Verify with TDD red/green asset service tests, broad backend regression, and backend build.
