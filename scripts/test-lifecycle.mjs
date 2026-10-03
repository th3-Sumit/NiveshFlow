import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { memory, loader, owner, admin, id, ObjectId, decimal, number, form } from "./lifecycle-test-harness.mjs";

const hash = token => createHash("sha256").update(token).digest("hex");
const userId = new ObjectId(owner.id);
const strong = "ValidPass9!";
const now = new Date();
const active = () => ({ _id: userId, ...owner, status: "active", authVersion: 0, passwordHash: "hashed:" + strong, createdAt: now });
const invited = (token = "a".repeat(64), expiresAt = new Date(Date.now() + 7200000)) => ({ ...active(), passwordHash: undefined, status: "invited", invitation: { tokenHash: hash(token), expiresAt, delivery: "sent" } });
const account = (balance = 1000, accountId = id()) => ({ _id: accountId, userId, name: "Cash", type: "cash", openingBalance: decimal(balance), currentBalance: decimal(balance), status: "active" });
const movement = (accountId, type = "income", amount = 100) => ({ _id: id(), userId, accountId, type, amount: decimal(amount), tags: [], transactionDate: now, createdAt: now, status: "completed" });
const transactionFields = transaction => ({ kind: "transaction", id: transaction._id, accountId: transaction.accountId, toAccountId: transaction.toAccountId ?? "", type: transaction.type, amount: number(transaction.amount), transactionDate: "2026-10-03", merchant: "", description: "", tags: "", principal: number(transaction.breakdown?.principal), interest: number(transaction.breakdown?.interest), fee: number(transaction.breakdown?.fee) });

test("72-hour boundary is strict and disabled sessions cannot be revived by enabling", () => {
  const lifecycle = loader().load("app/lib/user-lifecycle.ts");
  assert.equal(lifecycle.INVITATION_TTL_MS, 72 * 3600000);
  assert.equal(lifecycle.userStatus(invited("a".repeat(64), now), now), "expired");
  assert.equal(lifecycle.userStatus(invited("a".repeat(64), new Date(+now + 1)), now), "invited");
  assert.equal(lifecycle.userStatus({ status: "disabled" }), "inactive");
  assert.equal(lifecycle.canAccessAccount(active(), 0), true);
  assert.equal(lifecycle.canAccessAccount({ ...active(), status: "disabled" }, 0), false);
  assert.equal(lifecycle.canAccessAccount({ ...active(), authVersion: 2 }, 0), false);
  assert.equal(lifecycle.canAccessAccount(invited()), false);
});

