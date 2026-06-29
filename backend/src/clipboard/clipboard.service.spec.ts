import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ClipboardService } from "./clipboard.service";

function createPrismaMock(
  records: { assets?: any[]; clipboards?: any[] } = {},
) {
  const assets = records.assets ?? [];
  const clipboards = records.clipboards ?? [];
  const calls: any[] = [];

  return {
    calls,
    prisma: {
      asset: {
        findFirst: async (args: any) => {
          calls.push(["asset.findFirst", args]);
          return (
            assets.find((asset) =>
              Object.entries(args.where).every(([key, value]) => {
                return asset[key] === value;
              }),
            ) ?? null
          );
        },
      },
      clipboard: {
        findFirst: async (args: any) => {
          calls.push(["clipboard.findFirst", args]);
          return (
            clipboards.find((clipboard) =>
              Object.entries(args.where).every(([key, value]) => {
                return clipboard[key] === value;
              }),
            ) ?? null
          );
        },
        findMany: async (args: any) => {
          calls.push(["clipboard.findMany", args]);
          return clipboards.filter((clipboard) =>
            Object.entries(args.where).every(([key, value]) => {
              return clipboard[key] === value;
            }),
          );
        },
        create: async (args: any) => {
          calls.push(["clipboard.create", args]);
          const clipboard = {
            id: `clipboard-${clipboards.length + 1}`,
            createdAt: new Date("2026-06-28T00:00:00.000Z"),
            updatedAt: new Date("2026-06-28T00:00:00.000Z"),
            ownerId: args.data.owner?.connect?.id ?? null,
            assets: [],
            ...args.data,
          };
          clipboards.push(clipboard);
          return clipboard;
        },
        update: async (args: any) => {
          calls.push(["clipboard.update", args]);
          const clipboard = clipboards.find(
            (item) => item.roomId === args.where.roomId,
          );
          if (!clipboard) return null;
          Object.assign(clipboard, args.data);
          return clipboard;
        },
        delete: async (args: any) => {
          calls.push(["clipboard.delete", args]);
          const index = clipboards.findIndex(
            (item) => item.roomId === args.where.roomId,
          );
          if (index === -1) return null;
          return clipboards.splice(index, 1)[0];
        },
      },
    },
  };
}

function createAssetServiceMock() {
  const calls: any[] = [];
  return {
    calls,
    service: {
      createText: async (data: any, owner: any, clipboard: any) => {
        calls.push(["createText", data, owner, clipboard]);
        return {
          id: "asset-text",
          type: "TEXT",
          content: data.content,
          ownerId: owner.id,
          clipboardId: clipboard.id,
        };
      },
      createLink: async (data: any, owner: any, clipboard: any) => {
        calls.push(["createLink", data, owner, clipboard]);
        return {
          id: "asset-link",
          type: "LINK",
          url: data.url,
          ownerId: owner.id,
          clipboardId: clipboard.id,
        };
      },
      createFile: async (
        data: string,
        chunk: any,
        file: any,
        owner: any,
        clipboard: any,
      ) => {
        calls.push(["createFile", data, chunk, file, owner, clipboard]);
        return {
          id: file.id ?? "asset-file",
          type: "FILE",
          name: file.name,
          ownerId: owner.id,
          clipboardId: clipboard.id,
        };
      },
      getDownloadStream: async (asset: any) => {
        calls.push(["getDownloadStream", asset]);
        return {
          metaData: {
            id: asset.id,
            size: asset.size,
            createdAt: asset.createdAt,
            mimeType: asset.mimeType,
            name: asset.name,
          },
          file: "stream",
        };
      },
      remove: async (asset: any) => {
        calls.push(["remove", asset]);
      },
    },
  };
}

function createTokenDeps() {
  let signedPayload: any;
  const jwtService = {
    sign: (payload: any, options: any) => {
      signedPayload = { payload, options };
      return "room-token";
    },
    verify: (token: string) => {
      if (token !== "room-token") throw new Error("Invalid token");
      return signedPayload.payload;
    },
  };
  const configService = {
    get: (key: string) => (key === "internal.jwtSecret" ? "test-secret" : null),
  };
  return { jwtService, configService };
}

function createAccessPolicyMock() {
  const calls: any[] = [];
  return {
    calls,
    service: {
      upsertForRelation: async (relation: any, input: any) => {
        calls.push(["upsertForRelation", relation, input]);
        return { id: "policy-1", ...relation, ...input };
      },
    },
  };
}

const user = { id: "user-1" };

