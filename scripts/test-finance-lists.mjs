import assert from "node:assert/strict";
import test from "node:test";
import { memory, loader, owner, id, ObjectId, decimal, form } from "./lifecycle-test-harness.mjs";

const userId = new ObjectId(owner.id), outsider = id(), accountId = id(), debtId = id();
const now = new Date("2026-10-03T12:00:00Z");
const user = { ...owner, _id: userId, status: "active", authVersion: 0, passwordHash: "hashed:ValidPass9!", createdAt: now };
const record = (view, index, ownerId = userId) => {
  const common = { _id: id(), userId: ownerId, name: "Record " + String(index).padStart(3, "0"), status: "active", createdAt: new Date(+now + index * 1000) };
  if (view === "account") return { ...common, type: "savings", currency: "INR", openingBalance: decimal(10), currentBalance: decimal(index + 1), institution: "Bank" };
  if (view === "debt") return { ...common, lender: "Lender", type: "personal_loan", originalPrincipal: decimal(100), currentPrincipal: decimal(50), interestRate: decimal(5), minimumPayment: decimal(10), startDate: now, nextPaymentDate: now };
  if (view === "bill") return { ...common, type: "bill", amount: decimal(index + 1), dueDate: now, frequency: "monthly", status: "upcoming" };
  if (view === "goal") return { ...common, targetAmount: decimal(100), currentAmount: decimal(20), targetDate: now };
  return { ...common, accountId, type: view === "payment" ? "debt_payment" : "income", amount: decimal(index + 1), transactionDate: new Date(+now + index * 1000), status: "completed", description: common.name, tags: [], ...(view === "payment" ? { relatedEntity: { type: "debt", id: debtId }, breakdown: { principal: decimal(1), interest: decimal(2), fee: decimal(0) } } : {}) };
};
const collection = { account: "accounts", transaction: "transactions", debt: "debts", payment: "transactions", bill: "bills", goal: "savingsGoals" };
function listHarness(store) {
  return loader(store, { "app/lib/data.ts": undefined, "app/lib/session.ts": { readSession: async () => ({ userId: owner.id, authVersion: 0 }) } });
}

test("query values are validated, bounded and resistant to array/operator input", () => {
  const { normalizeFinanceQuery } = loader().load("app/lib/finance-list.ts");
  const query = normalizeFinanceQuery("account", { q: " x ", type: "bad", status: ["active"], account: accountId.toString(), from: "2026-02-30", to: "2026-10-03", page: "-5", size: "10000", sort: "$where" });
  assert.equal(query.q, "x"); assert.equal(query.type, ""); assert.equal(query.status, ""); assert.equal(query.account, ""); assert.equal(query.from, ""); assert.equal(query.to, ""); assert.equal(query.page, 1); assert.equal(query.size, 10); assert.equal(query.sort, "newest");
  assert.equal(normalizeFinanceQuery("transaction", { page: "999999999", q: "x".repeat(1000) }).page, 1_000_000);
  assert.equal(normalizeFinanceQuery("transaction", { q: "x".repeat(1000) }).q.length, 120);
});

test("pagination URLs preserve filters and views while changing page or page size", () => {
  const { normalizeFinanceQuery, financeHref, paginationItems } = loader().load("app/lib/finance-list.ts");
  const query = normalizeFinanceQuery("payment", { q: "rent & fees", debt: debtId.toString(), account: accountId.toString(), from: "2026-10-01", to: "2026-10-03", sort: "amount_high", page: "2", size: "20" });
  const url = new URL(financeHref("/debts", "payment", query, { page: 3 }), "http://localhost");
  assert.equal(url.searchParams.get("view"), "payments"); assert.equal(url.searchParams.get("q"), "rent & fees"); assert.equal(url.searchParams.get("debt"), debtId.toString()); assert.equal(url.searchParams.get("page"), "3"); assert.equal(url.searchParams.get("from"), "2026-10-01");
  assert.equal(new URL(financeHref("/debts", "payment", query, { page: 1, size: 50 }), "http://localhost").searchParams.has("page"), false);
  assert.deepEqual(paginationItems(50, 100), [1, "ellipsis", 49, 50, 51, "ellipsis", 100]);
  assert.deepEqual(paginationItems(1, 1), [1]);
});

