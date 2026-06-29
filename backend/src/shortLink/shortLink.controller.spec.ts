import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ShortLinkController } from "./shortLink.controller";

const user = { id: "user-1" };

function createServiceMock() {
  const calls: any[] = [];
  return {
    calls,
    service: {
      create: async (body: any, currentUser: any) => {
        calls.push(["create", body, currentUser]);
        return { id: "short-link-1", code: "abc123", targetUrl: body.targetUrl };
      },
      listByOwner: async (ownerId: string) => {
        calls.push(["listByOwner", ownerId]);
        return [{ id: "short-link-1", code: "abc123" }];
      },
      recordVisit: async (code: string, visit: any) => {
        calls.push(["recordVisit", code, visit]);
        return "https://example.com/docs";
      },
      getStats: async (code: string, ownerId: string) => {
        calls.push(["getStats", code, ownerId]);
        return { code, totalVisits: 2 };
      },
      updateOwned: async (code: string, body: any, ownerId: string) => {
        calls.push(["updateOwned", code, body, ownerId]);
        return { id: "short-link-1", code, ...body };
      },
      removeOwned: async (code: string, ownerId: string) => {
        calls.push(["removeOwned", code, ownerId]);
      },
    },
  };
}

test("authenticated operations delegate to ShortLinkService", async () => {
  const { calls, service } = createServiceMock();
  const controller = new ShortLinkController(service as any);

  const link = await controller.create(
    { targetType: "URL", targetUrl: "https://example.com/docs" } as any,
    user as any,
  );
  const links = await controller.list(user as any);
  const stats = await controller.stats("abc123", user as any);
  const updated = await controller.update(
    "abc123",
    { title: "Docs", isActive: false } as any,
    user as any,
  );
  await controller.remove("abc123", user as any);

  assert.equal(link.code, "abc123");
  assert.equal(links.length, 1);
  assert.equal(stats.totalVisits, 2);
  assert.equal(updated.isActive, false);
  assert.deepEqual(calls, [
    [
      "create",
      { targetType: "URL", targetUrl: "https://example.com/docs" },
      user,
    ],
    ["listByOwner", "user-1"],
    ["getStats", "abc123", "user-1"],
    ["updateOwned", "abc123", { title: "Docs", isActive: false }, "user-1"],
    ["removeOwned", "abc123", "user-1"],
  ]);
});

test("visit records analytics and redirects to the resolved target", async () => {
  const { calls, service } = createServiceMock();
  const controller = new ShortLinkController(service as any);
  const response = {
    redirect: (status: number, url: string) => {
      calls.push(["redirect", status, url]);
    },
  };
  const request = {
    ip: "203.0.113.2",
    headers: {
      "x-forwarded-for": "198.51.100.9, 203.0.113.2",
      "user-agent": "Test Browser",
      referer: "https://ref.example",
    },
  };

  await controller.visit("abc123", request as any, response as any);

  assert.deepEqual(calls, [
    [
      "recordVisit",
      "abc123",
      {
        ip: "198.51.100.9",
        userAgent: "Test Browser",
        referer: "https://ref.example",
      },
    ],
    ["redirect", 302, "https://example.com/docs"],
  ]);
});