test("production MongoDB connections share one pool and failed connections can retry", async context => {
  const previousUri = process.env.MONGO_URI; const previousMode = process.env.NODE_ENV; const previousPromise = global.mongoClientPromise;
  context.after(() => {
    if (previousUri === undefined) delete process.env.MONGO_URI; else process.env.MONGO_URI = previousUri;
    if (previousMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousMode;
    global.mongoClientPromise = previousPromise;
  });
  process.env.MONGO_URI = "mongodb://localhost:27017/testfinance"; process.env.NODE_ENV = "production"; global.mongoClientPromise = undefined;
  let connections = 0, fail = true;
  class MongoClient {
    async connect() { connections++; if (fail) { fail = false; throw new Error("Unavailable"); } return this; }
    db(name) { return { databaseName: name }; }
  }
  const realDriver = createRequire(import.meta.url)("mongodb");
  const dbModule = loader(memory(), { "app/lib/mongodb.ts": undefined, mongodb: { ...realDriver, MongoClient } }).load("app/lib/mongodb.ts");
  await assert.rejects(dbModule.getMongoClient());
  const client = await dbModule.getMongoClient();
  assert.equal(await dbModule.getMongoClient(), client); assert.equal((await dbModule.getDb()).databaseName, "testfinance"); assert.equal(connections, 2);
});

test("invite sends a 72-hour single-use URL but stores only its hash", async () => {
  const store = memory(); const harness = loader(store);
  const result = await harness.load("app/actions/admin.ts").inviteUserAction(form({ name: "Invited Person", email: "invited@example.com", phone: "+919876543211" }));
  assert.equal(result.status, "success");
  const user = store.rows("users")[0]; const token = new URL(harness.sent[0].url).searchParams.get("token");
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(user.invitation.tokenHash, hash(token)); assert.equal(user.passwordHash, undefined);
  assert.equal(+user.invitation.expiresAt - +user.createdAt, 72 * 3600000);
  assert.equal(JSON.stringify(user).includes(token), false); assert.equal(JSON.stringify(result).includes(token), false);
  assert.equal(user.invitation.delivery, "sent");
});

test("SMTP failure reserves identity and exposes a retryable delivery status", async () => {
  const store = memory(); const harness = loader(store, { "app/lib/email.ts": { sendInvitationEmail: async () => { throw new Error("SMTP secret error"); } } });
  const result = await harness.load("app/actions/admin.ts").inviteUserAction(form({ name: "Invited Person", email: "invited@example.com", phone: "+919876543211" }));
  assert.equal(result.status, "error"); assert.match(result.message, /Reinvite/); assert.equal(result.message.includes("secret"), false);
  assert.equal(store.rows("users")[0].invitation.delivery, "failed");
});

test("reinvite replaces token and expired, disabled, or consumed links cannot activate", async () => {
  const old = "a".repeat(64); const store = memory({ users: [invited(old, new Date(Date.now() - 1000))] }); const harness = loader(store);
  assert.equal((await harness.load("app/actions/invitations.ts").acceptInvitationAction(form({ token: old, password: strong, confirmPassword: strong }))).status, "error");
  assert.equal((await harness.load("app/actions/admin.ts").reinviteUserAction(form({ id: userId }))).status, "success");
  const token = new URL(harness.sent[0].url).searchParams.get("token");
  const actions = harness.load("app/actions/invitations.ts");
  assert.equal((await actions.acceptInvitationAction(form({ token: old, password: strong, confirmPassword: strong }))).status, "error");
  await assert.rejects(actions.acceptInvitationAction(form({ token, password: strong, confirmPassword: strong })), /Redirect: \/dashboard/);
  assert.equal(store.rows("users")[0].status, "active"); assert.equal(store.rows("users")[0].invitation, undefined); assert.equal(harness.sessions.length, 1);
  assert.equal((await actions.acceptInvitationAction(form({ token, password: strong, confirmPassword: strong }))).status, "error");
  const disabled = loader(memory({ users: [{ ...invited(token), status: "disabled" }] }));
  assert.equal((await disabled.load("app/actions/invitations.ts").acceptInvitationAction(form({ token, password: strong, confirmPassword: strong }))).status, "error");
});

test("activation validates passwords, converts a linked lead and uses a database transaction", async () => {
  const token = "b".repeat(64); const store = memory({ users: [invited(token)], leads: [{ _id: id(), userId, stage: "invited" }] }); const harness = loader(store); const action = harness.load("app/actions/invitations.ts").acceptInvitationAction;
  assert.equal((await action(form({ token, password: "weak", confirmPassword: "weak" }))).status, "error"); assert.equal(store.rows("users")[0].status, "invited");
  await assert.rejects(action(form({ token, password: strong, confirmPassword: strong })), /Redirect: \/dashboard/); assert.equal(store.rows("leads")[0].stage, "converted");
  assert.ok(store.events.find(event => event.name === "users" && event.operation === "findOneAndUpdate").session);
});

test("a failed activation rolls back password and lead changes without creating a session", async () => {
  const store = memory({ users: [invited()] }); store.failOn("leads", "updateMany"); const harness = loader(store);
  assert.equal((await harness.load("app/actions/invitations.ts").acceptInvitationAction(form({ token: "a".repeat(64), password: strong, confirmPassword: strong }))).status, "error");
  assert.equal(store.rows("users")[0].status, "invited"); assert.equal(store.rows("users")[0].passwordHash, undefined); assert.equal(harness.sessions.length, 0); assert.ok(store.events.some(event => event.operation === "rollback"));
});

test("admin-only mutations and reads reject normal users", async () => {
  const denied = new Error("Forbidden"); const harness = loader(memory(), { "app/lib/data.ts": { requireSuperAdmin: async () => { throw denied; } } });
  const actions = harness.load("app/actions/admin.ts");
  for (const name of ["inviteUserAction", "reinviteUserAction", "setUserAccessAction", "updateManagedUserAction", "saveLeadAction", "deleteLeadAction"]) await assert.rejects(actions[name](form({})), error => error === denied);
  await assert.rejects(harness.load("app/lib/admin-data.ts").getManagedUsers({}), error => error === denied);
  await assert.rejects(harness.load("app/lib/admin-data.ts").getAdminOverview(), error => error === denied);
  await assert.rejects(harness.load("app/actions/account-deletion.ts").retryMaintenanceAction(), error => error === denied);
});

test("disable removes recovery codes, increments auth version, enable never revives old sessions, and admin is protected", async () => {
  const store = memory({ users: [active(), { ...active(), _id: new ObjectId(admin.id), role: "super_admin", email: admin.email }], otps: [{ _id: id(), userId }], passwordResetTokens: [{ _id: id(), userId }] }); const actions = loader(store).load("app/actions/admin.ts");
  assert.equal((await actions.setUserAccessAction(form({ id: userId, enabled: false }))).status, "success"); assert.equal(store.rows("users")[0].status, "disabled"); assert.equal(store.rows("users")[0].authVersion, 1); assert.equal(store.rows("otps").length, 0); assert.equal(store.rows("passwordResetTokens").length, 0);
  assert.equal((await actions.setUserAccessAction(form({ id: userId, enabled: true }))).status, "success"); assert.equal(store.rows("users")[0].authVersion, 2);
  assert.equal((await actions.setUserAccessAction(form({ id: admin.id, enabled: false }))).status, "error");
  assert.equal((await actions.inviteUserAction(form({ name: "Admin", email: admin.email, phone: admin.phone }))).status, "error");
});

test("safe admin user projection does not serialize passwords, tokens, or private asset IDs", () => {
  const result = loader().load("app/lib/admin-data.ts").adminUserView({ ...invited(), avatarPublicId: "private-avatar" });
  const serialized = JSON.stringify(result); assert.equal(serialized.includes("tokenHash"), false); assert.equal(serialized.includes("passwordHash"), false); assert.equal(serialized.includes("private-avatar"), false);
});

test("all users are reachable through bounded pagination and search metacharacters are literal", async () => {
  const users = Array.from({ length: 45 }, (_, index) => ({ ...active(), _id: id(), email: "user" + index + "@example.com", name: index === 40 ? "Person [example]" : "Person" }));
  const store = memory({ users }); const data = loader(store).load("app/lib/admin-data.ts");
  const last = await data.getManagedUsers({ page: "3" }); assert.equal(last.total, 45); assert.equal(last.pages, 3); assert.equal(last.users.length, 5);
  assert.equal((await data.getManagedUsers({ page: "999" })).page, 3);
  assert.equal((await data.getManagedUsers({ query: "[example]" })).users.length, 1);
});

test("password, OTP and recovery entry points reject disabled and unactivated users", async () => {
  for (const user of [{ ...active(), status: "disabled" }, invited()]) {
    const store = memory({ users: [user] }); const harness = loader(store);
    const auth = harness.load("app/actions/auth.ts");
    assert.equal((await auth.loginAction({ status: "idle" }, form({ email: owner.email, password: strong }))).status, "error");
    for (const action of ["requestLoginOtpAction", "verifyLoginOtpAction", "requestPasswordResetOtpAction", "verifyPasswordResetOtpAction"]) {
      assert.equal((await auth[action]({ status: "idle" }, form({ identifier: owner.email, code: "123456" }))).status, "error");
    }
    assert.equal(harness.sessions.length, 0); assert.equal(harness.sent.length, 0);
  }
});

test("current-user lookup rejects a disabled account or a stale session version", async () => {
  for (const user of [{ ...active(), status: "disabled" }, { ...active(), authVersion: 2 }, invited()]) {
    const store = memory({ users: [user] });
    const harness = loader(store, { "app/lib/data.ts": undefined, "app/lib/session.ts": { readSession: async () => ({ userId: owner.id, authVersion: 0 }) } });
    assert.equal(await harness.load("app/lib/data.ts").getCurrentUser(), null);
  }
});

test("transaction edits atomically undo the old balance and apply the replacement", async () => {
  const cash = account(1100); const tx = movement(cash._id); const store = memory({ accounts: [cash], transactions: [tx] });
  const result = await loader(store).load("app/actions/finance.ts").updateRecordAction(form({ ...transactionFields(tx), amount: 250 }));
  assert.equal(result.status, "success"); assert.equal(number(store.rows("accounts")[0].currentBalance), 1250); assert.equal(number(store.rows("transactions")[0].amount), 250);
  assert.ok(store.events.filter(event => event.name === "accounts" && event.operation === "updateOne").every(event => event.session));
});

test("failed replacement effects roll back the old balance and transaction", async () => {
  const cash = account(1100); const tx = movement(cash._id); const store = memory({ accounts: [cash], transactions: [tx] });
  const result = await loader(store).load("app/actions/finance.ts").updateRecordAction(form({ ...transactionFields(tx), accountId: id(), amount: 250 }));
  assert.equal(result.status, "error"); assert.equal(number(store.rows("accounts")[0].currentBalance), 1100); assert.equal(number(store.rows("transactions")[0].amount), 100);
});

test("deleting a transfer restores both accounts and deleting an expense restores its source", async () => {
  const a = account(800), b = account(700); const tx = { ...movement(a._id, "transfer", 200), toAccountId: b._id };
  const store = memory({ accounts: [a, b], transactions: [tx] }); const actions = loader(store).load("app/actions/finance.ts");
  assert.equal((await actions.deleteRecordAction(form({ kind: "transaction", id: tx._id }))).status, "success");
  assert.deepEqual(store.rows("accounts").map(row => number(row.currentBalance)), [1000, 500]); assert.equal(store.rows("transactions").length, 0);
});

test("debt payment edit and deletion synchronize cash, principal and payment history", async () => {
  const cash = account(780); const debtId = id(); const tx = { ...movement(cash._id, "debt_payment", 220), relatedEntity: { type: "debt", id: debtId }, breakdown: { principal: decimal(200), interest: decimal(15), fee: decimal(5) } };
  const debt = { _id: debtId, userId, originalPrincipal: decimal(1000), currentPrincipal: decimal(800), status: "active" };
  const payment = { _id: id(), userId, transactionId: tx._id, debtId, accountId: cash._id };
  const store = memory({ accounts: [cash], debts: [debt], transactions: [tx], debtPayments: [payment] }); const actions = loader(store).load("app/actions/finance.ts");
  assert.equal((await actions.updateRecordAction(form({ ...transactionFields(tx), principal: 300 }))).status, "success");
  assert.equal(number(store.rows("accounts")[0].currentBalance), 680); assert.equal(number(store.rows("debts")[0].currentPrincipal), 700); assert.equal(number(store.rows("debtPayments")[0].principalAmount), 300);
  assert.equal((await actions.deleteRecordAction(form({ kind: "transaction", id: tx._id }))).status, "success");
  assert.equal(number(store.rows("accounts")[0].currentBalance), 1000); assert.equal(number(store.rows("debts")[0].currentPrincipal), 1000); assert.equal(store.rows("debtPayments").length, 0);
});

test("account opening balance edits preserve net ledger movements; linked records cannot be deleted", async () => {
  const cash = account(1100); cash.openingBalance = decimal(1000); const tx = movement(cash._id);
  const store = memory({ accounts: [cash], transactions: [tx] }); const actions = loader(store).load("app/actions/finance.ts");
  assert.equal((await actions.updateRecordAction(form({ kind: "account", id: cash._id, name: "Bank", type: "savings", institution: "", openingBalance: 2000 }))).status, "success");
  assert.equal(number(store.rows("accounts")[0].currentBalance), 2100);
  assert.equal((await actions.deleteRecordAction(form({ kind: "account", id: cash._id }))).status, "error"); assert.equal(store.rows("accounts").length, 1);
});

test("finance changes cannot edit or remove another owner's records; invalid kinds and dates fail", async () => {
  const cash = { ...account(), userId: id() }; const store = memory({ accounts: [cash] }); const harness = loader(store); const actions = harness.load("app/actions/finance.ts");
  assert.equal((await actions.deleteRecordAction(form({ kind: "account", id: cash._id }))).status, "error");
  assert.equal((await actions.updateRecordAction(form({ kind: "account", id: cash._id, name: "Stolen", type: "cash", institution: "", openingBalance: 0 }))).status, "error");
  assert.equal((await actions.deleteRecordAction(form({ kind: "users", id: cash._id }))).status, "error");
  const schema = harness.load("app/lib/record-management.ts").recordSchemas.goal;
  assert.equal(schema.safeParse({ name: "Goal", targetAmount: 100, currentAmount: 0, targetDate: "2026-02-30" }).success, false);
});

test("creation rollback prevents orphan ledger entries if source or destination is unavailable", async () => {
  const cash = account(1000); const store = memory({ accounts: [cash] }); const actions = loader(store).load("app/actions/finance.ts");
  await assert.rejects(actions.createTransactionAction(form({ ...transactionFields(movement(cash._id, "transfer", 100)), toAccountId: id() })));
  assert.equal(store.rows("transactions").length, 0); assert.equal(number(store.rows("accounts")[0].currentBalance), 1000);
});

async function deletionHarness(initial = {}, overrides = {}) {
  const store = memory({ users: [active()], ...initial }); const harness = loader(store, overrides); const actions = harness.load("app/actions/account-deletion.ts");
  const prepared = await actions.prepareAccountDeletionAction();
  return { store, harness, actions, phrase: prepared.phrase };
}
const deletionForm = phrase => form({ confirmation: phrase, password: strong, reason: "privacy", feedback: "Please make this simpler." });

test("deletion phrase is random, owner bound, hashed, expiring and requires current password", async () => {
  const { store, actions, phrase } = await deletionHarness();
  assert.match(phrase, /^delete-niveshflow-[a-f0-9]{12}$/); const challenge = store.rows("deletionChallenges")[0];
  assert.equal(challenge.challengeHash, hash(phrase)); assert.equal(challenge.userId.toString(), owner.id); assert.ok(+challenge.expiresAt - Date.now() <= 600000);
  assert.equal((await actions.deleteMyAccountAction(deletionForm("wrong"))).status, "error");
  assert.equal((await actions.deleteMyAccountAction(form({ ...Object.fromEntries(deletionForm(phrase)), password: "wrong" }))).status, "error"); assert.equal(store.rows("users").length, 1); assert.equal(store.rows("deletionChallenges")[0].attempts, 1);
  challenge.expiresAt = new Date(Date.now() - 1000);
  assert.equal((await actions.deleteMyAccountAction(deletionForm(phrase))).status, "error");
});

test("permanent deletion removes only owned data, signs out, notifies and saves identity-free feedback", async () => {
  const otherId = id(); const owned = { _id: id(), userId }; const other = { _id: id(), userId: otherId };
  const initial = Object.fromEntries(["accounts", "transactions", "debts", "debtPayments", "bills", "savingsGoals", "budgets", "categories", "otps", "passwordResetTokens", "supportRequests"].map(name => [name, name === "supportRequests" ? [{ ...owned, attachments: [] }, { ...other, attachments: [] }] : [owned, other]]));
  const { store, actions, harness, phrase } = await deletionHarness(initial);
  await assert.rejects(actions.deleteMyAccountAction(deletionForm(phrase)), /Redirect: \/\?accountDeleted=1&notification=sent/); assert.equal(store.rows("users").length, 0); assert.equal(harness.signedOut(), true);
  for (const name of Object.keys(initial)) { assert.equal(store.rows(name).length, 1); assert.equal(store.rows(name)[0].userId.toString(), otherId.toString()); }
  const feedback = store.rows("deletionFeedback")[0]; assert.equal(feedback.feedback, "Please make this simpler."); for (const key of ["userId", "email", "name"]) assert.equal(Object.hasOwn(feedback, key), false);
  assert.equal(harness.sent[0].to, owner.email); assert.equal(store.rows("mailJobs").length, 0);
  assert.equal((await actions.deleteMyAccountAction(deletionForm(phrase))).status, "error");
});

test("deletion rolls back data and queued jobs if any cascade step fails", async () => {
  const { store, actions, harness, phrase } = await deletionHarness({ accounts: [{ _id: id(), userId }] }); store.failOn("debts", "deleteMany");
  assert.equal((await actions.deleteMyAccountAction(deletionForm(phrase))).status, "error"); assert.equal(store.rows("users").length, 1); assert.equal(store.rows("accounts").length, 1); assert.equal(store.rows("deletionFeedback").length, 0); assert.equal(store.rows("mailJobs").length, 0); assert.equal(harness.signedOut(), false);
});

test("failed notification retains a durable job but never prevents completed account deletion", async () => {
  const { store, actions, phrase } = await deletionHarness({}, { "app/lib/email.ts": { sendNotificationEmail: async () => { throw new Error("Provider down"); } } });
  await assert.rejects(actions.deleteMyAccountAction(deletionForm(phrase)), /Redirect: \/\?accountDeleted=1&notification=pending/); assert.equal(store.rows("users").length, 0); assert.equal(store.rows("mailJobs").length, 1); assert.equal(store.rows("mailJobs")[0].attempts, 1);
});

test("super admin cannot prepare or submit self-deletion", async () => {
  const store = memory(); const actions = loader(store, { "app/lib/data.ts": { requireCurrentUser: async () => admin } }).load("app/actions/account-deletion.ts");
  assert.ok((await actions.prepareAccountDeletionAction()).error); assert.equal((await actions.deleteMyAccountAction(deletionForm("fake"))).status, "error"); assert.equal(store.events.length, 0);
});

test("maintenance retries keep failed assets and remove delivered jobs", async () => {
  const jobId = id(); const mailId = id(); const assets = [{ publicId: "good", resourceType: "image", deliveryType: "upload" }, { publicId: "bad", resourceType: "raw", deliveryType: "authenticated" }];
  const store = memory({ mediaCleanupJobs: [{ _id: jobId, assets }], mailJobs: [{ _id: mailId, to: owner.email, subject: "Deleted", text: "Confirmed", attempts: 0 }] });
  const harness = loader(store, { "app/lib/cloudinary.ts": { removeCloudinaryAsset: async value => { if (value.publicId === "bad") throw new Error("Failed"); } } }); const maintenance = harness.load("app/lib/maintenance.ts");
  await maintenance.processMediaJob(store.db, jobId); assert.equal(store.rows("mediaCleanupJobs")[0].assets.length, 1); assert.equal(store.rows("mediaCleanupJobs")[0].assets[0].publicId, "bad");
  assert.equal(await maintenance.processMailJob(store.db, mailId), true); assert.equal(store.rows("mailJobs").length, 0);
});
