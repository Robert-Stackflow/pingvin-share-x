# Task 5.1 — Backend ActivityController + record() at operation sites

## Status
COMPLETE. All tests green, build exit 0, DI verified.

## Changed files
- `backend/src/activity/activity.service.ts` — extended `ActivityFilters` with `from?: Date`, `to?: Date`, `limit?: number`; rewrote `findMany` to build `where` incrementally (no `createdAt` key unless from/to present), apply `createdAt: { gte, lte }`, and `take: resolveLimit(limit)` (default 100, hard-cap 500, floors/guards non-finite & <=0).
- `backend/src/activity/dto/activityEvent.dto.ts` — NEW. `ActivityEventDTO` exposing `id, actorId, action, targetType, targetId, metadata (parsed JSON | null), userAgent, createdAt`. `ipHash` never referenced. `from(entity)` / `fromList(entities)`; metadata parsed via try/catch (null on failure).
- `backend/src/activity/activity.controller.ts` — NEW. `@Controller("activities")`. `GET /` (`@UseGuards(JwtGuard)`) → `listForUser(user.id, filters)`. `GET /all` (`@UseGuards(JwtGuard, AdministratorGuard)`) → `listAll(filters)`. Both map through `ActivityEventDTO().fromList`. Query parsing: action/targetType passthrough; from/to via `new Date()` ignoring NaN; limit via `parseInt` ignoring NaN. Invalid/absent values omitted from filters object.
- `backend/src/activity/activity.module.ts` — added `controllers: [ActivityController]`.
- `backend/src/activity/activity.controller.spec.ts` — NEW (5 tests).
- `backend/src/activity/activity.service.spec.ts` — added 2 tests (from/to/limit range; 500 cap).
- `backend/src/asset/asset.service.ts` + `asset.module.ts` — inject optional `ActivityService` (6th positional, optional to preserve existing unit tests that construct with 2–5 args); `imports: [ActivityModule]`.
- `backend/src/share/share.service.ts` + `share.module.ts` — inject optional `ActivityService`; `imports: [ActivityModule]`.
- `backend/src/shortLink/shortLink.service.ts` + `shortLink.module.ts` — inject optional `ActivityService` (4th positional, optional for existing 3-arg unit tests); `imports: [ActivityModule]`.
- `backend/src/inbox/inbox.service.ts` + `inbox.module.ts` — inject optional `ActivityService`; `imports: [ActivityModule]`.

## record() sites wired (all best-effort: `void this.activityService?.record({...}).catch(() => undefined)`)
- **AssetService** (targetType `asset`): `createText` & `createLink` & `createFile` → `asset.create` (only when `owner && !container`, i.e. standalone); `removeOwned` → `asset.delete`; `cloneOwned` → `asset.clone` (metadata.clonedFrom).
- **ShareService** (targetType `share`): `create` → `share.create`; `complete` → `share.complete`; `remove` → `share.delete`. actorId from user/`share.creatorId`.
- **ShortLinkService** (targetType `shortLink`): `create` → `shortLink.create`; `recordVisit` → `shortLink.visit` (passes the `ip`/`userAgent` it receives, actorId = link.ownerId); `removeOwned` → `shortLink.delete`.
- **InboxService**: `create` → `inbox.create` (targetType `inbox`, targetId=token); `createSubmission` → `inbox.submission` (targetType `inboxSubmission`, actorId null — anonymous); `acceptSubmission` → `inbox.accept`; `rejectSubmission` → `inbox.reject` (targetType `inboxSubmission`).

## Test assertions (controller spec)
1. `GET /activities` calls `listForUser("user-1", {action, targetType, from:Date, to:Date, limit:25})` with parsed values.
2. `GET /activities` ignores invalid date (`not-a-date`) and non-numeric limit → empty filters `{}`.
3. `GET /activities/all` calls `listAll({action})`.
4. DTO never exposes `ipHash` (asserts `undefined`); metadata JSON parsed to object; id/userAgent preserved.
5. DTO yields `null` metadata when entity metadata is null.

Service spec additions: createdAt `{gte,lte}` + `take:25`; `limit:99999` clamps `take` to 500. Existing service tests (exact `take:100`, plain `where`) unchanged and still pass.

## RED (before implementation)
```
✖ src/activity/activity.controller.spec.ts (467ms)   // ActivityController did not exist
✖ src/activity/activity.service.spec.ts (804ms)      // TS2353 on from/to/limit not in ActivityFilters
ℹ tests 2  ℹ pass 0  ℹ fail 2
```

## GREEN
- Targeted: `tests 9, pass 9, fail 0`.
- Full suite (`find src -name '*.spec.ts'`): **tests 120, pass 120, fail 0** (113 prior + 7 new).

## Build
`npm run build` (nest build) → EXIT 0.

## DI verification (by inspection + build)
- Modules importing `ActivityModule`: asset, inbox, share, shortLink (+ activity itself). Confirmed via grep.
- Services injecting `ActivityService`: asset, share, shortLink, inbox (+ activity.controller). Confirmed via grep.
- `ActivityModule` has no `imports` array → cannot form a cycle with any consumer. No circular import.
- Successful `nest build` validates compile-time module wiring. Did not start an alt-port Nest instance (dev server already on :8081); DI confirmed by inspection + build.

## Concerns
- `record()` calls are fire-and-forget (`void ... .catch`) — intentional per spec so logging never breaks the user path; they are not awaited, so they won't appear synchronously in request transactions.
- `ActivityService` injected as optional constructor param in Asset/ShortLink services to avoid breaking existing positional-arg unit tests; under real DI it is always provided.
