# Task Plan: Pingvin Share X Asset Platform

## Goal
Finish the Pingvin Share X refactor so Asset replaces File, clipboard rooms/private clipboard work, short links include Redis-aware stats, and the refreshed frontend supports the new workflows without blocking UX defects.

## Current Phase
All root `plan.md` sections (1-5) implemented as of 2026-06-29.

> NOTE: Earlier "Phase 11 pending" pointer was stale — AccessPolicy backend was
> already done in a prior session. Sections 4 (asset search/tags/favorites),
> 5 (activity log), and 3 (AccessPolicy write side + AccessControlForm) were
> completed 2026-06-29 via subagent-driven TDD. Plan:
> `docs/superpowers/plans/2026-06-29-platform-sections-4-5-3.md`.
> Verification: backend 134/134, frontend 32 structural + tsc 0 + build 0,
> final review APPROVE_WITH_MINORS (see progress.md for the 4 deferred minors).
> Remaining: human commit decision + browser smokes; "Later Additions" in plan.md
> (QR, cleanup rules, storage stats, webhooks, API tokens, PWA share target).

## Phases

### Phase 1: Restore Context
- [x] Read existing feature specs and implementation plans.
- [x] Confirm branch, worktree state, and current server assumptions.
- [x] Create persistent planning files for this continuation.
- **Status:** complete

### Phase 2: Browser Audit
- [x] Audit `/account/assets`, `/clipboard`, `/clipboard/rooms/:roomId`, `/account/short-links`, public share, and share edit.
- [x] Check console errors, auth behavior, desktop overflow, and primary actions.
- [x] Record browser findings in `findings.md`.
- [x] Complete mobile breakpoint verification with a working viewport method.
- **Status:** complete

### Phase 3: Targeted Fixes
- [x] For any backend or frontend behavior gap, write a failing test or reproducible red check first.
- [x] Implement the smallest safe fix using existing project patterns.
- [x] Update docs/plans if the feature surface changes.
- **Status:** complete

### Phase 4: Verification
- [x] Run broad backend regression tests.
- [x] Run backend build.
- [x] Run frontend typecheck and build.
- [x] Restart frontend dev server after build if needed.
- [x] Re-run browser/API smokes for affected surfaces.
- **Status:** complete

### Phase 5: Requirement Audit And Handoff
- [x] Audit each original requirement against code, tests, and browser behavior.
- [x] Report remaining gaps honestly.
- [x] Only mark complete if every original requirement is demonstrably handled.
- **Status:** complete

### Phase 6: Polish And Runtime Noise Cleanup
- [x] Remove recoverable public-share 403 noise for open shares without changing password/max-view token flows.
- [x] Remove the middleware Edge Runtime axios warning by keeping middleware imports Edge-safe.
- [x] Verify targeted tests, builds, dev-server restarts, and browser smokes.
- **Status:** complete

### Phase 7: Root Plan Section 1 Asset Actions
- [x] Audit `plan.md` section 1 against current backend/frontend code.
- [x] Add TDD coverage for missing asset action controller endpoints.
- [x] Expose clone, share, short-link, send-to-room, and patch routes through `AssetController`.
- [x] Add frontend service methods for the new asset action routes.
- [x] Add `AssetActionMenu` and `AssetPreviewDialog`.
- [x] Wire `/account/assets` rows through the unified action menu.
- [x] Verify asset action tests, backend build, frontend structural tests, typecheck, and build.
- **Status:** complete

### Phase 8: Root Plan Section 2 Inbox Compatibility Entry
- [x] Audit Inbox requirements against current ReverseShare code.
- [x] Add backend red tests for Inbox controller/service compatibility routes.
- [x] Add `InboxModule`, `InboxController`, and `InboxService` backed by existing `ReverseShare` data.
- [x] Expose initial Inbox API routes: `POST /api/inboxes`, `GET /api/inboxes`, `GET /api/inboxes/:token`, `DELETE /api/inboxes/:id`.
- [x] Add frontend `inbox.service.ts` and `/inbox/:token` visitor route that reuses the current upload flow.
- [x] Keep legacy `/upload/:token` route untouched and make `/inbox/*` public in middleware.
- [x] Verify backend tests/build, frontend middleware/structural tests, typecheck, build, and dev-server route health.
- **Status:** complete

### Phase 9: Root Plan Section 2 Inbox Pending Submissions
- [x] Add backend red tests for pending Inbox submission creation/listing.
- [x] Add backend red tests for owner accept/reject actions.
- [x] Implement `POST /api/inboxes/:token/submissions`, `GET /api/inboxes/:id/submissions`, `POST /api/inbox-submissions/:id/accept`, and `POST /api/inbox-submissions/:id/reject`.
- [x] Preserve legacy `/upload/:token` behavior while giving `/inbox/:token` a path to pending submissions.
- [x] Add file-backed pending submissions through `POST /api/inboxes/:token/submissions/:id/files`.
- [x] Rewire `/inbox/:token` uploads to create pending submissions instead of completed shares.
- [x] Add owner pending submissions UI for listing, accepting, and rejecting submissions.
- [x] Use the primary Inbox service and `/inbox/:token` links from the owner surface while preserving legacy `/upload/:token`.
- [x] Verify targeted Inbox tests and backend build before frontend rollout.
- [x] Verify frontend structural tests, middleware regression, typecheck, and build after visitor upload rollout.
- [x] Verify owner pending submission UI with frontend structural tests, typecheck, build, and dev-server route health.
- **Status:** complete

