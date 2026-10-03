import "server-only";
import { ObjectId, type Document, type Sort } from "mongodb";
import { requireCurrentUser, accountView, transactionView, debtView, billView, goalView } from "./data";
import { ensureFinanceIndexes, getDb, type AccountDoc, type TransactionDoc, type DebtDoc, type DebtPaymentDoc, type BillDoc, type SavingsGoalDoc } from "./mongodb";
import { decimalToNumber } from "./money";
import { normalizeFinanceQuery, type FinanceView, type FinanceSearchParams, type FinanceQuery, type FinanceList, type FinanceOption } from "./finance-list";

const collections = { account: "accounts", transaction: "transactions", debt: "debts", payment: "transactions", bill: "bills", goal: "savingsGoals" } as const;
const dateFields = { account: "createdAt", transaction: "transactionDate", debt: "nextPaymentDate", payment: "transactionDate", bill: "dueDate", goal: "targetDate" } as const;
const sumFields = { account: ["currentBalance", "openingBalance"], transaction: ["amount", ""], debt: ["currentPrincipal", "originalPrincipal"], payment: ["amount", "breakdown.principal"], bill: ["amount", ""], goal: ["currentAmount", "targetAmount"] } as const;

export function buildFinanceFilter(view: FinanceView, query: FinanceQuery, userId: ObjectId): Document {
  const filter: Document = { userId };
  if (view === "payment") filter.type = "debt_payment";
  else if (query.type) filter.type = query.type;
  if (query.status) filter.status = query.status;
  if (query.account) filter.$and = [{ $or: [{ accountId: new ObjectId(query.account) }, { toAccountId: new ObjectId(query.account) }] }];
  if (query.debt) { filter["relatedEntity.type"] = "debt"; filter["relatedEntity.id"] = new ObjectId(query.debt); }
  if (query.frequency) filter.frequency = query.frequency;
  if (query.q) {
    const search = query.q.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&");
    const fields = view === "account" ? ["name", "institution"] : ["transaction", "payment"].includes(view) ? ["description", "merchant", "tags"] : view === "debt" ? ["name", "lender"] : ["name"];
    filter.$or = fields.map(field => ({ [field]: { $regex: search, $options: "i" } }));
  }
  if (query.from || query.to) {
    const range: Document = {};
    if (query.from) range.$gte = new Date(query.from + "T00:00:00.000Z");
    if (query.to) { const end = new Date(query.to + "T00:00:00.000Z"); end.setUTCDate(end.getUTCDate() + 1); range.$lt = end; }
    filter[dateFields[view]] = range;
  }
  return filter;
}
export function financeSort(view: FinanceView, query: FinanceQuery): Sort {
  const amount = sumFields[view][0];
  if (query.sort === "name") return { name: 1, _id: 1 };
  if (query.sort.endsWith("_high")) return { [amount]: -1, _id: -1 };
  if (query.sort.endsWith("_low")) return { [amount]: 1, _id: 1 };
  if (query.sort === "due_soon") return { [dateFields[view]]: 1, _id: 1 };
  const field = ["transaction", "payment"].includes(view) ? "transactionDate" : "createdAt";
  return { [field]: query.sort === "oldest" ? 1 : -1, _id: query.sort === "oldest" ? 1 : -1 };
}

export async function getFinanceList(view: FinanceView, params: FinanceSearchParams): Promise<FinanceList> {
  const user = await requireCurrentUser();
  await ensureFinanceIndexes();
  const db = await getDb(), userId = new ObjectId(user.id);
  const query = normalizeFinanceQuery(view, params);
  const filter = buildFinanceFilter(view, query, userId);
  const collection = db.collection(collections[view]);
  const [total, totals] = await Promise.all([
    collection.countDocuments(filter),
    collection.aggregate<{ sum: unknown; sum2: unknown }>([
      { $match: filter }, { $group: { _id: null, sum: { $sum: "$" + sumFields[view][0] }, sum2: { $sum: sumFields[view][1] ? "$" + sumFields[view][1] : 0 } } },
    ]).toArray(),
  ]);
  const pages = Math.max(1, Math.ceil(total / query.size)), page = Math.min(query.page, pages);
  const documents = await collection.find(filter).sort(financeSort(view, query)).skip((page - 1) * query.size).limit(query.size).toArray();
  let hasPayments = new Set<string>();
  if (view === "debt" && documents.length) {
    const ids = documents.map(record => record._id);
    const linked = await db.collection<DebtPaymentDoc>("debtPayments").find({ userId, debtId: { $in: ids } }, { projection: { debtId: 1 } }).toArray();
    hasPayments = new Set(linked.map(payment => payment.debtId.toString()));
  }
  const rows = documents.map(record => {
    switch (view) {
      case "account": return accountView(record as AccountDoc);
      case "transaction": case "payment": return { ...transactionView(record as TransactionDoc), debtId: record.relatedEntity?.type === "debt" ? record.relatedEntity.id?.toString() : undefined };
      case "debt": return { ...debtView(record as DebtDoc), hasPayments: hasPayments.has(record._id.toString()) };
      case "bill": return billView(record as BillDoc);
      case "goal": return goalView(record as SavingsGoalDoc);
    }
  });
  return { rows, total, page, pages, size: query.size, sum: decimalToNumber(totals[0]?.sum as Parameters<typeof decimalToNumber>[0]), sum2: decimalToNumber(totals[0]?.sum2 as Parameters<typeof decimalToNumber>[0]), query: { ...query, page } };
}

export async function getFinanceOptions(includeDebts = false): Promise<{ accounts: FinanceOption[]; debts: FinanceOption[] }> {
  const user = await requireCurrentUser(); const db = await getDb(); const userId = new ObjectId(user.id);
  const accounts = await db.collection<AccountDoc>("accounts").find({ userId }, { projection: { name: 1, status: 1 } }).sort({ name: 1, _id: 1 }).toArray();
  const debts = includeDebts ? await db.collection<DebtDoc>("debts").find({ userId }, { projection: { name: 1, status: 1, currentPrincipal: 1 } }).sort({ name: 1, _id: 1 }).toArray() : [];
  return { accounts: accounts.map(record => ({ id: record._id.toString(), name: record.name, status: record.status })), debts: debts.map(record => ({ id: record._id.toString(), name: record.name, status: record.status, currentPrincipal: decimalToNumber(record.currentPrincipal) })) };
}
