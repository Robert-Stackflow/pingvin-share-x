import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

test("clipboard schema allows each owner to create multiple rooms", () => {
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const migration = readFileSync(
    join(
      process.cwd(),
      "prisma/migrations/20260628000000_asset_core/migration.sql",
    ),
    "utf8",
  );

  assert.doesNotMatch(schema, /@@unique\(\[ownerId,\s*type\]\)/);
  assert.doesNotMatch(migration, /Clipboard_ownerId_type_key/);
});
