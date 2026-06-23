/**
 * File auto-rename rules (frontend mirror of backend/src/file/fileRename.util.ts).
 * Used to preview renamed file names on the upload page; the backend remains the
 * authoritative renamer.
 *
 * Rules are stored as a JSON array of objects:
 *   [{ "pattern": "*.apk", "replacement": "*.apk.1", "type": "glob" }, ...]
 */

export interface RenameRule {
  pattern: string;
  replacement: string;
  type: "glob" | "regex";
  flags?: string;
}

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const parseRenameRules = (rulesJson: string): RenameRule[] => {
  if (!rulesJson) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(rulesJson);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter(
      (rule): rule is RenameRule =>
        !!rule &&
        typeof rule.pattern === "string" &&
        rule.pattern.length > 0 &&
        typeof rule.replacement === "string" &&
        (rule.type === "glob" || rule.type === "regex"),
    )
    .map((rule) => ({
      pattern: rule.pattern,
      replacement: rule.replacement,
      type: rule.type,
      flags: typeof rule.flags === "string" ? rule.flags : undefined,
    }));
};

const applyRule = (rule: RenameRule, name: string): string | null => {
  if (rule.type === "regex") {
    let regex: RegExp;
    try {
      regex = new RegExp(rule.pattern, rule.flags ?? "");
    } catch {
      return null;
    }
    return regex.test(name) ? name.replace(regex, rule.replacement) : null;
  }

  const globRegex = new RegExp(
    "^" + rule.pattern.split("*").map(escapeRegExp).join("(.*)") + "$",
  );
  const match = name.match(globRegex);
  if (!match) return null;

  const captures = match.slice(1);
  let captureIndex = 0;
  return rule.replacement.replace(/\*/g, () => captures[captureIndex++] ?? "");
};

export const applyRenameRules = (
  fileName: string,
  rulesJson: string,
): string => {
  if (!fileName) return fileName;

  for (const rule of parseRenameRules(rulesJson)) {
    const renamed = applyRule(rule, fileName);
    if (renamed !== null && renamed !== fileName) return renamed;
  }

  return fileName;
};

/** Serialize a rules array back to the stored JSON string. */
export const stringifyRenameRules = (rules: RenameRule[]): string =>
  JSON.stringify(
    rules.map((rule) => ({
      pattern: rule.pattern,
      replacement: rule.replacement,
      type: rule.type,
      ...(rule.flags ? { flags: rule.flags } : {}),
    })),
  );
