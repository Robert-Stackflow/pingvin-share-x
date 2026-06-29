# Platform Enhancements — Sections 4, 5, 3 Implementation Plan

> Continuation of root `plan.md`. Backend foundations for AccessPolicy (sec 3),
> Activity (sec 5 service), and Asset tags/favorites write-side (sec 4) already
> exist and are green (105 backend tests pass). This plan finishes the missing
> read/query APIs and all frontend surfaces, in order **4 → 5 → 3**.

**Tech Stack:** NestJS 11, Prisma 6 (SQLite), Next.js 14, Mantine 8, react-intl, Node test runner.

## Global Constraints

- Do NOT commit unless the human asks. Leave verified WIP like prior phases.
- Preserve all 105 existing backend tests; never weaken an existing test to pass.
- Backend tests run with: `node -r ts-node/register -r tsconfig-paths/register --test <spec files>`.
- IP addresses must never be stored raw (existing convention: HMAC hash).
- Frontend: every user-facing string goes through react-intl with keys added to
  BOTH `en-US.ts` and `zh-CN.ts`. Match existing key namespaces.
- Backend dev runs on :8081, frontend on :3003.
- Follow existing patterns: `@GetUser()`, `AuthGuard("jwt")`, owner-scoped queries.

---

## Section 4: Asset Search, Tags, Favorites

### Task 4.1 — Backend: asset list filters + tags endpoint

Files: `backend/src/asset/asset.service.ts`, `backend/src/asset/asset.controller.ts`,
`backend/src/asset/asset.service.spec.ts` (extend).

- Extend `AssetService.listByOwner(ownerId, filters)` to accept optional filters:
  - `q` (case-insensitive substring over `name`, `content`, `url`)
  - `type` (`FILE`|`TEXT`|`LINK`)
  - `source` (`AssetSource` enum value)
  - `favorite` (boolean)
  - `tag` (tag name; filters via `tagAssignments.some.tag.name`)
  - `sort` (`createdAt_desc` default, `createdAt_asc`, `lastAccessedAt_desc`, `name_asc`)
  - Always keep the standalone scope: `shareId: null, clipboardId: null, inboxSubmissionId: null`.
  - Include `tagAssignments: { include: { tag: true } }` so rows carry their tags.
- Add `AssetService.listTags(ownerId)` returning the owner's `AssetTag` rows with an
  assignment count (`_count.assignments`), ordered by name.
- Controller: parse query params on `GET /assets` (coerce `favorite` string→boolean,
  validate `type`/`source`/`sort` against enums, ignore unknown). Add
  `GET /assets/tags` BEFORE the `GET /assets/:id` route so it is not captured by `:id`.
- TDD: add red tests first for: q match, type filter, favorite filter, tag filter,
  sort order, and `listTags` count. Then implement. Run the asset specs + full suite.

Verify: `node -r ts-node/register -r tsconfig-paths/register --test src/asset/asset.service.spec.ts src/asset/asset.controller.spec.ts` then full suite; `npm run build`.

### Task 4.2 — Frontend: My Assets search/filter/sort + inline favorite & tags

Files: `frontend/src/types/asset.type.ts`, `frontend/src/services/asset.service.ts`,
`frontend/src/pages/account/assets.tsx`, `frontend/src/components/asset/AssetActionMenu.tsx`,
`frontend/src/i18n/translations/en-US.ts` + `zh-CN.ts`, `frontend/src/ui-layout.spec.js` (extend).

- Extend `Asset` type with `favorite?: boolean`, `source?: AssetSource`,
  `lastAccessedAt?: string`, `tags?: { id: string; name: string }[]` (mapped from
  `tagAssignments`). Add `AssetSource` type.
- `assetService.list(params?)` passes query params; add `listTags()` and
  `setFavorite(id, favorite)` / tag update via existing `update(id, {tags})`.
- Add a toolbar to `/account/assets`: search `TextInput`, type `Select`, source
  `Select`, favorite toggle, tag `Select` (from `listTags`), sort `Select`. Debounce
  search; refetch on change.
- Add inline favorite star toggle (in `AssetActionMenu` or as an action column control)
  and a "Manage tags" action opening a small `TagsInput`/modal that calls `update`.
- Add a red structural test in `ui-layout.spec.js` requiring the assets toolbar +
  favorite/tag controls before implementing.

Verify: `node --test src/ui-layout.spec.js`; `npx tsc --noEmit --pretty false`; `npm run build`.

