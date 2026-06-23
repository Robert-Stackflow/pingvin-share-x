/**
 * File auto-rename rules.
 *
 * Rules are stored as a JSON array of objects:
 *
 *   [{ "pattern": "*.apk", "replacement": "*.apk.1", "type": "glob" }, ...]
 *
 * For each rule:
 *   - type "glob": `*` in the pattern matches any sequence of characters and the
 *     captured parts are filled into the `*` placeholders of the replacement, in
 *     order. Matching is case-sensitive. e.g. `*.apk` -> `*.apk.1`
 *   - type "regex": `pattern` is a JavaScript regular expression source and the
 *     replacement uses `$1`, `$2`, ... backreferences. An optional `flags`
 *     field (e.g. "i") can be supplied. e.g. `^(.+)\.apk$` -> `$1.apk.1`
 *
 * The first matching rule wins; the file is renamed once and matching stops,
 * which prevents an already-renamed file (e.g. `a.apk.1`) from being renamed
 * again. If no rule matches, the original name is returned unchanged.
 */

export interface RenameRule {
  pattern: string;
  replacement: string;
  type: "glob" | "regex";
  flags?: string;
}

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Parse the stored JSON value into a list of valid rename rules. */
export function parseRenameRules(rulesJson: string): RenameRule[] {
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
}

/** Apply a single rule to a name, returning the renamed name or null if no match. */
function applyRule(rule: RenameRule, name: string): string | null {
  if (rule.type === "regex") {
    let regex: RegExp;
    try {
      regex = new RegExp(rule.pattern, rule.flags ?? "");
    } catch {
      return null; // ignore invalid regex
    }
    return regex.test(name) ? name.replace(regex, rule.replacement) : null;
  }

  // glob
  const globRegex = new RegExp(
    "^" + rule.pattern.split("*").map(escapeRegExp).join("(.*)") + "$",
  );
  const match = name.match(globRegex);
  if (!match) return null;

  const captures = match.slice(1);
  let captureIndex = 0;
  return rule.replacement.replace(/\*/g, () => captures[captureIndex++] ?? "");
}

/**
 * Apply the first matching rename rule to a file name.
 *
 * @param fileName  the original file name
 * @param rulesJson the stored JSON rules array (string)
 * @returns the renamed file name, or the original name if no rule matches
 */
export function applyRenameRules(fileName: string, rulesJson: string): string {
  if (!fileName) return fileName;

  for (const rule of parseRenameRules(rulesJson)) {
    const renamed = applyRule(rule, fileName);
    if (renamed !== null && renamed !== fileName) return renamed;
  }

  return fileName;
}
