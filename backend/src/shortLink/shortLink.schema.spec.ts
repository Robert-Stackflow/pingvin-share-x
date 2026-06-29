import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

test("short link schema stores links and detailed visit logs", () => {
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const migration = readFileSync(
    join(
      process.cwd(),
      "prisma/migrations/20260628000000_asset_core/migration.sql",
    ),
    "utf8",
  );

  assert.match(schema, /enum ShortLinkTargetType/);
  assert.match(schema, /model ShortLink\s*{/);
  assert.match(schema, /model ShortLinkVisit\s*{/);
  assert.match(schema, /shortLinks\s+ShortLink\[\]/);
  assert.match(migration, /CREATE TABLE "ShortLink"/);
  assert.match(migration, /CREATE TABLE "ShortLinkVisit"/);
});