for (const view of Object.keys(collection)) test(view + " list reaches every record, clamps pages, and computes full filtered totals", async () => {
  const length = view === "transaction" ? 65 : view === "payment" ? 35 : view === "bill" ? 37 : 23;
  const records = Array.from({ length }, (_, index) => record(view, index));
  const store = memory({ users: [user], [collection[view]]: [...records, record(view, 1000, outsider)] });
  const data = listHarness(store).load("app/lib/finance-list-data.ts");
  const seen = new Set();
  for (let page = 1; page <= Math.ceil(length / 10); page++) {
    const result = await data.getFinanceList(view, { page: String(page) });
    assert.equal(result.total, length); assert.ok(result.rows.length <= 10);
    result.rows.forEach(row => seen.add(row.id));
    if (view === "debt") assert.equal(result.sum, 50 * length);
    else if (view === "goal") assert.equal(result.sum, 20 * length);
    else assert.equal(result.sum, length * (length + 1) / 2);
    assert.equal(JSON.stringify(result.rows).includes(outsider.toString()), false);
  }
  assert.equal(seen.size, length);
  assert.equal((await data.getFinanceList(view, { page: "999" })).page, Math.ceil(length / 10));
  const search = await data.getFinanceList(view, { q: "Record 022" });
  assert.equal(search.total, 1); assert.equal(search.rows[0].id, records[22]._id.toString());
});

test("search treats regular-expression metacharacters literally and searches individual tags", async () => {
  const literal = ["[x]", "(x)", "a+b", "foo.*", "$word", "a\\b"];
  const records = literal.map((name, index) => ({ ...record("account", index), name }));
  const tx = { ...record("transaction", 1), tags: ["Other", "[travel]"] };
  const data = listHarness(memory({ users: [user], accounts: [...records, { ...record("account", 50), name: "foobar" }], transactions: [tx] })).load("app/lib/finance-list-data.ts");
  for (const q of literal) assert.equal((await data.getFinanceList("account", { q })).total, 1, q);
  assert.equal((await data.getFinanceList("transaction", { q: "[travel]" })).total, 1);
});

test("account filtering includes both sides of transfers but never another owner's ledger", async () => {
  const source = record("transaction", 1), destination = { ...record("transaction", 2), accountId: id(), toAccountId: accountId, type: "transfer" };
  const data = listHarness(memory({ users: [user], transactions: [source, destination, record("transaction", 3, outsider), { ...record("transaction", 4), accountId: id() }] })).load("app/lib/finance-list-data.ts");
  const result = await data.getFinanceList("transaction", { account: accountId.toString() });
  assert.equal(result.total, 2); assert.equal(result.sum, 5);
});

test("date filters include the complete end day and payment view cannot include normal income", async () => {
  const records = ["2026-10-02T23:59:59Z", "2026-10-03T00:00:00Z", "2026-10-03T23:59:59Z", "2026-10-04T00:00:00Z"].map((time, index) => ({ ...record("payment", index), transactionDate: new Date(time) }));
  const data = listHarness(memory({ users: [user], transactions: [...records, record("transaction", 5)] })).load("app/lib/finance-list-data.ts");
  const result = await data.getFinanceList("payment", { from: "2026-10-03", to: "2026-10-03", type: "income", debt: debtId.toString() });
  assert.equal(result.total, 2); assert.equal(result.sum, 5); assert.equal(result.sum2, 2); assert.ok(result.rows.every(row => row.type === "debt_payment"));
});

test("status, type, frequency, sorting and empty states behave independently", async () => {
  const records = [record("bill", 0), { ...record("bill", 1), status: "paid", frequency: "yearly", type: "subscription" }, { ...record("bill", 2), type: "subscription" }];
  const data = listHarness(memory({ users: [user], bills: records })).load("app/lib/finance-list-data.ts");
  assert.equal((await data.getFinanceList("bill", { status: "paid", frequency: "yearly", type: "subscription" })).total, 1);
  assert.equal((await data.getFinanceList("bill", { sort: "amount_high" })).rows[0].id, records[2]._id.toString());
  const empty = await data.getFinanceList("bill", { q: "missing", page: "50" });
  assert.equal(empty.total, 0); assert.equal(empty.page, 1); assert.equal(empty.pages, 1); assert.equal(empty.sum, 0); assert.deepEqual(empty.rows, []);
});

