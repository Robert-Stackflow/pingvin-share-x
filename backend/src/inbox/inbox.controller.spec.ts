import { strict as assert } from "node:assert";
import { test } from "node:test";
import { InboxController, InboxSubmissionController } from "./inbox.controller";

const user = { id: "user-1" };
const createInbox = {
  shareExpiration: "7-days",
  maxShareSize: "1000",
  maxUseCount: 3,
  sendEmailNotification: false,
  simplified: false,
  publicAccess: true,
};

function createInboxServiceMock() {
  const calls: any[] = [];
  return {
    calls,
    service: {
      create: async (body: any, userId: string) => {
        calls.push(["create", body, userId]);
        return {
          token: "token-1",
          link: "https://share.example/inbox/token-1",
          legacyLink: "https://share.example/upload/token-1",
        };
      },
      listByOwner: async (userId: string) => {
        calls.push(["listByOwner", userId]);
        return [{ id: "inbox-1", token: "token-1", shares: [] }];
      },
      getByToken: async (token: string) => {
        calls.push(["getByToken", token]);
        return { id: "inbox-1", token };
      },
      createSubmission: async (token: string, body: any) => {
        calls.push(["createSubmission", token, body]);
        return {
          id: "submission-1",
          status: "PENDING",
          message: body.message,
          assets: body.assets,
        };
      },
      addSubmissionFile: async (
        token: string,
        id: string,
        body: any,
        chunk: any,
        file: any,
      ) => {
        calls.push(["addSubmissionFile", token, id, body, chunk, file]);
        return { id: file.id ?? "asset-file-1", name: file.name };
      },
      listSubmissions: async (id: string, userId: string) => {
        calls.push(["listSubmissions", id, userId]);
        return [
          {
            id: "submission-1",
            status: "PENDING",
            assets: [],
          },
        ];
      },
      acceptSubmission: async (id: string, currentUser: any, body: any) => {
        calls.push(["acceptSubmission", id, currentUser, body]);
        return {
          id,
          status: "ACCEPTED",
          share: body.createShare ? { id: "share-1" } : undefined,
        };
      },
      rejectSubmission: async (id: string, currentUser: any) => {
        calls.push(["rejectSubmission", id, currentUser]);
        return { id, status: "REJECTED" };
      },
      removeOwned: async (id: string, userId: string) => {
        calls.push(["removeOwned", id, userId]);
      },
    },
  };
}

test("inbox controller exposes authenticated owner operations", async () => {
  const { calls, service } = createInboxServiceMock();
  const controller = new InboxController(service as any);

  const created = await controller.create(createInbox as any, user as any);
  const inboxes = await controller.list(user as any);
  await controller.remove("inbox-1", user as any);

  assert.equal(created.link, "https://share.example/inbox/token-1");
  assert.equal(created.legacyLink, "https://share.example/upload/token-1");
  assert.equal(inboxes.length, 1);
  assert.deepEqual(calls, [
    ["create", createInbox, "user-1"],
    ["listByOwner", "user-1"],
    ["removeOwned", "inbox-1", "user-1"],
  ]);
});

test("inbox controller exposes the public token lookup", async () => {
  const { calls, service } = createInboxServiceMock();
  const controller = new InboxController(service as any);

  const inbox = await controller.getByToken("token-1");

  assert.equal(inbox.id, "inbox-1");
  assert.deepEqual(calls, [["getByToken", "token-1"]]);
});

test("inbox controller exposes pending submission creation and owner listing", async () => {
  const { calls, service } = createInboxServiceMock();
  const controller = new InboxController(service as any);
  const body = {
    message: "Review this",
    assets: [{ type: "TEXT", content: "hello" }],
  };

  const submission = await (controller as any).createSubmission(
    "token-1",
    body,
  );
  const submissions = await (controller as any).listSubmissions(
    "inbox-1",
    user as any,
  );

  assert.equal(submission.status, "PENDING");
  assert.equal(submissions.length, 1);
  assert.deepEqual(calls, [
    ["createSubmission", "token-1", body],
    ["listSubmissions", "inbox-1", "user-1"],
  ]);
});

test("inbox controller exposes public submission file uploads", async () => {
  const { calls, service } = createInboxServiceMock();
  const controller = new InboxController(service as any);

  const file = await (controller as any).addSubmissionFile(
    "token-1",
    "submission-1",
    {
      id: "asset-file-1",
      name: "proposal.pdf",
      chunkIndex: "0",
      totalChunks: "1",
    },
    "chunk-data",
  );

  assert.equal(file.id, "asset-file-1");
  assert.deepEqual(calls, [
    [
      "addSubmissionFile",
      "token-1",
      "submission-1",
      "chunk-data",
      { index: 0, total: 1 },
      { id: "asset-file-1", name: "proposal.pdf" },
    ],
  ]);
});

test("inbox submission controller exposes owner accept and reject actions", async () => {
  const { calls, service } = createInboxServiceMock();
  const controller = new InboxSubmissionController(service as any);

  const accepted = await controller.accept(
    "submission-1",
    { createShare: true },
    user as any,
  );
  const rejected = await controller.reject("submission-2", user as any);

  assert.equal(accepted.status, "ACCEPTED");
  assert.equal((accepted as any).share.id, "share-1");
  assert.equal(rejected.status, "REJECTED");
  assert.deepEqual(calls, [
    ["acceptSubmission", "submission-1", user, { createShare: true }],
    ["rejectSubmission", "submission-2", user],
  ]);
});
