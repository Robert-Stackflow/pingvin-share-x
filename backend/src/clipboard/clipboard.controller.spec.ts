import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ClipboardController } from "./clipboard.controller";

const user = { id: "user-1" };

function createServiceMock() {
  const calls: any[] = [];
  return {
    calls,
    service: {
      getOrCreatePrivate: async (currentUser: any) => {
        calls.push(["getOrCreatePrivate", currentUser]);
        return {
          id: "clipboard-1",
          type: "PRIVATE",
          passcodeHash: "private-should-not-leak",
          assets: [],
        };
      },
      addAsset: async (body: any, currentUser: any) => {
        calls.push(["addAsset", body, currentUser]);
        return { id: "asset-1", type: body.type };
      },
      addFileAsset: async (
        body: string,
        chunk: any,
        file: any,
        currentUser: any,
      ) => {
        calls.push(["addFileAsset", body, chunk, file, currentUser]);
        return { id: file.id ?? "asset-file", type: "FILE", name: file.name };
      },
      addRoomAsset: async (roomId: string, body: any, currentUser: any) => {
        calls.push(["addRoomAsset", roomId, body, currentUser]);
        return {
          id: "asset-room-1",
          type: body.type,
          clipboardId: "room-db-1",
        };
      },
      addRoomFileAsset: async (
        roomId: string,
        body: string,
        chunk: any,
        file: any,
        currentUser: any,
      ) => {
        calls.push([
          "addRoomFileAsset",
          roomId,
          body,
          chunk,
          file,
          currentUser,
        ]);
        return { id: file.id ?? "asset-file", type: "FILE", name: file.name };
      },
      getPrivateAssetDownloadStream: async (
        assetId: string,
        currentUser: any,
      ) => {
        calls.push(["getPrivateAssetDownloadStream", assetId, currentUser]);
        return {
          metaData: {
            id: assetId,
            size: "5",
            mimeType: "text/plain",
            name: "note.txt",
          },
          file: "stream",
        };
      },
      removePrivateAsset: async (assetId: string, currentUser: any) => {
        calls.push(["removePrivateAsset", assetId, currentUser]);
      },
      getRoomAssetDownloadStream: async (
        roomId: string,
        assetId: string,
        token?: string,
      ) => {
        calls.push(["getRoomAssetDownloadStream", roomId, assetId, token]);
        return {
          metaData: {
            id: assetId,
            size: "5",
            mimeType: "text/plain",
            name: "note.txt",
          },
          file: "stream",
        };
      },
      removeRoomAsset: async (
        roomId: string,
        assetId: string,
        currentUser: any,
      ) => {
        calls.push(["removeRoomAsset", roomId, assetId, currentUser]);
      },
      listRoomsByOwner: async (ownerId: string) => {
        calls.push(["listRoomsByOwner", ownerId]);
        return [{ id: "room-db-1", roomId: "room1234", passcodeHash: "hash" }];
      },
      createRoom: async (body: any, currentUser: any) => {
        calls.push(["createRoom", body, currentUser]);
        return {
          id: "room-db-1",
          roomId: "room1234",
          type: "ROOM",
          passcodeHash: "hash",
        };
      },
      updateRoom: async (roomId: string, body: any, currentUser: any) => {
        calls.push(["updateRoom", roomId, body, currentUser]);
        return {
          id: "room-db-1",
          roomId,
          name: body.name,
          type: "ROOM",
          passcodeHash: body.passcode ? "hash" : null,
        };
      },
      removeRoom: async (roomId: string, currentUser: any) => {
        calls.push(["removeRoom", roomId, currentUser]);
      },
      getRoomForRead: async (roomId: string, token?: string) => {
        calls.push(["getRoomForRead", roomId, token]);
        return { id: "room-db-1", roomId, type: "ROOM", passcodeHash: "hash" };
      },
      verifyRoomPasscode: async (roomId: string, passcode: string) => {
        calls.push(["verifyRoomPasscode", roomId, passcode]);
        return "room-token";
      },
    },
  };
}

test("getMine loads the current user's private clipboard", async () => {
  const { calls, service } = createServiceMock();
  const controller = new ClipboardController(service as any);

  const clipboard = await controller.getMine(user as any);

  assert.equal(clipboard.type, "PRIVATE");
  assert.equal(
    Object.prototype.hasOwnProperty.call(clipboard, "passcodeHash"),
    false,
  );
  assert.deepEqual(calls[0], ["getOrCreatePrivate", user]);
});

test("addMineAsset adds an asset to the current user's private clipboard", async () => {
  const { calls, service } = createServiceMock();
  const controller = new ClipboardController(service as any);

  const asset = await controller.addMineAsset(
    {},
    { type: "TEXT", content: "hello" } as any,
    user as any,
  );

  assert.equal((asset as any).type, "TEXT");
  assert.deepEqual(calls[0], [
    "addAsset",
    { type: "TEXT", content: "hello" },
    user,
  ]);
});

test("addMineAsset dispatches FILE query uploads to ClipboardService.addFileAsset", async () => {
  const { calls, service } = createServiceMock();
  const controller = new ClipboardController(service as any);

  const asset = await controller.addMineAsset(
    {
      type: "FILE",
      id: "2c62c90a-b451-46cb-8830-3b3bf938af0b",
      name: "note.txt",
      chunkIndex: "0",
      totalChunks: "1",
    },
    "aGVsbG8=" as any,
    user as any,
  );

  assert.equal((asset as any).type, "FILE");
  assert.deepEqual(calls[0], [
    "addFileAsset",
    "aGVsbG8=",
    { index: 0, total: 1 },
    { id: "2c62c90a-b451-46cb-8830-3b3bf938af0b", name: "note.txt" },
    user,
  ]);
});

