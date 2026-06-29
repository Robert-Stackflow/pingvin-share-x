# Task 5.2 — Frontend activity pages + nav

## Status
Complete. TDD RED → GREEN, tsc clean, build clean.

## Created files
- `frontend/src/types/activity.type.ts` — `ActivityEvent` (matches backend contract incl. `actorId | null`, `metadata`, `userAgent`, `createdAt`; no `ipHash`) and `ActivityFilters`.
- `frontend/src/services/activity.service.ts` — default-export object with `list(filters?)` → `GET /activities` and `listAll(filters?)` → `GET /activities/all`. Filters passed as axios `params` via a `buildParams` helper that omits empty values (returns `undefined` when no params).
- `frontend/src/pages/account/activity.tsx` — "My activity". Action + targetType `Select` filters (clearable, refetch on change), `Table` with shared `tableClasses.tablePanel`/`table`/`tableRow`. Columns: time (`moment(...).format("LLL")`), action, target (type + id stacked), detail (metadata JSON + userAgent). `CenterLoader` while loading, empty state, `Meta` + `Title`.
- `frontend/src/pages/admin/activity.tsx` — "Activity log" (all users) via `activityService.listAll`. Client guard: `if (!user?.isAdmin) return null;` and effect skips fetch for non-admins (server enforces 403). Adds an Actor column.

## Modified files
- `frontend/src/components/header/ActionAvatar.tsx` — added account item `href="/account/activity"` (`TbHistory`) after the account item, and admin item `href="/admin/activity"` (`TbActivity`) inside the `user!.isAdmin` block.
- `frontend/src/i18n/translations/en-US.ts` + `zh-CN.ts` — added `account.activity.{title,table.{time,action,target,detail},filter.{action,target,all},empty}`, `admin.activity.{title,table.actor}`, `admin.button.activity`. Natural Chinese provided.
- `frontend/src/ui-layout.spec.js` — added the structural test (see below).

## Structural test assertions (`activity log pages and nav surface user and admin events`)
- types: `ActivityEvent`, `ActivityFilters`, `actorId`, `targetType`, and `doesNotMatch ipHash`.
- service: `const list = async`, `const listAll = async`, `api.get("activities"`, `api.get("activities/all"`, `params`.
- account page: `activityService.list`, `<Table`, `<Select`, `CenterLoader`, `tableClasses.tablePanel`, `account.activity.title`.
- admin page: `activityService.listAll`, `isAdmin`, `<Table`, `<Select`, `admin.activity.title`.
- avatar: `/account/activity`, `/admin/activity`.
- en + zh both contain all 11 new keys.

## RED snippet
```
✖ activity log pages and nav surface user and admin events (0.173458ms)
ℹ tests 28
ℹ pass 27
ℹ fail 1
```
(`read("pages/account/activity.tsx")` threw — file did not exist yet.)
A later iteration also caught `activityService.list` not being contiguous because the method call was wrapped after a newline; fixed by keeping `activityService.list({` / `activityService.listAll({` on one line.

## GREEN counts
```
ℹ tests 28
ℹ pass 28
ℹ fail 0
```
(27 pre-existing tests still pass; no existing test weakened.)

## Verification
- `npx tsc --noEmit --pretty false` → exit 0.
- `npm run build` → exit 0. New routes present: `/account/activity` and `/admin/activity`.

## Constraints honored
No commit, no backend changes, no weakened tests. Matches existing Mantine 8 + react-intl + service patterns.
