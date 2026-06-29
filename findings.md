# Findings & Decisions

## Requirements
- Replace old `File` with top-level `Asset` supporting at least FILE, TEXT, and LINK.
- Add online clipboard support for private clipboards and room clipboards.
- Add short-link system with Redis/cache support and detailed statistics.
- Refactor frontend so users can operate the new asset, clipboard, and short-link flows.
- Start both backend and frontend and continue implementation from the current repo state.

## Research Findings
- Existing implementation plans under `docs/superpowers/plans/` show asset core, clipboard core, and short-link core tasks mostly checked off.
- Current branch is `feat/asset-core`.
- Worktree is intentionally broad and dirty; changes include Prisma schema, new backend modules, new frontend pages/components/services, and docs.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Browser-audit the implemented surfaces next | Core backend and frontend pieces already exist; current risk is integration/UX behavior. |
| Keep compatibility `files` projections while adding `assets` | Existing share flows and frontend code expect file-like data. |
| Log browser observations after every two view actions | Visual state is easy to lose during a long implementation session. |
| Treat public share's initial unauthenticated `403 share_token_required` as existing token-negotiation behavior | The page recovers by requesting a share token and renders content; this is a polish concern if zero console noise is required. |
| Backend guard owns quiet token issuance for open shares | Frontend cannot safely infer httpOnly share-token cookie state; backend can issue the token only when there is no password and no max-view flow to preserve. |
| Middleware must avoid importing app services | Importing `config.service` pulled axios into the Edge Runtime bundle; a local parser keeps middleware Edge-safe. |
| Use `/account/assets` as the first `AssetActionMenu` integration point | The root plan asks for a unified asset operation center; account assets are the safest first surface because assets are standalone and already owner-scoped. |
| Introduce Inbox as a compatibility entry before changing submission semantics | Existing ReverseShare upload completion still creates shares directly. A low-risk first step is a new Inbox API/page over the same data, then later replace guest upload completion with pending `InboxSubmission` records. |
| Decrement Inbox remaining uses when a pending submission is created | This preserves the existing ReverseShare “use” semantics at the moment a visitor completes a submission instead of waiting for owner review. |
| Keep pending submission file upload for a follow-up slice | The listed root API routes can handle TEXT/LINK submissions now; file chunk uploads need an additional submission-asset upload path so `/inbox/:token` can stop creating shares for guest file uploads without breaking legacy `/upload/:token`. |
| Extend `AssetActionMenu` with contextual callbacks instead of calling standalone asset routes everywhere | Share edit and clipboard message assets are container-owned, so download/delete must use their share or clipboard APIs while the menu stays visually unified. |
| Keep public share asset rows purpose-built for now | Public share rows need share-token, password, recipient, and text-file copy behavior that is different from owner/editor/message asset rows. |

## Requirement Audit
| Requirement | Evidence | Status |
|-------------|----------|--------|
| Asset replaces File and supports multiple types | Prisma has `AssetType` FILE/TEXT/LINK, `Asset` relations to owner/share/clipboard, old `File` table absent after replay; backend asset/share tests pass. | Implemented |
| Online clipboard supports private clipboard and rooms | Clipboard schema/service/controller support PRIVATE/ROOM, passcode hashing/token verification, TEXT/LINK/FILE assets, room public page and private dashboard browser smokes pass. | Implemented |
| Short-link system supports Redis/cache and detailed stats | `AppCacheModule` supports memory + Redis via `@keyv/redis`; `ShortLinkService` uses target/visit cache keys, visit logs, IP HMAC, by-day/referer/user-agent/recent stats; UI create/visit/stats smoke passes. | Implemented |
| Frontend supports rich new workflows | `/account/assets`, `/clipboard`, `/clipboard/rooms/:roomId`, `/account/short-links`, `/l/:code`, public share, and share edit were audited; desktop and 390px overflow checks pass. | Implemented, with polish notes |
| `plan.md` section 1 asset action endpoints | `AssetController` now exposes update, clone, create-share, create-short-link, and send-to-room routes backed by existing `AssetService` methods; asset action controller/service tests and backend build pass. | Implemented for backend |
| `plan.md` section 1 unified asset action UI | `/account/assets`, share edit text/link asset rows, clipboard room/private message rows, and Inbox pending submissions render `AssetActionMenu`; contextual rows provide share/clipboard download and delete callbacks without invoking standalone My Assets clone/share/send routes. | Implemented for the planned owner/editor/message surfaces; public share rows remain purpose-built |
| `plan.md` section 2 Inbox primary API | `InboxModule` exposes create/list/public token lookup/delete routes backed by `ReverseShare`; backend Inbox service/controller tests and build pass. | Initial compatibility layer implemented |
| `plan.md` section 2 Inbox visitor route | `/inbox/:token` reuses the upload page through `inboxService.setInbox`, keeps the legacy `reverse_share_token` cookie, and `/inbox/*` is public in middleware. | Initial compatibility layer implemented |
| `plan.md` section 2 pending submission backend | `InboxService` now creates `PENDING` submissions with TEXT/LINK assets, accepts file-backed submissions before chunks arrive, stores file chunks on pending submissions, lists owner submissions, accepts to My assets, accepts as a completed share, and rejects by deleting asset resources; targeted Inbox/Asset tests and backend build pass. | Backend implemented |
| `plan.md` section 2 Inbox visitor pending submission flow | `/inbox/:token` passes `inboxToken` into upload, creates pending submissions through Inbox API, uploads files to `POST /api/inboxes/:token/submissions/:id/files`, and keeps legacy `/upload/:token` on the old share-completion path. | Visitor upload path implemented |
| `plan.md` section 2 Inbox owner review flow | `/account/reverseShares` now loads Inboxes through `inboxService`, lists pending submissions per Inbox, lets owners receive submissions into assets, receive as completed shares, or reject/delete them, and uses `AssetActionMenu` in read-only mode for pending assets. | Owner review path implemented |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Root planning files were absent | Added continuation planning files in project root. |
| Browser console showed `Cannot read properties of undefined (reading 'middleware_src/middleware')` on first protected-route navigation | Investigating as a likely stale Next dev-server / `.next` middleware artifact before changing code. |
| Stale Next middleware error after earlier build | Cleared `frontend/.next` and restarted the frontend dev server on port 3003; the fresh assets page had zero console errors. |
| In-app browser viewport override did not take effect | `viewport.set({ width: 390, height: 844 })` returned without throwing, but pages still reported `innerWidth=1280`; reset the override and used bundled Playwright with system Chrome for isolated mobile verification instead. |
| Public share first-load 403 console noise | Added tests for `ShareSecurityGuard`; open non-view-limited shares now issue an httpOnly share token during first read, while password-protected and max-view shares keep explicit token flow. |
| Middleware Edge Runtime axios warning | Added a static middleware test and removed the `config.service` import from `frontend/src/middleware.ts`; `next build` no longer reports the axios Edge Runtime warning. |
| Asset action controller methods were missing despite service methods existing | Added controller red test first, then exposed `PATCH /assets/:id`, `/clone`, `/share`, `/short-link`, and `/send-to-room`. |
| Prettier can split static-test target expressions | Relaxed the `clipboardService.listRooms` assertion to allow formatter-safe whitespace. |
| `/inbox/:token` was protected by middleware | Added a middleware test and included `/inbox/*` in the public route list. |
| Next dev server 500 after frontend build | The running dev server read production `.next` output; clearing `.next` and restarting the dev server restored `/inbox/not-real-token` to a 200 response. |
| Backend dev was not listening on 8081 after frontend-only Phase 10 verification | Started a `pingvin-share-backend-8081` launchctl job with `BACKEND_PORT=8081` and verified `/api/configs` returned 200. |