test("createRoom does not write an access policy without an accessControl payload", async () => {
  const { prisma } = createPrismaMock();
  const { service: assetService } = createAssetServiceMock();
  const { calls: policyCalls, service: accessPolicyService } =
    createAccessPolicyMock();
  const clipboardService = new ClipboardService(
    prisma as any,
    assetService as any,
    undefined,
    undefined,
    accessPolicyService as any,
  );

  await clipboardService.createRoom({ name: "Team room" }, user as any);

  assert.equal(policyCalls.length, 0);
});

test("createRoom upserts an access policy for the room when accessControl is sent", async () => {
  const { prisma } = createPrismaMock();
  const { service: assetService } = createAssetServiceMock();
  const { calls: policyCalls, service: accessPolicyService } =
    createAccessPolicyMock();
  const clipboardService = new ClipboardService(
    prisma as any,
    assetService as any,
    undefined,
    undefined,
    accessPolicyService as any,
  );

  const room = await clipboardService.createRoom(
    { name: "Team room", accessControl: { maxViews: 10, oneTime: true } },
    user as any,
  );

  assert.equal(policyCalls.length, 1);
  assert.deepEqual(policyCalls[0], [
    "upsertForRelation",
    { clipboardId: room.id },
    { maxViews: 10, oneTime: true },
  ]);
});

test("updateRoom upserts an access policy for the room when accessControl is sent", async () => {
  const existingRoom = {
    id: "room-db-1",
    type: "ROOM",
    roomId: "room1234",
    ownerId: "user-1",
    name: "Old room",
    passcodeHash: null,
    assets: [],
  };
  const { prisma } = createPrismaMock({ clipboards: [existingRoom] });
  const { service: assetService } = createAssetServiceMock();
  const { calls: policyCalls, service: accessPolicyService } =
    createAccessPolicyMock();
  const clipboardService = new ClipboardService(
    prisma as any,
    assetService as any,
    undefined,
    undefined,
    accessPolicyService as any,
  );

  await clipboardService.updateRoom(
    "room1234",
    { accessControl: { allowDownload: false } },
    user as any,
  );

  assert.equal(policyCalls.length, 1);
  assert.deepEqual(policyCalls[0], [
    "upsertForRelation",
    { clipboardId: "room-db-1" },
    { allowDownload: false },
  ]);
});

test("getOrCreatePrivate creates a private clipboard when missing", async () => {
  const { calls, prisma } = createPrismaMock();
  const { service: assetService } = createAssetServiceMock();
  const clipboardService = new ClipboardService(
    prisma as any,
    assetService as any,
  );

  const clipboard = await clipboardService.getOrCreatePrivate(user as any);

  assert.equal(clipboard.type, "PRIVATE");
  assert.equal(clipboard.ownerId, "user-1");
  assert.deepEqual(calls[1], [
    "clipboard.create",
    {
      data: {
        type: "PRIVATE",
        owner: { connect: { id: "user-1" } },
      },
      include: { assets: true },
    },
  ]);
});

test("getOrCreatePrivate returns the existing private clipboard", async () => {
  const existing = {
    id: "clipboard-1",
    type: "PRIVATE",
    ownerId: "user-1",
    assets: [],
  };
  const { calls, prisma } = createPrismaMock({ clipboards: [existing] });
  const { service: assetService } = createAssetServiceMock();
  const clipboardService = new ClipboardService(
    prisma as any,
    assetService as any,
  );

  const clipboard = await clipboardService.getOrCreatePrivate(user as any);

  assert.equal(clipboard.id, "clipboard-1");
  assert.equal(calls.filter(([name]) => name === "clipboard.create").length, 0);
});

test("createRoom creates a room with a generated room id and hashed passcode", async () => {
  const { prisma } = createPrismaMock();
  const { service: assetService } = createAssetServiceMock();
  const clipboardService = new ClipboardService(
    prisma as any,
    assetService as any,
  );

  const room = await clipboardService.createRoom(
    { name: "Team room", passcode: "secret123" },
    user as any,
  );

  assert.equal(room.type, "ROOM");
  assert.equal(room.name, "Team room");
  assert.match(room.roomId, /^[a-zA-Z0-9_-]{8}$/);
  assert.notEqual(room.passcodeHash, "secret123");
});