---

## Section 5: Activity Log / Audit

### Task 5.1 — Backend: ActivityController + record at operation sites

Files: `backend/src/activity/activity.controller.ts` (new),
`backend/src/activity/activity.module.ts`, `backend/src/activity/dto/*` (new),
record calls in asset/share/shortLink/inbox services, plus tests
`backend/src/activity/activity.controller.spec.ts` (new).

- Add `ActivityController` (JwtGuard):
  - `GET /activities` → `ActivityService.listForUser(user.id, filters)` (current user).
  - `GET /activities/all` → admin-only (`user.isAdmin`, else Forbidden) →
    `ActivityService.listAll(filters)`.
  - Filters from query: `action?`, `targetType?` (extend `ActivityService` filters with
    optional `from`/`to` date range and a sane default limit, e.g. 200).
- Add an `ActivityEventDTO` shaped from the model (id, action, targetType, targetId,
  metadata parsed, actorId, createdAt). Do NOT expose `ipHash`/`userAgent` raw beyond
  what the model stores; include `userAgent` is fine, never expose `ipHash`.
- Wire `ActivityService.record(...)` (best-effort, must not break the main flow — wrap
  so a logging failure never throws into the user path) at: asset create/delete/clone,
  share create/complete/delete, shortLink create/visit/delete, inbox create/submission
  received/accept/reject. Reuse existing IP HMAC helper for `ipHash`.
- TDD: red controller tests for owner listing, admin gating (non-admin 403), and filter
  passthrough. Then implement.

Verify: activity specs + full backend suite; `npm run build`.

### Task 5.2 — Frontend: activity pages + nav

Files: `frontend/src/types/activity.type.ts` (new),
`frontend/src/services/activity.service.ts` (new),
`frontend/src/pages/account/activity.tsx` (new),
`frontend/src/pages/admin/activity.tsx` (new),
nav (`ActionAvatar.tsx` / header menu), i18n both locales, `ui-layout.spec.js` (extend).

- Activity type + service (`list(filters)`, `listAll(filters)`).
- `/account/activity`: filterable table (action, targetType, date range) of the current
  user's events using the shared DataTable styling.
- `/admin/activity`: same table backed by `listAll`, admin-guarded client-side + server
  enforces. Add an "Activity log" entry to the admin/profile menu.
- Add `/account/activity` to nav where other account links live.
- Red structural test requiring both routes + nav entry before implementing.

Verify: `node --test src/ui-layout.spec.js`; `npx tsc --noEmit`; `npm run build`.

---

## Section 3: AccessPolicy Frontend Form

### Task 3.1 — Backend: accept AccessPolicy on create/update (audit first)

Files: share/shortLink/clipboard/inbox create+update DTOs and services as needed; tests.

- AUDIT first: `AccessPolicyService` exists and is read by `ShareSecurityGuard`. Determine
  which create/update endpoints already persist an `AccessPolicy` and which do not.
- Add a shared `AccessControlDTO` (`password?`, `expiresAt?`, `maxViews?`, `allowDownload?`,
  `allowAnonymous?`, `oneTime?`) and a service helper to upsert an `AccessPolicy` for a
  given owner relation. Wire it into the create/update paths that lack it, WITHOUT
  breaking legacy Share `expiration` / `ShareSecurity` behavior (keep both in sync per
  root plan §3).
- TDD: red tests for upsert + each newly-wired endpoint.

Verify: targeted + full backend suite; `npm run build`.

### Task 3.2 — Frontend: reusable AccessControlForm wired into dialogs

Files: `frontend/src/components/access/AccessControlForm.tsx` (new),
share create/edit, short-link create, clipboard room create, inbox create modals;
i18n both locales; `ui-layout.spec.js` (extend).

- Build one `AccessControlForm` (password, expiry, max views, allow download, allow
  anonymous, one-time) emitting an `AccessControl` value object.
- Wire into the create/edit dialogs for share, short link, room, and inbox, replacing or
  augmenting their ad-hoc security inputs while preserving existing submit payloads.
- Red structural test requiring `AccessControlForm` usage in each target dialog first.

Verify: `node --test src/ui-layout.spec.js`; `npx tsc --noEmit`; `npm run build`.

---

## Final

- Whole-branch review across sections 4/5/3.
- Update root `plan.md`, `task_plan.md`, `progress.md`, `findings.md` to reflect reality.
- Browser smoke: assets filters/favorite/tags; activity pages; access-control dialogs.
