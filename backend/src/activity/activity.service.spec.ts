import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ActivityService } from "./activity.service";

function createPrismaMock() {
  const events: any[] = [];
  const calls: any[] = [];
  return {
    calls,
    events,
    prisma: {
      activityEvent: {
        create: async (args: any) => {
          calls.push(["activityEvent.create", args]);
          const event = {
            id: `event-${events.length + 1}`,
            createdAt: new Date("2026-06-28T00:00:00.000Z"),
            ...args.data,
          };
          events.push(event);
          return event;
        },
        findMany: async (args: any) => {
          calls.push(["activityEvent.findMany", args]);
          return events.filter((event) => {
            if (args.where?.actorId && event.actorId !== args.where.actorId) return false;
            if (args.where?.targetType && event.targetType !== args.where.targetType) return false;
            if (args.where?.action && event.action !== args.where.action) return false;
            return true;
          });
        },
      },
    },
  };
}

const config = {
  get: (key: string) => (key === "internal.jwtSecret" ? "activity-secret" : null),
};

test("record stores activity metadata as JSON and hashes raw IP addresses", async () => {
  const { events, prisma } = createPrismaMock();
  const service = new ActivityService(prisma as any, config as any);

  const event = await service.record({
    actorId: "user-1",
    action: "asset.created",
    targetType: "asset",
    targetId: "asset-1",
    metadata: { type: "TEXT" },
    ip: "203.0.113.1",
    userAgent: "Test Browser",
  });

  assert.equal(event.actorId, "user-1");
  assert.equal(event.metadata, '{"type":"TEXT"}');
  assert.equal((event as any).ip, undefined);
  assert.equal(typeof event.ipHash, "string");
  assert.notEqual(event.ipHash, "203.0.113.1");
  assert.equal(events.length, 1);
});

test("listForUser scopes activity to actor while listAll supports filters", async () => {
  const { calls, prisma } = createPrismaMock();
  const service = new ActivityService(prisma as any, config as any);

  await service.listForUser("user-1", { targetType: "asset" });
  await service.listAll({ action: "shortLink.visit" });

  assert.deepEqual(calls[0], [
    "activityEvent.findMany",
    {
      where: { actorId: "user-1", targetType: "asset" },
      orderBy: { createdAt: "desc" },
      take: 100,
    },
  ]);
  assert.deepEqual(calls[1], [
    "activityEvent.findMany",
    {
      where: { action: "shortLink.visit" },
      orderBy: { createdAt: "desc" },
      take: 100,
    },
  ]);
});

test("findMany applies createdAt range and a custom limit", async () => {
  const { calls, prisma } = createPrismaMock();
  const service = new ActivityService(prisma as any, config as any);

  await service.listForUser("user-1", {
    from: new Date("2026-06-01T00:00:00.000Z"),
    to: new Date("2026-06-28T00:00:00.000Z"),
    limit: 25,
  });

  assert.deepEqual(calls[0], [
    "activityEvent.findMany",
    {
      where: {
        actorId: "user-1",
        createdAt: {
          gte: new Date("2026-06-01T00:00:00.000Z"),
          lte: new Date("2026-06-28T00:00:00.000Z"),
        },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    },
  ]);
});

test("findMany hard-caps the limit at 500", async () => {
  const { calls, prisma } = createPrismaMock();
  const service = new ActivityService(prisma as any, config as any);

  await service.listAll({ limit: 99999 });

  assert.equal(calls[0][1].take, 500);
});