### Phase 10: Root Plan Section 1 Remaining AssetActionMenu Rollout
- [x] Audit share edit and clipboard room message asset rows for places still using one-off asset buttons.
- [x] Add red frontend structural coverage for `AssetActionMenu` in share edit and room message surfaces.
- [x] Wire owned/appropriate asset rows in share edit and clipboard rooms through `AssetActionMenu`.
- [x] Verify frontend structural tests, typecheck, build, and runtime route health.
- **Status:** complete

### Phase 11: Root Plan Section 3 AccessPolicy Foundation
- [ ] Audit current Share, Clipboard Room, ShortLink, and Inbox access-control fields and tests.
- [ ] Add backend red coverage for the first compatible `AccessPolicy` model/service slice.
- [ ] Implement the smallest schema/service integration that preserves existing password, expiration, view-count, and active-link behavior.
- [ ] Add frontend structural coverage for a reusable access-control form entry point where the first surface is wired.
- [ ] Verify targeted backend tests/build and frontend structural/typecheck/build/runtime health.
- **Status:** pending

## Key Questions
1. Do all new frontend surfaces remain usable after build/restart on the current dev servers?
2. Are public room links accessible while private clipboard remains protected?
3. Do short-link lifecycle and analytics work from UI, not only API?
4. Does Asset FILE storage choose and read/delete the persisted provider correctly?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Continue on `feat/asset-core` without reverting dirty worktree | Existing broad feature work is uncommitted and belongs to the current task. |
| Use browser audit before adding more features | The core slices are implemented; the highest value now is finding blocking UX/API gaps. |
| Preserve TDD for behavior changes | The project already added tests around asset, clipboard, share, and short-link behavior. |
| Use bundled Playwright + system Chrome for mobile fallback | The in-app browser viewport capability did not alter `innerWidth`, and the fallback avoids adding project dependencies. |
| Treat remaining public-share 403 console noise as polish, not a blocker | It is the existing share-token negotiation path and the page renders after recovery. |
| Auto-issue share tokens in the backend guard only for open non-view-limited shares | This removes avoidable 403 console noise without incorrectly incrementing max-view shares outside the established user-facing token flow. |
| Keep middleware config parsing local and Edge-safe | Importing `config.service` pulled axios into the Edge runtime and generated build warnings. |
| Start root `plan.md` continuation with asset action routes/menu | Asset service methods already existed, but section 1 still lacked controller exposure and a unified frontend action entry point. |
| Implement Inbox as a compatibility layer first | `ReverseShare` still owns existing upload completion behavior, so the first safe Inbox step is a new primary API/page that preserves the legacy cookie and `/upload/:token` flow. |
| Implement Inbox pending submission backend before frontend upload rewiring | The `InboxSubmission` schema already exists, so backend status transitions and owner checks can be verified before changing the visitor upload flow. |
| Keep public share download rows purpose-built while rolling out contextual `AssetActionMenu` elsewhere | Public shares have password, share-token, recipient, and text-file copy behavior that is distinct from owner/editor/message asset rows. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| No root planning files existed | 1 | Created `task_plan.md`, `findings.md`, and `progress.md` for this continuation. |
| Browser viewport override ineffective | 1 | Logged mobile verification gap; reset viewport. |
| Prisma migrate deploy empty schema-engine error | 2 | Verified schema/manual replay, then obtained a successful Prisma deploy replay with Rust engine logging on a fresh DB. |
| Public share first-load 403 console noise | 1 | Added ShareSecurityGuard tests and auto-issued a token for open non-view-limited shares. |
| Middleware Edge Runtime axios warning | 1 | Added static middleware test and replaced `config.service` import with local config value parsing. |
| Direct `container.kind` access failed strict TS compilation on `AssetContainer` | 1 | Added `getContainerKind()` and used it before comparing custom container kinds. |
| Mantine `Select` lacked a `loading` prop | 1 | Used disabled state and loading placeholder text instead. |
| `/inbox/:token` initially redirected to sign-in | 1 | Added `/inbox/*` to the middleware public route list with a red middleware test. |
| Next dev returned 500 after production build wrote `.next` output | 1 | Restarted frontend dev server on port 3003 after clearing `.next`. |
| Backend restart listened on default 8080 | 1 | Restarted the launchctl job with `BACKEND_PORT=8081` and verified `/api/configs` on 8081. |

## Notes
- Treat previous summary as context, but verify current local state before claiming anything.
- The original user request remains broader than a single slice; do not mark complete without a requirement-by-requirement audit.
- Section 1 is complete for the planned owner/editor/message surfaces: `/account/assets`, share edit text/link asset rows, clipboard room/private messages, and Inbox pending submissions now use the unified menu. Public share download rows remain purpose-built for share-token behavior.
- Section 2 is implemented through pending submission visitor and owner review flows; keep legacy `/upload/:token` regression coverage while future phases evolve access policy and activity logging.