test("updateRoom changes an owned room name and passcode", async () => {
  const room = {
    id: "room-db-1",
    type: "ROOM",
    roomId: "room1234",
    ownerId: "user-1",
    name: "Old room",
    passcodeHash: null,
    assets: [],
  };
  const { calls, prisma } = createPrismaMock({ clipboards: [room] });
  const { service: assetService } = createAssetServiceMock();
  const clipboardService = new ClipboardService(
    prisma as any,
    assetService as any,
  );

  const updated = await clipboardService.updateRoom(
    "room1234",
    { name: "New room", passcode: "secret123" },
    user as any,
  );

  assert.equal(updated.name, "New room");
  assert.notEqual(updated.passcodeHash, "secret123");
  assert.deepEqual(calls[1][0], "clipboard.update");
  assert.deepEqual(calls[1][1].where, { roomId: "room1234" });
  assert.equal(calls[1][1].include.assets, true);
});

test("verifyRoomPasscode accepts the correct passcode and rejects the wrong one", async () => {
  const { prisma } = createPrismaMock();
  const { service: assetService } = createAssetServiceMock();
  const { jwtService, configService } = createTokenDeps();
  const clipboardService = new ClipboardService(
    prisma as any,
    assetService as any,
    jwtService as any,
    configService as any,
  );
  const room = await clipboardService.createRoom(
    { name: "Team room", passcode: "secret123" },
    user as any,
  );

  assert.equal(
    await clipboardService.verifyRoomPasscode(room.roomId, "secret123"),
    "room-token",
  );
  await assert.rejects(
    () => clipboardService.verifyRoomPasscode(room.roomId, "wrong"),
    ForbiddenException,
  );
});

test("getRoomForRead requires a valid token for passcode-protected rooms", async () => {
  const { prisma } = createPrismaMock();
  const { service: assetService } = createAssetServiceMock();
  const { jwtService, configService } = createTokenDeps();
  const clipboardService = new ClipboardService(
    prisma as any,
    assetService as any,
    jwtService as any,
    configService as any,
  );
  const room = await clipboardService.createRoom(
    { name: "Team room", passcode: "secret123" },
    user as any,
  );

  await assert.rejects(
    () => clipboardService.getRoomForRead(room.roomId),
    ForbiddenException,
  );

  const token = await clipboardService.verifyRoomPasscode(
    room.roomId,
    "secret123",
  );
  const readableRoom = await clipboardService.getRoomForRead(
    room.roomId,
    token,
  );

  assert.equal(readableRoom.roomId, room.roomId);
  assert.equal(readableRoom.hasPasscode, true);
  assert.equal(
    Object.prototype.hasOwnProperty.call(readableRoom, "passcodeHash"),
    false,
  );
});

test("addTextAsset attaches new text assets to the private clipboard", async () => {
  const { prisma } = createPrismaMock();
  const { calls, service: assetService } = createAssetServiceMock();
  const clipboardService = new ClipboardService(
    prisma as any,
    assetService as any,
  );

  const asset = await clipboardService.addTextAsset(
    { content: "clipboard text" },
    user as any,
  );

  assert.equal((asset as any).clipboardId, "clipboard-1");
  assert.equal(calls[0][0], "createText");
  assert.equal(calls[0][3].type, "PRIVATE");
});

test("addFileAsset attaches completed file uploads to the private clipboard", async () => {
  const { prisma } = createPrismaMock();
  const { calls, service: assetService } = createAssetServiceMock();
  const clipboardService = new ClipboardService(
    prisma as any,
    assetService as any,
  );

  const asset = await clipboardService.addFileAsset(
    "aGVsbG8=",
    { index: 0, total: 1 },
    { id: "2c62c90a-b451-46cb-8830-3b3bf938af0b", name: "note.txt" },
    user as any,
  );

  assert.equal((asset as any).clipboardId, "clipboard-1");
  assert.deepEqual(calls[0], [
    "createFile",
    "aGVsbG8=",
    { index: 0, total: 1 },
    { id: "2c62c90a-b451-46cb-8830-3b3bf938af0b", name: "note.txt" },
    user,
    {
      id: "clipboard-1",
      createdAt: new Date("2026-06-28T00:00:00.000Z"),
      updatedAt: new Date("2026-06-28T00:00:00.000Z"),
      ownerId: "user-1",
      assets: [],
      type: "PRIVATE",
      owner: { connect: { id: "user-1" } },
    },
  ]);
});

test("addRoomAsset attaches new assets to rooms owned by the current user", async () => {
  const room = {
    id: "room-db-1",
    type: "ROOM",
    roomId: "room1234",
    ownerId: "user-1",
    assets: [],
  };
  const { prisma } = createPrismaMock({ clipboards: [room] });
  const { calls, service: assetService } = createAssetServiceMock();
  const clipboardService = new ClipboardService(
    prisma as any,
    assetService as any,
  );

  const asset = await clipboardService.addRoomAsset(
    "room1234",
    { type: "LINK", url: "https://example.com" },
    user as any,
  );

  assert.equal((asset as any).clipboardId, "room-db-1");
  assert.deepEqual(calls[0], [
    "createLink",
    { url: "https://example.com" },
    user,
    room,
  ]);
});

