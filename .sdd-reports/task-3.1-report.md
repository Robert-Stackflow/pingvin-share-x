# Task 3.1 — Backend accept AccessPolicy on create/update

**Status:** DONE

## Summary
Added an opt-in `accessControl` write path. An `AccessPolicy` row is written **only** when
the client explicitly sends an `accessControl` object. When absent, behavior is byte-for-byte
identical to today (all legacy `ShareSecurity` / `passcodeHash` / `expiration` writes untouched).

## Changed files
- `backend/src/accessPolicy/dto/accessControl.dto.ts` (new) — `AccessControlDTO`, all fields optional.
- `backend/src/accessPolicy/accessPolicy.service.ts` — added `upsertForRelation(relation, input)` + private `resolvePasswordHash` / `resolveExpiresAt` helpers.
- `backend/src/accessPolicy/accessPolicy.module.ts` — already had `exports: [AccessPolicyService]` (no change needed).
- `backend/src/shortLink/shortLink.service.ts` — `create` + `updateOwned` upsert when `accessControl` present; new optional `accessPolicyService` ctor param.
- `backend/src/shortLink/shortLink.module.ts` — import `AccessPolicyModule`.
- `backend/src/shortLink/dto/createShortLink.dto.ts`, `updateShortLink.dto.ts` — nested `accessControl?`.
- `backend/src/clipboard/clipboard.service.ts` — `createRoom` + `updateRoom` upsert (legacy `passcodeHash` kept as-is); new optional `accessPolicyService` ctor param (5th).
- `backend/src/clipboard/clipboard.module.ts` — import `AccessPolicyModule`.
- `backend/src/clipboard/dto/createClipboardRoom.dto.ts`, `updateClipboardRoom.dto.ts` — nested `accessControl?`.
- `backend/src/share/share.service.ts` — `create` upserts after share creation (legacy `security`/`expiration` untouched); destructured `accessControl` out of `shareData` so it is not passed to `prisma.share.create`. `AccessPolicyService` already injected.
- `backend/src/share/dto/createShare.dto.ts` — nested `accessControl?`.
- `backend/src/inbox/inbox.service.ts` — `create` looks up the reverseShare by token after creation and upserts `{ reverseShareId }`; new optional `accessPolicyService` ctor param.
- `backend/src/inbox/inbox.module.ts` — import `AccessPolicyModule`.
- `backend/src/reverseShare/dto/createReverseShare.dto.ts` — nested `accessControl?` (ignored by `ReverseShareService.create`, which maps explicit fields only).

### Test files
- `backend/src/accessPolicy/accessPolicy.service.spec.ts` (extended)
- `backend/src/shortLink/shortLink.service.spec.ts` (extended)
- `backend/src/clipboard/clipboard.service.spec.ts` (extended)
- `backend/src/share/share.service.spec.ts` (extended — added `share.create` to prisma mock + config override)
- `backend/src/inbox/inbox.service.spec.ts` (extended — added `where.token` branch to reverseShare mock)

## upsert contract — `upsertForRelation(relation, input)`
`relation` is exactly one of `{ shareId } | { clipboardId } | { shortLinkId } | { reverseShareId }`.
Finds the existing policy for that relation; updates it if present, else creates one. Returns the row.

- **password**: non-empty string → `passwordHash = await argon.hash(password)`; `""` → `passwordHash = null` (explicit clear); `undefined` → unchanged on update / `null` on create.
- **expiresAt**: ISO string → `new Date(...)`; `null`/`""` → `null` (clear); `undefined` → unchanged on update / `null` on create.
- **maxViews / allowDownload / allowAnonymous / oneTime**: set when provided; else unchanged on update / schema default on create.

## Surfaces wired
ShortLink (`create`, `updateOwned`), Clipboard room (`createRoom`, `updateRoom`), Share (`create`), Inbox (`create`). All four surfaces wired with no concerns.

## Test assertions
- AccessPolicy service: hashed password (verified via `argon.verify`), `""` clears, `undefined` leaves unchanged on update, expiresAt/maxViews/flags set, update-not-duplicate.
- Each surface: (a) no `accessControl` → `upsertForRelation` never called; (b) with `accessControl` → called once with the correct relation id and the forwarded input.

## RED snippet (initial failure on share create tests before config/expiration fix)
```
✖ create does not write an access policy without an accessControl payload
  BadRequestException: share.maxExpirationExceeded
    at ShareService.validateExpiration (.../share.service.ts:573:13)
    at ShareService.create (.../share.service.ts:94:12)
```
Resolved by giving the share create tests a config returning `share.maxExpiration = { value: 0 }`
and a `1-day` relative expiration. (The `upsertForRelation` service spec passed first try since the
helper was implemented before its tests ran — confirming the contract.)

## GREEN
- New/edited specs: **60 pass, 0 fail**.
- Full suite (`find src -name '*.spec.ts'`): **134 tests, 134 pass, 0 fail** (120 prior + 14 new).
- `npm run build`: exit **0**.

## Notes / concerns
- The two share `create` tests exercise the real `fs.mkdirSync` under `data/uploads/shares/<id>`
  (the production code path). Those dirs are git-ignored; harmless but left on disk after a run.
