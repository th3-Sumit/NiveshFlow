import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));
const ts = require("typescript");
const { ObjectId } = require("mongodb");
const owner = { id: "65a000000000000000000001", name: "Test User", email: "owner@example.com", phone: "+919876543210", role: "user" };
const admin = { ...owner, id: "65a000000000000000000002", role: "super_admin" };
const requestId = "65a000000000000000000003";
const attachment = { id: "file1", name: "receipt.pdf", size: 12, mimeType: "application/pdf", publicId: "private/file1.pdf", assetId: "secret-asset", resourceType: "raw", format: "pdf" };
const request = { _id: new ObjectId(requestId), userId: new ObjectId(owner.id), type: "query", priority: "not_urgent", subject: "Email change request", description: "Please update my account email address to the new address below.", status: "open", user: owner, attachments: [attachment], createdAt: new Date(), updatedAt: new Date() };

// Execute the actual TypeScript modules with isolated service boundaries, without database or network writes.
function loader(overrides = {}) {
  const cache = new Map();
  const defaults = {
    "server-only": {}, "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect(url) { const error = new Error(url); error.digest = "NEXT_REDIRECT"; throw error; } },
    "app/lib/data.ts": { requireCurrentUser: async () => owner, requireSuperAdmin: async () => admin, getCurrentUser: async () => owner },
    "app/lib/mongodb.ts": { ensureSupportIndexes: async () => {}, ensureAuthIndexes: async () => {}, getDb: async () => { throw new Error("Unexpected database access"); } },
    "app/lib/cloudinary.ts": { SupportAttachmentError: class extends Error {} }, "app/lib/email.ts": {}, "app/lib/session.ts": {},
  };
  const mocks = { ...defaults, ...overrides };
  for (const [key, value] of Object.entries(mocks)) if (value === undefined) delete mocks[key];
  function load(specifier, parent = root) {
    if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
    if (!specifier.startsWith(".") && !specifier.startsWith("@/") && !path.isAbsolute(specifier)) return require(specifier);
    const absolute = specifier.startsWith("@/") ? path.join(root, specifier.slice(2)) : path.resolve(parent, specifier);
    const filename = [absolute, `${absolute}.ts`, `${absolute}.tsx`].find(file => existsSync(file) && /\.[cm]?[jt]sx?$/.test(file));
    if (!filename) throw new Error(`Module not found: ${specifier}`);
    const relative = path.relative(root, filename).replaceAll("\\", "/");
    if (Object.hasOwn(mocks, relative)) return mocks[relative];
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} }; cache.set(filename, loadedModule);
    const source = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function("require", "module", "exports", source)(name => load(name, path.dirname(filename)), loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return name => load(path.join(root, name));
}

function form(values = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ type: "issue", priority: "not_urgent", subject: "A support request", description: "I need help with my account because this particular feature is not working.", ...values })) data.set(key, value);
  return data;
}

test("validates all requested priorities, subject limits, and minimum description words", () => {
  const support = loader()("app/lib/support.ts");
  for (const priority of support.supportPriorities) assert.equal(support.supportRequestSchema.safeParse({ ...Object.fromEntries(form()), priority }).success, true);
  for (const values of [{ subject: "abc" }, { subject: "a".repeat(121) }, { description: "Too short" }, { priority: "high" }]) assert.equal(support.supportRequestSchema.safeParse(Object.fromEntries(form(values))).success, false);
  assert.ok(support.validateSupportFile({ name: "payload.svg", type: "image/svg+xml", size: 10 }));
  assert.ok(support.validateSupportFile({ name: "file.pdf", type: "text/html", size: 10 }));
  assert.ok(support.validateSupportFile({ name: "file.pdf", type: "application/pdf", size: 5 * 1024 * 1024 + 1 }));
});

test("normal users cannot invoke admin mutations or read the admin inbox", async () => {
  const denied = new Error("Forbidden");
  const load = loader({ "app/lib/data.ts": { requireSuperAdmin: async () => { throw denied; } } });
  const actions = load("app/actions/support.ts");
  await assert.rejects(actions.updateSupportRequestAction(form()), error => error === denied);
  await assert.rejects(actions.changeUserEmailAction(form()), error => error === denied);
  await assert.rejects(load("app/lib/support-data.ts").getAdminSupportRequests(), error => error === denied);
});