test("addRoomFileAsset attaches file uploads to rooms owned by the current user", async () => {
  const room = {
    id: "room-db-1",
    type: "ROOM",
    roomId: "room1234",
    ownerId: "user-1",
    assets: [],
  };
  const { prisma } = createPrismaMock({ clipboards: [room] });
  const { calls, service: assetService } = createAssetServiceMock();
  const clipboardService = new ClipboardService(
    prisma as any,
    assetService as any,
  );

  const asset = await clipboardService.addRoomFileAsset(
    "room1234",
    "aGVsbG8=",
    { index: 0, total: 1 },
    { id: "2c62c90a-b451-46cb-8830-3b3bf938af0b", name: "note.txt" },
    user as any,
  );

  assert.equal((asset as any).clipboardId, "room-db-1");
  assert.deepEqual(calls[0], [
    "createFile",
    "aGVsbG8=",
    { index: 0, total: 1 },
    { id: "2c62c90a-b451-46cb-8830-3b3bf938af0b", name: "note.txt" },
    user,
    room,
  ]);
});

test("getPrivateAssetDownloadStream returns owned private clipboard files only", async () => {
  const asset = {
    id: "asset-file",
    type: "FILE",
    ownerId: "user-1",
    clipboardId: "clipboard-1",
    shareId: null,
    name: "note.txt",
    size: "5",
    mimeType: "text/plain",
    createdAt: new Date("2026-06-28T00:00:00.000Z"),
  };
  const privateClipboard = {
    id: "clipboard-1",
    type: "PRIVATE",
    ownerId: "user-1",
    assets: [],
  };
  const { calls: prismaCalls, prisma } = createPrismaMock({
    assets: [asset],
    clipboards: [privateClipboard],
  });
  const { calls: assetCalls, service: assetService } = createAssetServiceMock();
  const clipboardService = new ClipboardService(
    prisma as any,
    assetService as any,
  );

  const result = await clipboardService.getPrivateAssetDownloadStream(
    "asset-file",
    user as any,
  );

  assert.equal(result.metaData.name, "note.txt");
  assert.deepEqual(prismaCalls[0], [
    "asset.findFirst",
    {
      where: {
        id: "asset-file",
        ownerId: "user-1",
        type: "FILE",
        shareId: null,
      },
    },
  ]);
  assert.deepEqual(prismaCalls[1], [
    "clipboard.findFirst",
    {
      where: {
        id: "clipboard-1",
        ownerId: "user-1",
        type: "PRIVATE",
      },
    },
  ]);
  assert.equal(assetCalls[0][0], "getDownloadStream");
});

test("getRoomAssetDownloadStream requires room access and matching file membership", async () => {
  const room = {
    id: "room-db-1",
    type: "ROOM",
    roomId: "room1234",
    ownerId: "user-1",
    assets: [],
  };
  const asset = {
    id: "asset-file",
    type: "FILE",
    ownerId: "user-1",
    clipboardId: "room-db-1",
    shareId: null,
    name: "note.txt",
    size: "5",
    mimeType: "text/plain",
    createdAt: new Date("2026-06-28T00:00:00.000Z"),
  };
  const { calls: prismaCalls, prisma } = createPrismaMock({
    assets: [asset],
    clipboards: [room],
  });
  const { calls: assetCalls, service: assetService } = createAssetServiceMock();
  const clipboardService = new ClipboardService(
    prisma as any,
    assetService as any,
  );

  const result = await clipboardService.getRoomAssetDownloadStream(
    "room1234",
    "asset-file",
  );

  assert.equal(result.metaData.name, "note.txt");
  assert.deepEqual(prismaCalls[1], [
    "asset.findFirst",
    {
      where: {
        id: "asset-file",
        type: "FILE",
        clipboardId: "room-db-1",
        shareId: null,
      },
    },
  ]);
  assert.equal(assetCalls[0][0], "getDownloadStream");
});

