# Task 3.2 — Frontend reusable AccessControlForm wired into dialogs

## Status
DONE

## Created files
- `frontend/src/types/accessControl.type.ts` — `AccessControl` type, `AccessControlField` type, and `toAccessControlPayload(value)` helper (returns object with only set fields, or `undefined` when nothing set; `expiresAt` normalized to ISO).
- `frontend/src/components/access/AccessControlForm.tsx` — reusable Mantine 8 form. Props `value`, `onChange`, optional `fields?` to hide controls per surface. Renders `PasswordInput` (password), `TextInput type="datetime-local"` (expiresAt — no `@mantine/dates` in repo, confirmed via grep), `NumberInput` (maxViews), and three `Switch`es (allowDownload/allowAnonymous/oneTime). Re-exports `toAccessControlPayload` and `AccessControl` for convenience.

## Changed files
- `frontend/src/types/shortLink.type.ts` — added optional `accessControl?: AccessControl` to `CreateShortLink` and `UpdateShortLink`.
- `frontend/src/types/clipboard.type.ts` — added `accessControl?` to `CreateClipboardRoom` and `UpdateClipboardRoom`.
- `frontend/src/types/inbox.type.ts` — added `accessControl?` to `CreateInbox`.
- `frontend/src/types/share.type.ts` — added `accessControl?` to `CreateShare`.
- `frontend/src/i18n/translations/en-US.ts` and `zh-CN.ts` — added `accessControl.*` keys (title, password, password.placeholder, expiresAt, maxViews, maxViews.placeholder, allowDownload, allowAnonymous, oneTime).
- 4 dialogs wired (below).

Note: service files (`shortLink.service.ts`, `clipboard.service.ts`, `inbox.service.ts`, `share.service.ts`) needed **no body changes** — each `create*` already forwards its typed argument object directly to `api.post(...)`, so extending the create/update types is sufficient to carry `accessControl` to the API body.

## Dialogs wired (ADDITIVE — proof)
All four keep every pre-existing field/payload untouched; only an `accessControl` key was added to the create payload plus the form UI + local state.

1. **Short-link create** — `components/shortLink/ShortLinksWorkspace.tsx`. New `accessControl` state; `shortLinkService.create({...existing fields, accessControl: toAccessControlPayload(accessControl)})`. All fields shown. Existing `targetType/targetUrl/title/code` untouched. State reset on success.
2. **Clipboard room create** — `pages/clipboard/index.tsx`. New `roomAccessControl` state; `createRoom({ name, passcode, accessControl: toAccessControlPayload(roomAccessControl) })`. Existing `passcode` PasswordInput left intact; `AccessControlForm` rendered with `fields` excluding `password`.
3. **Share create** — `components/upload/modals/showCreateUploadModal.tsx`. New `accessControl` state; payload keeps `id/name/expiration/recipients/description/security{...}` exactly and adds `accessControl: toAccessControlPayload(accessControl)`. Legacy password + maxViews inputs preserved; `AccessControlForm` rendered with `password` hidden (fields: expiresAt, allowDownload, allowAnonymous, oneTime) inside the existing security section.
4. **Inbox create** — `components/share/modals/showCreateReverseShareModal.tsx`. New `accessControl` state; `inboxService.create({...all existing fields, accessControl: toAccessControlPayload(accessControl)})`. Existing `maxUseCount`/expiration/switches preserved; `AccessControlForm` rendered with `password` hidden (fields: maxViews, allowDownload, oneTime) in the security section.

## TDD
### Structural test added to `src/ui-layout.spec.js`
Asserts: `components/access/AccessControlForm.tsx` exists; `types/accessControl.type.ts` exists; AccessControlForm references `AccessControl` and `toAccessControlPayload`; each of the 4 dialog files matches `/AccessControlForm/` and `/accessControl/`; en + zh both contain the 7 `accessControl.*` keys.

### RED (before implementation)
```
✖ access control form exists and is wired into the four create dialogs (0.380583ms)
  AssertionError [ERR_ASSERTION]: AccessControlForm.tsx should exist
```

### GREEN (after implementation)
```
ℹ tests 29
ℹ pass 29
ℹ fail 0
```
All 28 prior tests still pass; new test passes.

## tsc
`npx tsc --noEmit --pretty false` → EXIT 0

## build
`npm run build` → EXIT 0 (no compile/type errors). Known-acceptable warnings only.

## Concerns
None blocking. Inbox/share already model some access semantics (publicAccess, expiration, legacy password) via their own fields; the AccessControlForm is purely additive and password was hidden where a legacy/passcode field already exists to avoid duplicate confusing inputs, per task guidance. Backend honors the new `accessControl` object only when present, so legacy behavior is unchanged when the user leaves the new controls empty.
