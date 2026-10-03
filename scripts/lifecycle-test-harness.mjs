import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));
const ts = require("typescript");
export const { ObjectId, Decimal128 } = require("mongodb");
export const owner = { id: "65a000000000000000000001", name: "Test User", email: "owner@example.com", phone: "+919876543210", role: "user" };
export const admin = { ...owner, id: "65a000000000000000000002", email: "kumarsumit747037@gmail.com", role: "super_admin" };
export const id = () => new ObjectId();
export const decimal = value => Decimal128.fromString(String(value));
export const number = value => Number(value?.toString() ?? 0);
export const form = values => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, String(value)); return data; };
const copy = value => value instanceof ObjectId ? new ObjectId(value.toString()) : value instanceof Decimal128 ? decimal(value.toString()) : value instanceof Date ? new Date(value) : Array.isArray(value) ? value.map(copy) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, copy(entry)])) : value;
const get = (record, key) => key.split(".").reduce((value, part) => value?.[part], record);
const equal = (a, b) => a instanceof ObjectId || b instanceof ObjectId ? String(a) === String(b) : a instanceof Date || b instanceof Date ? Number(a) === Number(b) : a === b;
function matches(record, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === "$and") return expected.every(item => matches(record, item));
    if (key === "$or") return expected.some(item => matches(record, item));
    const value = get(record, key);
    if (expected && typeof expected === "object" && "$regex" in expected) return (Array.isArray(value) ? value : [value]).some(item => new RegExp(expected.$regex, expected.$options ?? "").test(item ?? ""));
    if (expected && typeof expected === "object" && !(expected instanceof ObjectId) && !(expected instanceof Date)) return Object.entries(expected).every(([op, term]) => {
      if (op === "$exists") return (value !== undefined) === term;
      if (op === "$ne") return !equal(value, term);
      if (op === "$gt") return value > term;
      if (op === "$gte") return value >= term;
      if (op === "$lt") return value < term;
      if (op === "$lte") return value <= term;
      if (op === "$in") return term.some(item => equal(value, item));
      throw new Error("Unsupported test filter " + op);
    });
    return equal(value, expected);
  });
}
function assign(record, key, value, remove = false) {
  const parts = key.split("."); const last = parts.pop();
  const target = parts.reduce((object, part) => object[part] ??= {}, record);
  if (remove) delete target[last]; else target[last] = copy(value);
}
function modify(record, update, inserting = false) {
  for (const [key, value] of Object.entries(update.$set ?? {})) assign(record, key, value);
  for (const key of Object.keys(update.$unset ?? {})) assign(record, key, undefined, true);
  for (const [key, value] of Object.entries(update.$inc ?? {})) assign(record, key, value instanceof Decimal128 ? decimal(number(get(record, key)) + number(value)) : (get(record, key) ?? 0) + value);
  if (inserting) for (const [key, value] of Object.entries(update.$setOnInsert ?? {})) assign(record, key, value);
}
export function memory(initial = {}) {
  let state = copy(initial);
  const events = [];
  let fail = null;
  function rows(name) { return state[name] ??= []; }
  function event(name, operation, filter, options) {
    events.push({ name, operation, filter: copy(filter), session: !!options?.session });
    if (fail?.name === name && fail?.operation === operation) throw new Error("Injected failure");
  }
  const db = { collection(name) { return {
    async findOne(filter, options) { event(name, "findOne", filter, options); return copy(rows(name).find(row => matches(row, filter)) ?? null); },
    find(filter, options) {
      event(name, "find", filter, options); let values = rows(name).filter(row => matches(row, filter)); let skip = 0, limit = Infinity;
      return { sort(fields) { values.sort((a, b) => {
        for (const [key, direction] of Object.entries(fields)) {
          const left = get(a, key), right = get(b, key);
          const normalize = value => value instanceof Decimal128 ? number(value) : value instanceof ObjectId ? String(value) : value;
          const x = normalize(left), y = normalize(right);
          if (x !== y) { if (x == null) return -direction; if (y == null) return direction; if (x > y) return direction; if (x < y) return -direction; }
        }
        return 0;
      }); return this; }, skip(value) { skip = value; return this; }, limit(value) { limit = value; return this; }, async toArray() { return copy(values.slice(skip, skip + limit)); } };
    },
    aggregate(pipeline) {
      event(name, "aggregate", pipeline, {});
      let values = rows(name);
      for (const stage of pipeline) {
        if (stage.$match) values = values.filter(row => matches(row, stage.$match));
        else if (stage.$group) {
          values = values.length ? [Object.fromEntries(Object.entries(stage.$group).map(([key, expression]) => [key, key === "_id" ? null : values.reduce((total, row) => total + number(typeof expression.$sum === "string" ? get(row, expression.$sum.slice(1)) : expression.$sum), 0)]))] : [];
        } else throw new Error("Unsupported test aggregation");
      }
      return { async toArray() { return copy(values); } };
    },
    async insertOne(record, options) { event(name, "insertOne", {}, options); rows(name).push(copy(record)); return { insertedId: record._id }; },
    async updateOne(filter, update, options) {
      event(name, "updateOne", filter, options); let record = rows(name).find(row => matches(row, filter));
      if (!record && options?.upsert) { record = { ...copy(filter), _id: id() }; rows(name).push(record); modify(record, update, true); return { matchedCount: 0, upsertedId: record._id }; }
      if (record) modify(record, update);
      return { matchedCount: record ? 1 : 0, modifiedCount: record ? 1 : 0 };
    },
    async updateMany(filter, update, options) { event(name, "updateMany", filter, options); const values = rows(name).filter(row => matches(row, filter)); for (const row of values) modify(row, update); return { matchedCount: values.length }; },
    async findOneAndUpdate(filter, update, options) { event(name, "findOneAndUpdate", filter, options); const row = rows(name).find(row => matches(row, filter)); if (!row) return null; const before = copy(row); modify(row, update); return copy(options?.returnDocument === "after" ? row : before); },
    async replaceOne(filter, next, options) { event(name, "replaceOne", filter, options); const index = rows(name).findIndex(row => matches(row, filter)); if (index < 0) return { matchedCount: 0 }; rows(name)[index] = copy(next); return { matchedCount: 1 }; },
    async deleteOne(filter, options) { event(name, "deleteOne", filter, options); const index = rows(name).findIndex(row => matches(row, filter)); if (index < 0) return { deletedCount: 0 }; rows(name).splice(index, 1); return { deletedCount: 1 }; },
    async deleteMany(filter, options) { event(name, "deleteMany", filter, options); const before = rows(name).length; state[name] = rows(name).filter(row => !matches(row, filter)); return { deletedCount: before - state[name].length }; },
    async countDocuments(filter = {}) { return rows(name).filter(row => matches(row, filter)).length; },
  }; } };
  const client = { startSession() { const session = { async withTransaction(fn) { const snapshot = copy(state); events.push({ operation: "begin" }); try { await fn(); events.push({ operation: "commit" }); } catch (error) { state = snapshot; events.push({ operation: "rollback" }); throw error; } }, async endSession() {} }; return session; } };
  return { db, client, events, rows, failOn(name, operation) { fail = { name, operation }; } };
}

