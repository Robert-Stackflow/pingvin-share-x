# Short Link Core Implementation Plan

> **For agentic workers:** implement with TDD. Keep backend and frontend slices small, verify after each layer.

**Goal:** Add generic short links with Redis-backed cache/counter integration, detailed visit logs, stats API, and a first frontend management dashboard.

## Task 1: Backend Schema And Service

- [x] Add `ShortLinkTargetType`, `ShortLink`, `ShortLinkVisit`, and `User.shortLinks`.
- [x] Write failing tests for schema, creation, duplicate/URL validation, visit recording, and stats aggregation.
- [x] Implement `ShortLinkService` with target cache keys and visit counter cache keys.
- [x] Hash IPs; do not store raw IP addresses.

## Task 2: Backend API

- [x] Add `ShortLinkModule` and `ShortLinkController`.
- [x] Add authenticated create/list/stats routes.
- [x] Add public visit route that records analytics and redirects.
- [x] Prefer `x-forwarded-for` so `/l/:code` SSR can forward the visitor IP.

## Task 3: Frontend

- [x] Add short-link types and service.
- [x] Add `/account/short-links` dashboard.
- [x] Add `/l/[code]` public redirect page.
- [x] Add nav and translations.

## Task 4: Verification

- [x] Run backend short-link tests plus asset/clipboard regression tests.
- [x] Run backend build and lint.
- [x] Run frontend typecheck and build.
- [x] Replay migrations on a fresh SQLite DB.
- [x] Smoke test create/list/visit/stats against running dev servers.

## Task 5: Short Link Lifecycle Increment

- [x] Add authenticated update and delete routes for owned short links.
- [x] Add frontend edit, enable/disable, and delete controls.
- [x] Verify lifecycle service/controller tests.
- [x] Smoke test create, disable, re-enable, visit, stats, and delete against running dev servers.
- [x] Smoke test create and edit from the short-link dashboard UI.

## Task 6: Analytics Increment

- [x] Add stats tests for unique visitors, last visit, source distribution, User-Agent distribution, and capped recent logs.
- [x] Aggregate chart buckets from full visit logs while limiting recent visit details to 100 rows.
- [x] Extend frontend stats types and dashboard with compact metrics plus lightweight bar charts.
