import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = ts.transpileModule(
  await readFile(new URL("../netlify/functions/database-health.mjs", import.meta.url), "utf8"),
  { fileName: "database-health.ts", compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

function fixture(options = {}) {
  const { failAt } = options;
  const uri = Object.hasOwn(options, "uri") ? options.uri : "mongodb://fixture.invalid/finance";
  const calls = [];
  const logs = [];
  function record(operation, ...args) {
    calls.push([operation, ...args]);
    if (operation === failAt) throw new Error("Private driver detail: fixture-sensitive-value");
  }
  class MongoClient {
    constructor(...args) { record("construct", ...args); }
    async connect() { record("connect"); }
    db(name) {
      record("db", name);
      return {
        collection(name) {
          record("collection", name);
          return { async findOne(...args) { record("findOne", ...args); return null; } };
        },
      };
    }
    async close() { record("close"); }
  }
  const exports = {};
  new Function("require", "exports", "process", "console", source)(
    (name) => { assert.equal(name, "mongodb"); return { MongoClient }; },
    exports,
    { env: { MONGO_URI: uri } },
    { info: (...args) => logs.push(args), error: (...args) => logs.push(args) },
  );
  return { handler: exports.default, config: exports.config, calls, logs };
}

test("database health is scheduled daily at midnight UTC", async () => {
  assert.deepEqual(fixture().config, { schedule: "0 0 * * *" });
  const config = await readFile(new URL("../netlify.toml", import.meta.url), "utf8");
  assert.match(config, /directory\s*=\s*"netlify\/functions"/);
  assert.doesNotMatch(config, /MONGO_URI|SECRETS_SCAN/);
});

test("health check performs a bounded read, closes the connection, and returns no user data", async () => {
  const { handler, calls, logs } = fixture();
  assert.equal(await handler(), undefined);
  assert.deepEqual(calls.map(([operation]) => operation), ["construct", "connect", "db", "collection", "findOne", "close"]);
  assert.deepEqual(calls[0][2], {
    maxPoolSize: 1, minPoolSize: 0, connectTimeoutMS: 10_000,
    serverSelectionTimeoutMS: 10_000, timeoutMS: 10_000,
  });
  assert.deepEqual(calls[2], ["db", "finance"]);
  assert.deepEqual(calls[3], ["collection", "_systemHealth"]);
  assert.deepEqual(calls[4], ["findOne", { _id: "scheduled-database-check" }, { projection: { _id: 1 }, maxTimeMS: 5_000 }]);
  assert.deepEqual(logs, [["Scheduled database health check succeeded."]]);
});

test("a connection URI without a database uses the app's default database", async () => {
  const { handler, calls } = fixture({ uri: "mongodb+srv://fixture.invalid/?retryWrites=true" });
  await handler();
  assert.deepEqual(calls[2], ["db", "finance_management"]);
});

for (const uri of [undefined, "", "   "]) {
  test(`missing or blank runtime URI fails before connecting (${JSON.stringify(uri)})`, async () => {
    const check = fixture({ uri });
    await assert.rejects(check.handler(), /MONGO_URI must be available/);
    assert.deepEqual(check.calls, []);
  });
}

for (const failAt of ["construct", "connect", "findOne", "close"]) {
  test(`failure during ${failAt} is surfaced without private driver details`, async () => {
    const { handler, calls, logs } = fixture({ failAt });
    await assert.rejects(handler(), { message: "Scheduled database health check failed." });
    assert.equal(calls.filter(([operation]) => operation === "close").length, failAt === "construct" ? 0 : 1);
    assert.doesNotMatch(JSON.stringify(logs), /fixture-sensitive-value|fixture\.invalid/);
    assert.equal(logs.length, 1);
    assert.doesNotMatch(JSON.stringify(logs), /succeeded/);
  });
}

test("invalid URI is rejected without leaking its contents", async () => {
  const { handler, calls, logs } = fixture({ uri: "invalid-fixture-sensitive-value" });
  await assert.rejects(handler(), { message: "Scheduled database health check failed." });
  assert.deepEqual(calls, []);
  assert.doesNotMatch(JSON.stringify(logs), /fixture-sensitive-value/);
});