test("new requests use authenticated identity, never submitted user details", async () => {
  let stored;
  const load = loader({ "app/lib/mongodb.ts": { ensureSupportIndexes: async () => {}, getDb: async () => ({ collection: () => ({ insertOne: async value => { stored = value; } }) }) } });
  const result = await load("app/actions/support.ts").createSupportRequestAction(form({ userId: admin.id, email: "spoof@example.com" }));
  assert.equal(result.status, "success"); assert.ok(result.reference.startsWith("NF-"));
  assert.equal(stored.userId.toString(), owner.id); assert.equal(stored.user.email, owner.email); assert.equal(stored.status, "open");
});

test("invalid requests and excess attachments stop before database access", async () => {
  const actions = loader()("app/actions/support.ts");
  assert.equal((await actions.createSupportRequestAction(form({ description: "Too short" }))).status, "error");
  const data = form();
  for (let i = 0; i < 4; i++) data.append("attachments", new File(["%PDF-test"], `test${i}.pdf`, { type: "application/pdf" }));
  assert.equal((await actions.createSupportRequestAction(data)).status, "error");
});

test("failed request persistence cleans up successfully uploaded attachments", async () => {
  const removed = [];
  const load = loader({
    "app/lib/mongodb.ts": { ensureSupportIndexes: async () => {}, getDb: async () => ({ collection: () => ({ insertOne: async () => { throw new Error("DB unavailable"); } }) }) },
    "app/lib/cloudinary.ts": { SupportAttachmentError: class extends Error {}, uploadSupportAttachment: async () => attachment, removeSupportAttachment: async file => removed.push(file.id) },
  });
  const data = form(); data.append("attachments", new File(["%PDF-test"], "file.pdf", { type: "application/pdf" }));
  assert.equal((await load("app/actions/support.ts").createSupportRequestAction(data)).status, "error");
  assert.deepEqual(removed, [attachment.id]);
});

test("own request history is filtered by owner and excludes private asset identifiers", async () => {
  let filter, limit;
  const cursor = { sort() { return this; }, limit(value) { limit = value; return this; }, toArray: async () => [request] };
  const load = loader({ "app/lib/mongodb.ts": { getDb: async () => ({ collection: () => ({ find: query => { filter = query; return cursor; } }) }) } });
  const result = await load("app/lib/support-data.ts").getMySupportRequests();
  assert.equal(filter.userId.toString(), owner.id); assert.equal(limit, 30);
  assert.deepEqual(result[0].attachments, [{ id: attachment.id, name: attachment.name, size: attachment.size }]);
  assert.equal(JSON.stringify(result).includes("secret-asset"), false);
  assert.equal(JSON.stringify(result).includes("private/file1"), false);
  assert.equal(Object.hasOwn(result[0].user, "role"), false);
});

test("attachment download rejects unsigned sessions without database access", async () => {
  const load = loader({ "app/lib/data.ts": { getCurrentUser: async () => null } });
  const response = await load("app/api/support/[requestId]/attachments/[attachmentId]/route.ts").GET(new Request("http://localhost"), { params: Promise.resolve({ requestId, attachmentId: "file1" }) });
  assert.equal(response.status, 401);
});

test("attachment download cannot read another user's ticket", async () => {
  let filter;
  const load = loader({ "app/lib/mongodb.ts": { getDb: async () => ({ collection: () => ({ findOne: async query => { filter = query; return null; } }) }) } });
  const response = await load("app/api/support/[requestId]/attachments/[attachmentId]/route.ts").GET(new Request("http://localhost"), { params: Promise.resolve({ requestId, attachmentId: "file1" }) });
  assert.equal(response.status, 404); assert.equal(filter.userId.toString(), owner.id);
});

for (const user of [owner, admin]) test(`authorized ${user.role} attachment download is streamed privately`, async () => {
  let filter;
  const load = loader({
    "app/lib/data.ts": { getCurrentUser: async () => user },
    "app/lib/mongodb.ts": { getDb: async () => ({ collection: () => ({ findOne: async query => { filter = query; return request; } }) }) },
    "app/lib/cloudinary.ts": { downloadSupportAttachment: async () => new Response("%PDF-test") },
  });
  const response = await load("app/api/support/[requestId]/attachments/[attachmentId]/route.ts").GET(new Request("http://localhost"), { params: Promise.resolve({ requestId, attachmentId: "file1" }) });
  assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff"); assert.ok(response.headers.get("Content-Disposition").startsWith("attachment;"));
  assert.equal(user.role === "super_admin" ? filter.userId : filter.userId.toString(), user.role === "super_admin" ? undefined : owner.id);
});

test("profile email tampering is rejected before any write", async () => {
  const actions = loader()("app/actions/auth.ts");
  await assert.rejects(actions.updateProfileAction(form({ name: "Updated Name", phone: owner.phone, email: "changed@example.com" })), error => error.digest === "NEXT_REDIRECT" && decodeURIComponent(error.message).includes("Help Center"));
});