// Load actual modules while replacing external service boundaries, never touching live data.
export function loader(store = memory(), overrides = {}) {
  const cache = new Map(); const sent = [], sessions = []; let signedOut = false;
  const mocks = {
    "server-only": {}, "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect(url) { throw new Error("Redirect: " + url); } },
    "app/lib/data.ts": { requireCurrentUser: async () => owner, requireSuperAdmin: async () => admin },
    "app/lib/mongodb.ts": { getDb: async () => store.db, getMongoClient: async () => store.client, ensureFinanceIndexes: async () => {}, ensureLifecycleIndexes: async () => {}, ensureAuthIndexes: async () => {} },
    "app/lib/email.ts": { sendInvitationEmail: async value => sent.push(value), sendNotificationEmail: async value => sent.push(value) },
    "app/lib/password.ts": { hashSecret: async value => "hashed:" + value, verifySecret: async (value, hash) => hash === "hashed:" + value },
    "app/lib/session.ts": { createSession: async value => sessions.push(value), deleteSession: async () => { signedOut = true; } },
    "app/lib/cloudinary.ts": { removeCloudinaryAsset: async () => {} },
    ...overrides,
  };
  for (const [key, value] of Object.entries(mocks)) if (value === undefined) delete mocks[key];
  function load(specifier, parent = root) {
    if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
    if (!specifier.startsWith(".") && !specifier.startsWith("@/") && !path.isAbsolute(specifier)) return require(specifier);
    const absolute = specifier.startsWith("@/") ? path.join(root, specifier.slice(2)) : path.resolve(parent, specifier);
    const filename = [absolute, absolute + ".ts", absolute + ".tsx"].find(file => existsSync(file) && /\.[cm]?[jt]sx?$/.test(file));
    const relative = path.relative(root, filename).replaceAll("\\", "/");
    if (Object.hasOwn(mocks, relative)) return mocks[relative];
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} }; cache.set(filename, loadedModule);
    const source = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function("require", "module", "exports", source)(name => load(name, path.dirname(filename)), loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return { load: name => load(path.join(root, name)), sent, sessions, signedOut: () => signedOut };
}
