# Task 4.1 — Backend asset list filters + tags endpoint

## Status: DONE

## Files changed
- `backend/src/asset/asset.service.ts` — extended `listByOwner(ownerId, filters?)` with q/type/source/favorite/tag filters + sort mapping; always enforces standalone scope (`shareId/clipboardId/inboxSubmissionId: null`) and includes `tagAssignments.tag`. Added `listTags(ownerId)`.
- `backend/src/asset/asset.controller.ts` — `GET /assets` now reads/coerces/validates query params; added `GET /assets/tags` declared BEFORE `@Get(":id")`.
- `backend/src/asset/asset.service.spec.ts` — added filter/sort/listTags tests; updated existing `listByOwner` test for new where shape + include; added `groupBy` and `assetTag.findMany` to the Prisma mock.
- `backend/src/asset/asset.controller.spec.ts` — added `listByOwner` filters capture + `listTags` to the service mock; updated `list` call signature; added coercion/validation/tags tests.

## What each new test asserts
Service:
- `listByOwner` default: where includes all three null scopes + `include: { tagAssignments: { include: { tag: true } } }`, orderBy createdAt desc.
- q filter builds `OR` over name/content/url with `contains`.
- type/source/favorite filters map to flat where keys.
- tag filter maps to `tagAssignments: { some: { tag: { name } } }`.
- sort: each of the 4 options + undefined maps to the correct `orderBy`.
- `listTags`: calls `assetTag.findMany` with `_count.assignments` include, orderBy name asc; returns counts.

Controller:
- `list` passes coerced filters object; `favorite=true`→true, `favorite=false`→false.
- invalid `type`/`source`/`sort` values are dropped (treated as unset).
- `listTags` delegates to `assetService.listTags(user.id)`.

## RED output snippet
```
src/asset/asset.service.spec.ts(188,39): error TS2554: Expected 1 arguments, but got 2.
...
src/asset/asset.service.spec.ts(267,30): error TS2339: Property 'listTags' does not exist on type 'AssetService'.
✖ tests 2 / pass 0 / fail 2
```

## GREEN / full suite
- Asset specs: tests 34 / pass 34 / fail 0.
- Full backend suite: tests 113 / pass 113 / fail 0 (105 prior + 8 new).

## Build
`npm run build` (nest build) — EXIT 0.

## Notes
- Case-insensitivity for `q` relies on SQLite `LIKE` being ASCII-case-insensitive by default (Prisma `mode: "insensitive"` is unsupported on SQLite); documented with a comment.
- Enum validation uses `value in AssetType`/`AssetSource` (Prisma client enums are value-keyed objects), confirmed by the "ignores invalid enum" test.