test("removePrivateAsset removes assets from the current user's private clipboard", async () => {
  const asset = {
    id: "asset-text",
    type: "TEXT",
    ownerId: "user-1",
    clipboardId: "clipboard-1",
    shareId: null,
  };
  const privateClipboard = {
    id: "clipboard-1",
    type: "PRIVATE",
    ownerId: "user-1",
    assets: [],
  };
  const { calls: prismaCalls, prisma } = createPrismaMock({
    assets: [asset],
    clipboards: [privateClipboard],
  });
  const { calls: assetCalls, service: assetService } = createAssetServiceMock();
  const clipboardService = new ClipboardService(
    prisma as any,
    assetService as any,
  );

  await clipboardService.removePrivateAsset("asset-text", user as any);

  assert.deepEqual(prismaCalls[0], [
    "asset.findFirst",
    {
      where: {
        id: "asset-text",
        ownerId: "user-1",
        shareId: null,
      },
    },
  ]);
  assert.deepEqual(prismaCalls[1], [
    "clipboard.findFirst",
    {
      where: {
        id: "clipboard-1",
        ownerId: "user-1",
        type: "PRIVATE",
      },
    },
  ]);
  assert.deepEqual(assetCalls[0], ["remove", asset]);
});

test("removePrivateAsset rejects assets outside the private clipboard", async () => {
  const asset = {
    id: "asset-text",
    type: "TEXT",
    ownerId: "user-1",
    clipboardId: "room-db-1",
    shareId: null,
  };
  const roomClipboard = {
    id: "room-db-1",
    type: "ROOM",
    ownerId: "user-1",
    assets: [],
  };
  const { prisma } = createPrismaMock({
    assets: [asset],
    clipboards: [roomClipboard],
  });
  const { service: assetService } = createAssetServiceMock();
  const clipboardService = new ClipboardService(
    prisma as any,
    assetService as any,
  );

  await assert.rejects(
    () => clipboardService.removePrivateAsset("asset-text", user as any),
    NotFoundException,
  );
});

test("removeRoomAsset removes matching assets from rooms owned by the current user", async () => {
  const room = {
    id: "room-db-1",
    type: "ROOM",
    roomId: "room1234",
    ownerId: "user-1",
    assets: [],
  };
  const asset = {
    id: "asset-link",
    type: "LINK",
    ownerId: "user-1",
    clipboardId: "room-db-1",
    shareId: null,
  };
  const { calls: prismaCalls, prisma } = createPrismaMock({
    assets: [asset],
    clipboards: [room],
  });
  const { calls: assetCalls, service: assetService } = createAssetServiceMock();
  const clipboardService = new ClipboardService(
    prisma as any,
    assetService as any,
  );

  await clipboardService.removeRoomAsset("room1234", "asset-link", user as any);

  assert.deepEqual(prismaCalls[0], [
    "clipboard.findFirst",
    {
      where: { roomId: "room1234", ownerId: "user-1", type: "ROOM" },
      include: { assets: true },
    },
  ]);
  assert.deepEqual(prismaCalls[1], [
    "asset.findFirst",
    {
      where: {
        id: "asset-link",
        clipboardId: "room-db-1",
        shareId: null,
      },
    },
  ]);
  assert.deepEqual(assetCalls[0], ["remove", asset]);
});

test("removeRoom deletes an owned room and removes its assets", async () => {
  const room = {
    id: "room-db-1",
    type: "ROOM",
    roomId: "room1234",
    ownerId: "user-1",
    assets: [
      {
        id: "asset-text",
        type: "TEXT",
        ownerId: "user-1",
        clipboardId: "room-db-1",
        shareId: null,
      },
      {
        id: "asset-file",
        type: "FILE",
        ownerId: "user-1",
        clipboardId: "room-db-1",
        shareId: null,
        storage: "LOCAL",
      },
    ],
  };
  const { calls: prismaCalls, prisma } = createPrismaMock({
    clipboards: [room],
  });
  const { calls: assetCalls, service: assetService } = createAssetServiceMock();
  const clipboardService = new ClipboardService(
    prisma as any,
    assetService as any,
  );

  await clipboardService.removeRoom("room1234", user as any);

  assert.deepEqual(prismaCalls[0], [
    "clipboard.findFirst",
    {
      where: { roomId: "room1234", ownerId: "user-1", type: "ROOM" },
      include: { assets: true },
    },
  ]);
  assert.deepEqual(assetCalls, [
    ["remove", room.assets[0]],
    ["remove", room.assets[1]],
  ]);
  assert.deepEqual(prismaCalls[1], [
    "clipboard.delete",
    { where: { roomId: "room1234" } },
  ]);
});

test("addLinkAsset rejects invalid empty URLs through AssetService errors", async () => {
  const { prisma } = createPrismaMock();
  const { service: assetService } = createAssetServiceMock();
  assetService.createLink = async () => {
    throw new BadRequestException("Link asset URL is invalid");
  };
  const clipboardService = new ClipboardService(
    prisma as any,
    assetService as any,
  );

  await assert.rejects(
    () => clipboardService.addLinkAsset({ url: "" }, user as any),
    BadRequestException,
  );
});
