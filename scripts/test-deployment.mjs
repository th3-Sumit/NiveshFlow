import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { cleanNetlifyCache } from "./clean-netlify-cache.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));
const ts = require("typescript");

async function fixture(t) {
  const directory = path.join(root, ".next");
  await mkdir(directory, { recursive: true });
  const workspace = await mkdtemp(path.join(directory, "deployment-test-"));
  t.after(async () => {
    const relative = path.relative(directory, workspace);
    assert.ok(relative.startsWith("deployment-test-") && !relative.includes(path.sep));
    await rm(workspace, { recursive: true, force: true });
  });
  return workspace;
}

async function put(workspace, filename, contents = "fixture") {
  const target = path.join(workspace, filename);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
}

test("Netlify cleanup removes only compiler caches and preserves deployable artifacts", async (t) => {
  const workspace = await fixture(t);
  for (const filename of [".next/cache/turbopack/old.sst", ".netlify/.next/cache/turbopack/old.sst", ".next/static/chunk.js", ".next/server/app/page.js", ".next/cache/fetch-cache/response", ".next/dev/cache/turbopack/dev.sst", ".netlify/functions/server.js"]) {
    await put(workspace, filename);
  }
  assert.deepEqual(await cleanNetlifyCache(workspace, { NETLIFY: "true" }), [".next/cache/turbopack", ".netlify/.next/cache/turbopack"]);
  await assert.rejects(readFile(path.join(workspace, ".next/cache/turbopack/old.sst")), { code: "ENOENT" });
  await assert.rejects(readFile(path.join(workspace, ".netlify/.next/cache/turbopack/old.sst")), { code: "ENOENT" });
  for (const filename of [".next/static/chunk.js", ".next/server/app/page.js", ".next/cache/fetch-cache/response", ".next/dev/cache/turbopack/dev.sst", ".netlify/functions/server.js"]) {
    assert.equal(await readFile(path.join(workspace, filename), "utf8"), "fixture");
  }
  assert.deepEqual(await cleanNetlifyCache(workspace, { NETLIFY: "true" }), []);
});

test("local builds keep their compiler cache", async (t) => {
  const workspace = await fixture(t);
  await put(workspace, ".next/cache/turbopack/local.sst");
  assert.deepEqual(await cleanNetlifyCache(workspace, {}), []);
  assert.equal(await readFile(path.join(workspace, ".next/cache/turbopack/local.sst"), "utf8"), "fixture");
});

test("cleanup refuses a symbolic-link cache", async (t) => {
  const workspace = await fixture(t);
  await put(workspace, "other/keep.txt");
  await mkdir(path.join(workspace, ".next/cache"), { recursive: true });
  await symlink(path.join(workspace, "other"), path.join(workspace, ".next/cache/turbopack"), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(cleanNetlifyCache(workspace, { NETLIFY: "true" }), /Refusing to remove/);
  assert.equal(await readFile(path.join(workspace, "other/keep.txt"), "utf8"), "fixture");
});

test("cleanup refuses a parent link escaping the workspace", async (t) => {
  const workspace = await fixture(t);
  const outside = await fixture(t);
  await put(outside, "cache/turbopack/keep.txt");
  await symlink(outside, path.join(workspace, ".next"), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(cleanNetlifyCache(workspace, { NETLIFY: "true" }), /Refusing to remove/);
  assert.equal(await readFile(path.join(outside, "cache/turbopack/keep.txt"), "utf8"), "fixture");
});

test("Next config disables persistent production compilation caching only on Netlify", async () => {
  const source = ts.transpileModule(await readFile(path.join(root, "next.config.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  for (const [environment, enabled] of [[{}, true], [{ NETLIFY: "true" }, false]]) {
    const exports = {};
    new Function("exports", "process", source)(exports, { env: environment });
    assert.equal(exports.default.experimental.turbopackFileSystemCacheForBuild, enabled);
    assert.equal(exports.default.experimental.serverActions.bodySizeLimit, "16mb");
  }
});

const seedSource = ts.transpileModule(await readFile(path.join(root, "scripts/seed-super-admin.mjs"), "utf8"), {
  fileName: "seed.ts", compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const seedEnvironment = { MONGO_URI: "mongodb://fixture.invalid/finance", SUPER_ADMIN_PASSWORD: "fixture-only-password", SUPER_ADMIN_NAME: "Fixture Operator", SUPER_ADMIN_PHONE: "+12025550127" };

async function seed(environment, existing = null) {
  const calls = { connected: false, inserted: null, update: null, closed: false };
  const users = {
    async findOne() { return existing; },
    async createIndex() {},
    async insertOne(record) { calls.inserted = record; },
    async updateOne(filter, update) { calls.update = update; },
  };
  const mockedRequire = (specifier) => {
    if (specifier === "node:fs") return { existsSync: () => false };
    if (specifier === "mongodb") return {
      ObjectId: require("mongodb").ObjectId,
      MongoClient: class {
        async connect() { calls.connected = true; }
        db() { return { collection: () => users }; }
        async close() { calls.closed = true; }
      },
    };
    if (specifier === "node:crypto") return {
      randomBytes: (size) => Buffer.alloc(size, 1),
      scrypt: (password, salt, size, callback) => callback(null, Buffer.alloc(size, 2)),
    };
    return require(specifier);
  };
  const messages = [];
  try {
    await new AsyncFunction("require", "exports", "process", "console", seedSource)(mockedRequire, {}, {
      env: { ...environment }, exit(code) { throw new Error(`Exit ${code}`); },
    }, { log: (message) => messages.push(message), error: (message) => messages.push(message) });
  } catch (error) {
    return { calls, messages, error };
  }
  return { calls, messages };
}

for (const key of ["MONGO_URI", "SUPER_ADMIN_PASSWORD", "SUPER_ADMIN_NAME", "SUPER_ADMIN_PHONE"]) {
  test(`administrator seeding requires ${key} before connecting`, async () => {
    const environment = { ...seedEnvironment };
    delete environment[key];
    const result = await seed(environment);
    assert.match(result.error.message, /Exit 1/);
    assert.ok(result.messages.some((message) => message.includes(key)));
    assert.equal(result.calls.connected, false);
  });
}

test("administrator seeding uses explicit contact values and never stores a plaintext password", async () => {
  const result = await seed(seedEnvironment);
  assert.equal(result.error, undefined);
  assert.equal(result.calls.inserted.name, seedEnvironment.SUPER_ADMIN_NAME);
  assert.equal(result.calls.inserted.phone, seedEnvironment.SUPER_ADMIN_PHONE);
  assert.equal(result.calls.inserted.role, "super_admin");
  assert.notEqual(result.calls.inserted.passwordHash, seedEnvironment.SUPER_ADMIN_PASSWORD);
  assert.equal(result.calls.closed, true);
});

test("administrator seeding does not reset an existing password without opt-in", async () => {
  const existing = { _id: new (require("mongodb").ObjectId)(), passwordHash: "existing-hash" };
  const result = await seed(seedEnvironment, existing);
  assert.equal(result.error, undefined);
  assert.equal(result.calls.update.$set.passwordHash, undefined);
  const reset = await seed({ ...seedEnvironment, SUPER_ADMIN_RESET_PASSWORD: "true" }, existing);
  assert.equal(reset.error, undefined);
  assert.ok(reset.calls.update.$set.passwordHash);
  assert.equal(reset.calls.closed, true);
});
