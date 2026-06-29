# Clipboard Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the online clipboard core: private clipboards, room clipboards, passcode verification, and TEXT/LINK/FILE Asset attachment to clipboards.

**Architecture:** Reuse the existing `Asset` table for clipboard content and add a `Clipboard` container table. Keep Asset creation rules in `AssetService`; `ClipboardService` owns container creation, room passcodes, setting `clipboardId`, and download access checks for clipboard FILE assets.

**Tech Stack:** NestJS 11, Prisma 6, SQLite, argon2, Node test runner.

---

## Task 1: Clipboard Schema And Service

- [x] Add `ClipboardType`, `Clipboard`, `User.clipboards`, and `Asset.clipboardId`.
- [x] Write failing tests for `getOrCreatePrivate`, `createRoom`, `verifyRoomPasscode`, and `addTextAsset`.
- [x] Implement `ClipboardService` using `AssetService.createText/createLink`.
- [x] Update standalone Asset filters to require `clipboardId: null`.

## Task 2: Clipboard API

- [x] Add `ClipboardModule` and `ClipboardController`.
- [x] Add authenticated `/clipboards/me`, `/clipboards/me/assets`, `/clipboards/rooms`, `/clipboards/rooms/:roomId/verify` routes.
- [x] Add controller tests for dispatch and owner scoping.

## Task 3: Verification

- [x] Apply Prisma migration to a fresh temp SQLite DB.
- [x] Run clipboard and asset tests.
- [x] Run backend build and lint.

## Task 4: Clipboard FILE Assets

- [x] Add tests for clipboard FILE upload and private/room download access.
- [x] Add `POST /clipboards/me/assets?type=FILE...` and `POST /clipboards/rooms/:roomId/assets?type=FILE...`.
- [x] Add `GET /clipboards/me/assets/:assetId/download` and `GET /clipboards/rooms/:roomId/assets/:assetId/download`.
- [x] Wire the clipboard frontend composer/table to upload and download FILE assets.
- [x] Smoke test private and room FILE upload/download with byte-for-byte content checks.

## Task 5: Clipboard Asset Deletion

- [x] Add tested `AssetService.remove` helper that deletes file bytes before asset metadata.
- [x] Add authenticated `DELETE /clipboards/me/assets/:assetId` for private clipboard assets.
- [x] Add authenticated `DELETE /clipboards/rooms/:roomId/assets/:assetId` for assets in rooms owned by the current user.
- [x] Add delete actions to the clipboard asset table for private and owned room editor lists.
- [x] Verify backend regression tests, backend build, frontend typecheck/build, API smoke for private and room deletion, and browser smoke for private/room delete controls.

## Task 6: Public Room Route Access

- [x] Keep `/clipboard` private and login-protected.
- [x] Allow unauthenticated visitors to load `/clipboard/rooms/:roomId` so room links can be opened before passcode verification.
- [x] Verify the red state (`/clipboard/rooms/publicsmoke` redirected to sign-in), then verify the fixed route returns `200 OK` while `/clipboard` still redirects to sign-in.