test("legitimate profile updates never include an email mutation", async () => {
  let update;
  const load = loader({ "app/lib/mongodb.ts": { ensureAuthIndexes: async () => {}, getDb: async () => ({ collection: () => ({ findOne: async () => null, updateOne: async (_filter, value) => { update = value; } }) }) } });
  await assert.rejects(load("app/actions/auth.ts").updateProfileAction(form({ name: "Updated Name", phone: owner.phone })), error => error.message === "/profile?updated=1");
  assert.equal(update.$set.name, "Updated Name"); assert.equal(Object.hasOwn(update.$set, "email"), false);
});

test("admin email change is transactional, audited, normalized, and invalidates recovery codes", async () => {
  const operations = []; let ended = false;
  const session = { withTransaction: async callback => callback(), endSession: async () => { ended = true; } };
  const client = { startSession: () => session };
  const db = { collection: name => ({
    findOne: async (_query, options) => { assert.equal(options.session, session); return name === "users" ? { ...owner, _id: new ObjectId(owner.id) } : request; },
    updateOne: async (query, update, options) => { assert.equal(options.session, session); operations.push({ name, query, update }); },
    deleteMany: async (query, options) => { assert.equal(options.session, session); operations.push({ name, query }); },
  }) };
  const load = loader({ "app/lib/mongodb.ts": { ensureAuthIndexes: async () => {}, getDb: async connectedClient => { assert.equal(connectedClient, client); return db; }, getMongoClient: async () => client } });
  const response = await load("app/actions/support.ts").changeUserEmailAction(form({ requestId, newEmail: " NEW@EXAMPLE.COM " }));
  assert.equal(response.status, "success"); assert.equal(ended, true);
  assert.equal(operations.find(op => op.name === "users").update.$set.email, "new@example.com");
  for (const name of ["otps", "passwordResetTokens"]) assert.equal(operations.find(op => op.name === name).query.userId.toString(), owner.id);
  const ticket = operations.find(op => op.name === "supportRequests").update.$set;
  assert.equal(ticket.status, "resolved"); assert.equal(ticket.emailChange.previous, owner.email); assert.equal(ticket.emailChange.changedBy.toString(), admin.id);
});

test("the super admin identity cannot be changed through a support request", async () => {
  const session = { withTransaction: async callback => callback(), endSession: async () => {} };
  const load = loader({ "app/lib/mongodb.ts": { ensureAuthIndexes: async () => {}, getMongoClient: async () => ({ startSession: () => session }), getDb: async () => ({ collection: name => ({ findOne: async () => name === "users" ? admin : request, updateOne: async () => { assert.fail("Unexpected email write"); } }) }) } });
  const result = await load("app/actions/support.ts").changeUserEmailAction(form({ requestId, newEmail: "new@example.com" }));
  assert.equal(result.status, "error"); assert.ok(result.message.includes("super admin"));
});

test("support uploads validate file signatures and request private Cloudinary storage", async t => {
  const originalFetch = globalThis.fetch;
  const oldEnv = { CLOUD_NAME: process.env.CLOUD_NAME, CLOUD_API_KEY: process.env.CLOUD_API_KEY, CLOUD_API_SECRET: process.env.CLOUD_API_SECRET };
  Object.assign(process.env, { CLOUD_NAME: "test-cloud", CLOUD_API_KEY: "test-key", CLOUD_API_SECRET: "test-secret" });
  t.after(() => { globalThis.fetch = originalFetch; for (const [key, value] of Object.entries(oldEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  let uploadBody;
  globalThis.fetch = async (_url, options) => { uploadBody = options.body; return Response.json({ public_id: "private/file.pdf", asset_id: "private-asset", type: "authenticated" }); };
  const cloudinary = loader({ "app/lib/cloudinary.ts": undefined })("app/lib/cloudinary.ts");
  await assert.rejects(cloudinary.uploadSupportAttachment(new File(["not a PDF"], "bad.pdf", { type: "application/pdf" }), owner.id, requestId), /contents do not match/);
  assert.equal(uploadBody, undefined);
  const file = await cloudinary.uploadSupportAttachment(new File(["%PDF-test"], "file.pdf", { type: "application/pdf" }), owner.id, requestId);
  assert.equal(uploadBody.get("type"), "authenticated");
  assert.ok(uploadBody.get("folder").includes(owner.id));
  assert.ok(uploadBody.get("signature")); assert.equal(file.assetId, "private-asset");
  assert.equal(Object.hasOwn(file, "secure_url"), false);
});
