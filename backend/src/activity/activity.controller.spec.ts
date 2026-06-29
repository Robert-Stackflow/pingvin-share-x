import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ActivityController } from "./activity.controller";

const user = { id: "user-1" };

function createServiceMock() {
  const calls: any[] = [];
  const sampleEntity = {
    id: "event-1",
    actorId: "user-1",
    action: "asset.create",
    targetType: "asset",
    targetId: "asset-1",
    metadata: '{"type":"TEXT"}',
    ipHash: "secret-hash",
    userAgent: "Test Browser",
    createdAt: new Date("2026-06-28T00:00:00.000Z"),
  };

  return {
    calls,
    sampleEntity,
    service: {
      listForUser: async (actorId: string, filters: any) => {
        calls.push(["listForUser", actorId, filters]);
        return [sampleEntity];
      },
      listAll: async (filters: any) => {
        calls.push(["listAll", filters]);
        return [sampleEntity];
      },
    },
  };
}

test("GET /activities scopes to the current user and passes parsed filters", async () => {
  const { calls, service } = createServiceMock();
  const controller = new ActivityController(service as any);

  await controller.list(
    {
      action: "asset.create",
      targetType: "asset",
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-28T00:00:00.000Z",
      limit: "25",
    },
    user as any,
  );

  assert.deepEqual(calls[0], [
    "listForUser",
    "user-1",
    {
      action: "asset.create",
      targetType: "asset",
      from: new Date("2026-06-01T00:00:00.000Z"),
      to: new Date("2026-06-28T00:00:00.000Z"),
      limit: 25,
    },
  ]);
});

test("GET /activities ignores invalid dates and missing filters", async () => {
  const { calls, service } = createServiceMock();
  const controller = new ActivityController(service as any);

  await controller.list({ from: "not-a-date", limit: "abc" }, user as any);

  assert.deepEqual(calls[0], ["listForUser", "user-1", {}]);
});

test("GET /activities/all delegates to listAll with parsed filters", async () => {
  const { calls, service } = createServiceMock();
  const controller = new ActivityController(service as any);

  await controller.listAll({ action: "share.create" });

  assert.deepEqual(calls[0], ["listAll", { action: "share.create" }]);
});

test("activity DTO never exposes ipHash and parses metadata JSON", async () => {
  const { service } = createServiceMock();
  const controller = new ActivityController(service as any);

  const [event] = await controller.list({}, user as any);

  assert.equal((event as any).ipHash, undefined);
  assert.deepEqual(event.metadata, { type: "TEXT" });
  assert.equal(event.id, "event-1");
  assert.equal(event.userAgent, "Test Browser");
});

test("activity DTO yields null metadata when entity metadata is null", async () => {
  const { service, sampleEntity } = createServiceMock();
  sampleEntity.metadata = null as any;
  const controller = new ActivityController(service as any);

  const [event] = await controller.listAll({});

  assert.equal(event.metadata, null);
});
