type Translate = (id: string) => string;

// Canonical activity action + target-type codes emitted by the backend
// ActivityService.record() calls. Keep in sync with the backend record sites.
export const ACTIVITY_ACTIONS = [
  "asset.create",
  "asset.delete",
  "asset.clone",
  "share.create",
  "share.complete",
  "share.delete",
  "shortLink.create",
  "shortLink.visit",
  "shortLink.delete",
  "inbox.create",
  "inbox.submission",
  "inbox.accept",
  "inbox.reject",
] as const;

export const ACTIVITY_TARGET_TYPES = [
  "asset",
  "share",
  "shortLink",
  "inbox",
  "inboxSubmission",
] as const;

// Translate a known action code; fall back to the raw code for any future
// backend action that does not yet have a translation key.
export const getActivityActionLabel = (t: Translate, code: string) =>
  (ACTIVITY_ACTIONS as readonly string[]).includes(code)
    ? t(`account.activity.action.${code}`)
    : code;

export const getActivityTargetLabel = (t: Translate, code: string) =>
  (ACTIVITY_TARGET_TYPES as readonly string[]).includes(code)
    ? t(`account.activity.target.${code}`)
    : code;

export const buildActivityActionOptions = (t: Translate) =>
  ACTIVITY_ACTIONS.map((value) => ({
    value,
    label: getActivityActionLabel(t, value),
  }));

export const buildActivityTargetOptions = (t: Translate) =>
  ACTIVITY_TARGET_TYPES.map((value) => ({
    value,
    label: getActivityTargetLabel(t, value),
  }));
