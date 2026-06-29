import { ForbiddenException } from "@nestjs/common";
import * as argon from "argon2";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { AccessPolicyService } from "./accessPolicy.service";

function createPrismaMock(policy: any = {}) {
  const calls: any[] = [];
  return {
    calls,
    prisma: {
      accessPolicy: {
        update: async (args: any) => {
          calls.push(["accessPolicy.update", args]);
          return {
            ...policy,
            id: args.where.id,
            views: (policy.views ?? 0) + (args.data.views?.increment ?? 0),
          };
        },
      },
    },
  };
}

function createUpsertPrismaMock(records: any[] = []) {
  const policies = [...records];
  const calls: any[] = [];
  return {
    calls,
    policies,
    prisma: {
      accessPolicy: {
        findFirst: async (args: any) => {
          calls.push(["accessPolicy.findFirst", args]);
          return (
            policies.find((policy) =>
              Object.entries(args.where).every(
                ([key, value]) => policy[key] === value,
              ),
            ) ?? null
          );
        },
        create: async (args: any) => {
          calls.push(["accessPolicy.create", args]);
          const policy = {
            id: `policy-${policies.length + 1}`,
            views: 0,
            allowDownload: true,
            allowAnonymous: true,
            oneTime: false,
            passwordHash: null,
            expiresAt: null,
            maxViews: null,
            ...args.data,
          };
          policies.push(policy);
          return policy;
        },
        update: async (args: any) => {
          calls.push(["accessPolicy.update", args]);
          const policy = policies.find((item) => item.id === args.where.id);
          if (!policy) return null;
          Object.assign(policy, args.data);
          return policy;
        },
      },
    },
  };
}

const jwtService = {
  sign: (payload: any, options: any) =>
    JSON.stringify({ payload, secret: options.secret, expiresIn: options.expiresIn }),
  verify: (token: string, options: any) => {
    const parsed = JSON.parse(token);
    if (parsed.secret !== options.secret) throw new Error("bad secret");
    return parsed.payload;
  },
};

const config = {
  get: (key: string) => (key === "internal.jwtSecret" ? "test-secret" : null),
};

test("assertAllowed rejects expired, exhausted, anonymous, and download-denied policies", () => {
  const { prisma } = createPrismaMock();
  const service = new AccessPolicyService(prisma as any, jwtService as any, config as any);

  assert.throws(
    () =>
      service.assertAllowed({
        expiresAt: new Date("2026-01-01T00:00:00.000Z"),
      } as any, { now: new Date("2026-01-02T00:00:00.000Z") }),
    ForbiddenException,
  );
  assert.throws(
    () => service.assertAllowed({ maxViews: 2, views: 2 } as any),
    ForbiddenException,
  );
  assert.throws(
    () => service.assertAllowed({ allowAnonymous: false } as any, { userId: null }),
    ForbiddenException,
  );
  assert.throws(
    () => service.assertAllowed({ allowDownload: false } as any, { requireDownload: true }),
    ForbiddenException,
  );
});

test("recordView increments policy views and one-time policies are exhausted after one view", async () => {
  const { calls, prisma } = createPrismaMock({ views: 0 });
  const service = new AccessPolicyService(prisma as any, jwtService as any, config as any);

  await service.recordView({ id: "policy-1", oneTime: true } as any);

  assert.deepEqual(calls, [
    [
      "accessPolicy.update",
      { where: { id: "policy-1" }, data: { views: { increment: 1 } } },
    ],
  ]);
  assert.throws(
    () => service.assertAllowed({ oneTime: true, views: 1 } as any),
    ForbiddenException,
  );
});

test("upsertForRelation creates a policy with a hashed password, expiry, and flags", async () => {
  const { calls, policies, prisma } = createUpsertPrismaMock();
  const service = new AccessPolicyService(prisma as any, jwtService as any, config as any);

  const policy = await service.upsertForRelation(
    { shortLinkId: "short-1" },
    {
      password: "secret123",
      expiresAt: "2026-12-31T00:00:00.000Z",
      maxViews: 5,
      allowDownload: false,
      allowAnonymous: false,
      oneTime: true,
    },
  );

  assert.equal(policies.length, 1);
  assert.equal(policy.shortLinkId, "short-1");
  assert.ok(policy.passwordHash);
  assert.notEqual(policy.passwordHash, "secret123");
  assert.equal(await argon.verify(policy.passwordHash!, "secret123"), true);
  assert.deepEqual(policy.expiresAt, new Date("2026-12-31T00:00:00.000Z"));
  assert.equal(policy.maxViews, 5);
  assert.equal(policy.allowDownload, false);
  assert.equal(policy.allowAnonymous, false);
  assert.equal(policy.oneTime, true);
  assert.equal(calls[0][0], "accessPolicy.findFirst");
  assert.equal(calls[1][0], "accessPolicy.create");
});

test("upsertForRelation updates an existing policy rather than duplicating", async () => {
  const existing = {
    id: "policy-existing",
    shareId: "share-1",
    passwordHash: "old-hash",
    expiresAt: null,
    maxViews: null,
    allowDownload: true,
    allowAnonymous: true,
    oneTime: false,
    views: 0,
  };
  const { policies, prisma } = createUpsertPrismaMock([existing]);
  const service = new AccessPolicyService(prisma as any, jwtService as any, config as any);

  const policy = await service.upsertForRelation(
    { shareId: "share-1" },
    { maxViews: 3 },
  );

  assert.equal(policies.length, 1);
  assert.equal(policy.id, "policy-existing");
  assert.equal(policy.maxViews, 3);
  // Password left untouched when password is undefined.
  assert.equal(policy.passwordHash, "old-hash");
});

test("upsertForRelation clears the password when an empty string is sent", async () => {
  const existing = {
    id: "policy-existing",
    shareId: "share-1",
    passwordHash: "old-hash",
    views: 0,
  };
  const { prisma } = createUpsertPrismaMock([existing]);
  const service = new AccessPolicyService(prisma as any, jwtService as any, config as any);

  const policy = await service.upsertForRelation(
    { shareId: "share-1" },
    { password: "" },
  );

  assert.equal(policy.passwordHash, null);
});

test("upsertForRelation leaves the password unchanged when undefined on update", async () => {
  const existing = {
    id: "policy-existing",
    shareId: "share-1",
    passwordHash: "old-hash",
    views: 0,
  };
  const { calls, prisma } = createUpsertPrismaMock([existing]);
  const service = new AccessPolicyService(prisma as any, jwtService as any, config as any);

  await service.upsertForRelation({ shareId: "share-1" }, { maxViews: 2 });

  const updateCall = calls.find(([name]) => name === "accessPolicy.update");
  assert.ok(updateCall);
  assert.equal(
    Object.prototype.hasOwnProperty.call(updateCall[1].data, "passwordHash"),
    false,
  );
});

test("access policy tokens include policy id and update timestamp", () => {
  const { prisma } = createPrismaMock();
  const service = new AccessPolicyService(prisma as any, jwtService as any, config as any);
  const updatedAt = new Date("2026-06-28T00:00:00.000Z");

  const token = service.signPolicyToken({ id: "policy-1", updatedAt } as any);
  const claims = service.verifyPolicyToken(token);

  assert.equal(claims.accessPolicyId, "policy-1");
  assert.equal(claims.accessPolicyUpdatedAt, Math.floor(updatedAt.getTime() / 1000));
});