## Resources
- `docs/superpowers/plans/2026-06-28-asset-core.md`
- `docs/superpowers/plans/2026-06-28-clipboard-core.md`
- `docs/superpowers/plans/2026-06-28-short-link-core.md`
- `docs/superpowers/specs/2026-06-25-asset-core-design.md`
- `docs/superpowers/specs/2026-06-28-clipboard-core-design.md`
- `docs/superpowers/specs/2026-06-28-short-link-core-design.md`
- `plan.md`

## Visual/Browser Findings
- `/account/assets` initially redirected through `/auth/signIn?redirect=%2Faccount%2Fassets`, then hydrated into the authenticated assets page with title `My assets - Share`.
- The first browser pass reported one Next middleware runtime console error, but the assets page itself eventually rendered labels for File/Text/Link and a Create button.
- After frontend restart, `/account/assets` rendered `My assets`, File/Text/Link radios, a Text input, Create button, and an asset table with File/Text rows plus Download/Delete actions; console errors were zero on the fresh tab.
- `/clipboard` rendered the authenticated clipboard dashboard with Add/Create room controls, File/Text/Link composers, private asset rows, room rows, no horizontal overflow at desktop width, and zero console errors.
- `/clipboard/rooms/ZeeYYP1G` rendered a public passcode gate with a single Passcode input and Unlock room button. Submitting `roompass123` opened room title `Public route smoke`; no desktop overflow or console errors were observed.
- `/account/short-links` rendered create/list/analytics/edit sections, active/disabled rows, stats buckets, and recent visits with zero console errors and no desktop overflow.
- Short-link UI smoke created internal link `uimqwstpus` targeting `/clipboard`; visiting `/l/uimqwstpus` redirected to `/clipboard`, and the short-link dashboard then showed row visits `1` plus total visits/unique visitors/source/UA stats.
- `/share/assetmixmqwpxhqg` rendered public mixed assets for Text and Link rows with no console errors and no desktop overflow.
- `/share/assetmixmqwpxhqg/edit` rendered Add text/link composer, Text and links management table, Delete actions, Save button, and file append control.
- Share edit UI smoke added temporary text asset `Browser delete smoke mqwswoh1`, confirmed it appeared, deleted it through the confirmation modal, and verified the public share no longer contained that text.
- 390px mobile audit with bundled Playwright/system Chrome showed no document-level horizontal overflow for `/account/assets`, `/clipboard`, `/account/short-links`, `/share/assetmixmqwpxhqg`, or `/share/assetmixmqwpxhqg/edit`.
- The unauthenticated public share mobile audit captured one `403` response for `/api/shares/assetmixmqwpxhqg`; this matches the existing share-token negotiation path where the frontend calls `getShareToken()` after `share_token_required`, and the page still rendered the share content.
- After the guard change and backend restart, opening `/share/assetmixmqwpxhqg` at 390px produced no 4xx responses or console errors, rendered `Mixed Asset Smoke`, and kept no horizontal overflow.
