const { readFileSync } = require("node:fs");
const { existsSync } = require("node:fs");
const { join } = require("node:path");
const { strict: assert } = require("node:assert");
const { test } = require("node:test");

test("middleware stays Edge-safe by avoiding browser/server service imports", () => {
  const middleware = readFileSync(
    join(__dirname, "middleware.ts"),
    "utf8",
  );

  assert.equal(
    middleware.includes("./services/config.service"),
    false,
    "middleware must not import config.service because it pulls axios into the Edge runtime",
  );
});

test("short links use the /s/:code alias while shares still fall back through /s/:shareId", () => {
  const middleware = readFileSync(join(__dirname, "middleware.ts"), "utf8");
  const shortLinksWorkspace = readFileSync(
    join(__dirname, "components/shortLink/ShortLinksWorkspace.tsx"),
    "utf8",
  );
  const shortLinkDetail = readFileSync(
    join(__dirname, "components/shortLink/ShortLinkDetailPage.tsx"),
    "utf8",
  );
  const shareAlias = readFileSync(
    join(__dirname, "pages/s/[shareId].ts"),
    "utf8",
  );

  assert.match(middleware, /"\/s\/\*"/);
  assert.doesNotMatch(middleware, /"\/l\/\*"/);

  assert.match(shareAlias, /short-links\/\$\{encodeURIComponent\(/);
  assert.match(shareAlias, /\/share\/"\s*\+/);

  assert.equal(existsSync(join(__dirname, "pages/l/[code].tsx")), false);
  assert.doesNotMatch(shortLinksWorkspace, /\/l\//);
  assert.doesNotMatch(shortLinkDetail, /\/l\//);
  assert.match(shortLinksWorkspace, /\/s\//);
  assert.match(shortLinkDetail, /\/s\//);
});

test("inbox visitor links are public like legacy reverse-share upload links", () => {
  const middleware = readFileSync(join(__dirname, "middleware.ts"), "utf8");

  assert.match(middleware, /"\/upload\/\*"/);
  assert.match(middleware, /"\/inbox\/\*"/);
});
