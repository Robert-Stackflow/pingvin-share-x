import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

test("platform enhancement schema adds access policies, inboxes, tags, and activity events", () => {
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const migration = readFileSync(
    join(
      process.cwd(),
      "prisma/migrations/20260628120000_platform_enhancements/migration.sql",
    ),
    "utf8",
  );

  assert.match(schema, /enum AssetSource/);
  assert.match(schema, /enum InboxSubmissionStatus/);
  assert.match(schema, /model AccessPolicy\s*{/);
  assert.match(schema, /model InboxSubmission\s*{/);
  assert.match(schema, /model ActivityEvent\s*{/);
  assert.match(schema, /model AssetTag\s*{/);
  assert.match(schema, /model AssetTagAssignment\s*{/);

  assert.match(schema, /favorite\s+Boolean\s+@default\(false\)/);
  assert.match(schema, /source\s+AssetSource\s+@default\(UPLOAD\)/);
  assert.match(schema, /lastAccessedAt\s+DateTime\?/);

  assert.match(migration, /CREATE TABLE "AccessPolicy"/);
  assert.match(migration, /CREATE TABLE "InboxSubmission"/);
  assert.match(migration, /CREATE TABLE "ActivityEvent"/);
  assert.match(migration, /CREATE TABLE "AssetTag"/);
  assert.match(migration, /CREATE TABLE "AssetTagAssignment"/);
  assert.match(migration, /ALTER TABLE "Asset" ADD COLUMN "favorite"/);
});
