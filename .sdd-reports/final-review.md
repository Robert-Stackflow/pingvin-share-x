# Final Code Review — Asset Core (Sec 3/4/5)

**Verdict: APPROVE_WITH_MINORS**

The implementation is correct on every point the brief asked me to specifically verify: `ipHash` is never exposed, the admin activity route is truly server-gated, asset filters are owner-scoped, AccessPolicy passwords are argon-hashed, the golden rule holds on all 4 backend surfaces, every `record()` call is fire-and-forget, route ordering is correct, and the frontend is purely additive. No Critical findings. No Important findings that block. A small set of Minor items below.

---

## Critical findings
None.

## Important findings
None that block. The closest candidate is the `getOwned` scoping gap below; it is included under Minor because it is not reachable as a cross-user access path given how inbox-submission assets are created.

---

## Verification of the required checks

### 1. Security
- **`ActivityEventDTO` never exposes `ipHash`** — CONFIRMED. `backend/src/activity/dto/activityEvent.dto.ts` has no `ipHash` property and `from()` constructs the output object field-by-field (no spread of the entity) with `plainToClass(..., { excludeExtraneousValues: true })`. `ipHash` cannot leak even if the entity carries it. Frontend `ActivityEvent` type (`frontend/src/types/activity.type.ts`) likewise omits it.
- **Admin route truly admin-gated** — CONFIRMED. `backend/src/activity/activity.controller.ts:30` uses `@UseGuards(JwtGuard, AdministratorGuard)`, identical to config/user/system/share admin routes. Even with the `JwtGuard` fallback to `allowUnauthenticatedShares` (`backend/src/auth/guard/jwt.guard.ts`), no `user` is attached on that path, so `AdministratorGuard.canActivate` returns `false` (`backend/src/auth/guard/isAdmin.guard.ts:8`, `if (!user) return false`). Safe.
- **Owner-scoping on `GET /assets`** — CONFIRMED. `listByOwner` (`backend/src/asset/asset.service.ts:194`) hard-codes `ownerId` in the `where` and ANDs every filter on top (Prisma ANDs top-level fields with `OR`). No filter (`q`/`type`/`source`/`favorite`/`tag`) can widen the result set beyond the caller's own assets. `listTags` is scoped by `ownerId` too (`asset.service.ts:228`). The controller always passes `user.id` from the JWT, never a client value.
- **Passwords argon-hashed, never stored plain** — CONFIRMED. `accessPolicy.service.ts` `resolvePasswordHash` returns `argon.hash(password)` (`upsertForRelation`), with `undefined` = leave unchanged and `""` = clear. No plaintext path.

### 2. Golden rule integrity
CONFIRMED on all four surfaces — AccessPolicy is upserted **only** when `accessControl` is truthy, and legacy writes are untouched:
- Share: `backend/src/share/share.service.ts:137` `if (share.accessControl)`; legacy `security`/`expiration`/`recipients` writes precede it and are unchanged. `accessControl` is destructured out of `shareData` (`share.service.ts:106`) so it never pollutes the `share.create` payload.
- ShortLink create `shortLink.service.ts:95` and update `shortLink.service.ts:230` — both guarded; legacy `isActive`/`targetUrl`/`title` writes untouched.
- Clipboard room create `clipboard.service.ts:69` and update `clipboard.service.ts:105` — both guarded; legacy `passcodeHash`/`name` writes untouched.
- Inbox `inbox.service.ts:59` — guarded; reverse-share creation happens first via `reverseShareService.create`, unchanged.

### 3. Best-effort `record()`
CONFIRMED non-throwing everywhere. Every call site wraps in `void this.activityService?.record(...).catch(() => undefined)`:
- `asset.service.ts:84` (recordActivity), `share.service.ts:62`, `shortLink.service.ts:70`, `inbox.service.ts:52`.
- The `void` + `.catch()` makes the promise rejection-safe and unawaited; it cannot reject into the request path, does not alter return values, and adds no `await`. The optional-chaining (`activityService?`) also makes it a no-op if the service is absent.

### 4. Route ordering
CONFIRMED. `@Get("tags")` (`asset.controller.ts:128`) is declared before `@Get(":id")` (`asset.controller.ts:133`), so `/assets/tags` resolves to `listTags`, not `get(":id")`.

### 5. Frontend additive
CONFIRMED. `toAccessControlPayload` (`frontend/src/types/accessControl.type.ts`) returns `undefined` when no field is meaningfully set (empty password trimmed out, empty expiresAt trimmed out, `maxViews <= 0` dropped, booleans only included if actually boolean), and returns `undefined` if the resulting payload has no keys. All four dialogs spread it alongside their full original payloads:
- `showCreateUploadModal.tsx:323` (keeps `security`, `expiration`, `recipients`, `description`).
- `showCreateReverseShareModal.tsx:146` (keeps `shareExpiration`, `maxShareSize`, `maxUseCount`, `sendEmailNotification`, `simplified`, `publicAccess`).
- `ShortLinksWorkspace.tsx:88` (keeps `targetType`, `targetUrl`, `title`, `code`).
- `clipboard/index.tsx:198`.

### 6. Integration / N+1 / Prisma correctness
- `listByOwner` `orderBy` uses a fixed whitelist map (`ASSET_SORT_ORDER_BY`) keyed by validated sort options; controller validates `sort`/`type`/`source` against enums before forwarding. No injection of arbitrary order/where keys.
- SQLite `contains` (no `mode: "insensitive"`) is correctly noted as case-insensitive for ASCII; acceptable.
- `replaceTags` (`asset.service.ts`) does a `deleteMany` then per-tag `upsert` in `Promise.all` then `createMany` — bounded by the number of tags on one asset, not a meaningful N+1.
- Modules all wired: `AccessPolicyModule`, `ActivityModule`, `AssetModule` registered in `app.module.ts`; `AccessPolicyModule` imported by share/shortLink/inbox/clipboard modules; `ActivityModule` imported where `record()` is used.

---

## Minor

1. **`getOwned` omits `inboxSubmissionId: null`** — `backend/src/asset/asset.service.ts:217` scopes by `{ id, ownerId, shareId: null, clipboardId: null }` but does not exclude `inboxSubmissionId`, whereas `listByOwner` excludes all three. Not exploitable: inbox-submission assets are created with `owner = undefined` (`inbox.service.ts` `createSubmissionAsset`), so `ownerId` is null and never matches a real user id. Still worth aligning for defense-in-depth and consistency — add `inboxSubmissionId: null` to the `getOwned` where.

2. **`allowDownload` / `allowAnonymous` switches default to visually "off"** — `AccessControlForm.tsx` renders these as `checked={value.x ?? false}`. Unset (omitted from payload) renders as an unchecked switch, but server semantics treat unset as "allowed" and only `allowAnonymous === false` blocks. The behavior is correct (untouched = omitted = legacy), but the UI implies "off/blocked" before the user touches it. Consider a tri-state or helper text.

3. **`accessPolicyService` optionality is inconsistent** — required (non-optional) in `ShareService` but optional (`?`) in shortLink/inbox/clipboard services. All four import `AccessPolicyModule`, so DI resolves regardless; this is cosmetic.

4. **`record()` IP/userAgent never populated** — none of the `recordActivity` wrappers pass `ip`/`userAgent`, so `ipHash` is always null in practice. Fine for this scope (and safe), just noting the column is currently unused.