test("addRoomAsset adds an asset to an owned room", async () => {
  const { calls, service } = createServiceMock();
  const controller = new ClipboardController(service as any);

  const asset = await controller.addRoomAsset(
    "room1234",
    {},
    { type: "LINK", url: "https://example.com" } as any,
    user as any,
  );

  assert.equal((asset as any).clipboardId, "room-db-1");
  assert.deepEqual(calls[0], [
    "addRoomAsset",
    "room1234",
    { type: "LINK", url: "https://example.com" },
    user,
  ]);
});

test("addRoomAsset dispatches FILE query uploads to ClipboardService.addRoomFileAsset", async () => {
  const { calls, service } = createServiceMock();
  const controller = new ClipboardController(service as any);

  const asset = await controller.addRoomAsset(
    "room1234",
    {
      type: "FILE",
      id: "2c62c90a-b451-46cb-8830-3b3bf938af0b",
      name: "note.txt",
      chunkIndex: "0",
      totalChunks: "1",
    },
    "aGVsbG8=" as any,
    user as any,
  );

  assert.equal((asset as any).type, "FILE");
  assert.deepEqual(calls[0], [
    "addRoomFileAsset",
    "room1234",
    "aGVsbG8=",
    { index: 0, total: 1 },
    { id: "2c62c90a-b451-46cb-8830-3b3bf938af0b", name: "note.txt" },
    user,
  ]);
});

test("download endpoints set file headers and return a streamable file", async () => {
  const { calls, service } = createServiceMock();
  const controller = new ClipboardController(service as any);
  const response = {
    headers: {} as Record<string, string>,
    set(headers: Record<string, string>) {
      this.headers = headers;
    },
  };

  const mine = await controller.downloadMineAsset(
    response as any,
    "asset-file",
    user as any,
  );
  const room = await (controller.downloadRoomAsset as any)(
    response as any,
    "room1234",
    "asset-file",
    { cookies: { clipboard_room_room1234_token: "room-token" } },
  );

  assert.equal((mine as any).constructor.name, "StreamableFile");
  assert.equal((room as any).constructor.name, "StreamableFile");
  assert.deepEqual(response.headers, {
    "Content-Type": "text/plain",
    "Content-Length": "5",
    "Content-Security-Policy": "sandbox",
    "Content-Disposition": 'attachment; filename="note.txt"',
  });
  assert.deepEqual(calls.slice(0, 2), [
    ["getPrivateAssetDownloadStream", "asset-file", user],
    ["getRoomAssetDownloadStream", "room1234", "asset-file", "room-token"],
  ]);
});

test("delete asset endpoints delegate to ClipboardService", async () => {
  const { calls, service } = createServiceMock();
  const controller = new ClipboardController(service as any);

  await (controller.removeMineAsset as any)("asset-text", user as any);
  await (controller.removeRoomAsset as any)(
    "room1234",
    "asset-link",
    user as any,
  );

  assert.deepEqual(calls, [
    ["removePrivateAsset", "asset-text", user],
    ["removeRoomAsset", "room1234", "asset-link", user],
  ]);
});

test("room operations delegate to ClipboardService", async () => {
  const { calls, service } = createServiceMock();
  const controller = new ClipboardController(service as any);
  const response = {
    cookie: (name: string, value: string, options: any) => {
      calls.push(["response.cookie", name, value, options]);
    },
  };

  const rooms = await controller.listRooms(user as any);
  const created = await controller.createRoom(
    { name: "Room", passcode: "secret" },
    user as any,
  );
  const updated = await controller.updateRoom(
    "room1234",
    { name: "Room two", passcode: "secret2" },
    user as any,
  );
  await controller.removeRoom("room1234", user as any);
  const room = await (controller.getRoom as any)("room1234", {
    cookies: {},
  } as any);
  const verified = await (controller.verifyRoom as any)(
    "room1234",
    { passcode: "secret" },
    response as any,
  );

  assert.equal(
    Object.prototype.hasOwnProperty.call(rooms[0], "passcodeHash"),
    false,
  );
  assert.equal((rooms[0] as any).hasPasscode, true);
  assert.equal(
    Object.prototype.hasOwnProperty.call(created, "passcodeHash"),
    false,
  );
  assert.equal((created as any).hasPasscode, true);
  assert.equal(
    Object.prototype.hasOwnProperty.call(updated, "passcodeHash"),
    false,
  );
  assert.equal((updated as any).hasPasscode, true);
  assert.equal((updated as any).name, "Room two");
  assert.equal(
    Object.prototype.hasOwnProperty.call(room, "passcodeHash"),
    false,
  );
  assert.equal((room as any).hasPasscode, true);
  assert.deepEqual(verified, { valid: true, token: "room-token" });
  assert.deepEqual(calls, [
    ["listRoomsByOwner", "user-1"],
    ["createRoom", { name: "Room", passcode: "secret" }, user],
    ["updateRoom", "room1234", { name: "Room two", passcode: "secret2" }, user],
    ["removeRoom", "room1234", user],
    ["getRoomForRead", "room1234", undefined],
    ["verifyRoomPasscode", "room1234", "secret"],
    [
      "response.cookie",
      "clipboard_room_room1234_token",
      "room-token",
      { path: "/", httpOnly: true },
    ],
  ]);
});