test("options and linked-payment flags are owned and safe to serialize", async () => {
  const debt = record("debt", 1), account = record("account", 1);
  const store = memory({ users: [user], accounts: [account, record("account", 2, outsider)], debts: [debt, record("debt", 2, outsider)], debtPayments: [{ userId, debtId: debt._id }] });
  const data = listHarness(store).load("app/lib/finance-list-data.ts");
  const options = await data.getFinanceOptions(true);
  assert.equal(options.accounts.length, 1); assert.equal(options.debts.length, 1); assert.deepEqual(Object.keys(options.accounts[0]).sort(), ["id", "name", "status"]);
  assert.equal((await data.getFinanceList("debt", {})).rows[0].hasPayments, true);
});

test("list reads and dialog creation require an active authenticated session", async () => {
  const denied = listHarness(memory({ users: [{ ...user, status: "disabled" }] }));
  await assert.rejects(denied.load("app/lib/finance-list-data.ts").getFinanceList("account", {}), /Redirect: \/login/);
  await assert.rejects(denied.load("app/lib/finance-list-data.ts").getFinanceOptions(), /Redirect: \/login/);
  const unauthorized = loader(memory(), { "app/lib/data.ts": { requireCurrentUser: async () => { throw new Error("Unauthenticated"); } } });
  await assert.rejects(unauthorized.load("app/actions/finance.ts").createFinanceRecordAction(form({ kind: "account" })), /Unauthenticated/);
});

test("dialog creation validates fields, transfer destinations, debt payment totals and dates", async () => {
  const harness = loader(), action = harness.load("app/actions/finance.ts").createFinanceRecordAction;
  assert.equal((await action(form({ kind: "prototype" }))).status, "error");
  assert.ok((await action(form({ kind: "account", name: "x" }))).errors.name);
  const transfer = await action(form({ kind: "transaction", type: "transfer", accountId, toAccountId: accountId, amount: "10", transactionDate: "2026-10-03" }));
  assert.ok(transfer.errors.toAccountId);
  const payment = await action(form({ kind: "payment", debtId, accountId, principalAmount: "0", interestAmount: "0", feeAmount: "0", paymentDate: "2026-10-03" }));
  assert.ok(payment.errors.principalAmount);
  assert.ok((await action(form({ kind: "payment", debtId, accountId, principalAmount: "-1", paymentDate: "2026-02-30" }))).errors.paymentDate);
});

test("all six dialog create actions preserve existing ledger and planning semantics", async () => {
  const store = memory(), harness = loader(store), action = harness.load("app/actions/finance.ts").createFinanceRecordAction;
  assert.equal((await action(form({ kind: "account", name: "Checking", type: "checking", openingBalance: 1000 }))).status, "success");
  const account = store.rows("accounts")[0];
  assert.equal((await action(form({ kind: "transaction", type: "income", accountId: account._id, amount: 50, transactionDate: "2026-10-03" }))).status, "success");
  assert.equal(Number(account.currentBalance.toString()), 1050);
  assert.equal((await action(form({ kind: "debt", name: "Personal loan", lender: "Bank", originalPrincipal: 500, currentPrincipal: "", interestRate: 10 }))).status, "success");
  const debt = store.rows("debts")[0]; assert.equal(Number(debt.currentPrincipal.toString()), 500);
  assert.equal((await action(form({ kind: "payment", debtId: debt._id, accountId: account._id, principalAmount: 100, interestAmount: 10, feeAmount: 5, paymentDate: "2026-10-03" }))).status, "success");
  assert.equal(Number(store.rows("accounts")[0].currentBalance.toString()), 935); assert.equal(Number(store.rows("debts")[0].currentPrincipal.toString()), 400); assert.equal(store.rows("debtPayments").length, 1);
  assert.equal((await action(form({ kind: "bill", name: "Internet", amount: 100, dueDate: "2026-10-03" }))).status, "success");
  assert.equal((await action(form({ kind: "goal", name: "Vacation", targetAmount: 500, currentAmount: 50 }))).status, "success");
  assert.equal(Number(store.rows("accounts")[0].currentBalance.toString()), 935);
});

test("create failures leave data intact and return no raw database details", async () => {
  const store = memory(); store.failOn("accounts", "insertOne");
  const result = await loader(store).load("app/actions/finance.ts").createFinanceRecordAction(form({ kind: "account", name: "Checking" }));
  assert.equal(result.status, "error"); assert.equal(result.message.includes("Injected"), false); assert.equal(store.rows("accounts").length, 0);
});
