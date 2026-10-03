import type { ClientSession, Db, ObjectId } from "mongodb";
import type { AccountDoc, DebtDoc, TransactionDoc } from "./mongodb";
import { decimalToNumber, toDecimal } from "./money";

export class FinanceMutationError extends Error {}

export function accountDeltas(transaction: Pick<TransactionDoc, "accountId" | "toAccountId" | "type" | "amount">, direction: 1 | -1) {
  const amount = decimalToNumber(transaction.amount);
  const deltas = [{ accountId: transaction.accountId, amount: (transaction.type === "income" || transaction.type === "refund" ? amount : -amount) * direction }];
  if (transaction.type === "transfer") {
    if (!transaction.toAccountId || transaction.toAccountId.equals(transaction.accountId)) throw new FinanceMutationError("Choose a different destination account for transfers.");
    deltas.push({ accountId: transaction.toAccountId, amount: amount * direction });
  }
  return deltas;
}

// Applying and undoing a movement share the same signed effects, inside the caller's transaction.
export async function applyLedgerEffects(db: Db, userId: ObjectId, transaction: TransactionDoc, direction: 1 | -1, session: ClientSession) {
  for (const delta of accountDeltas(transaction, direction)) {
    const result = await db.collection<AccountDoc>("accounts").updateOne({ _id: delta.accountId, userId, ...(direction === 1 ? { status: "active" as const } : {}) }, { $inc: { currentBalance: toDecimal(delta.amount) }, $set: { updatedAt: new Date() } }, { session });
    if (!result.matchedCount) throw new FinanceMutationError("A related account is unavailable. No changes were saved.");
  }
  if (transaction.type === "debt_payment") {
    const debtId = transaction.relatedEntity?.type === "debt" ? transaction.relatedEntity.id : undefined;
    if (!debtId) throw new FinanceMutationError("This payment has no linked debt.");
    const debt = await db.collection<DebtDoc>("debts").findOne({ _id: debtId, userId }, { session });
    if (!debt) throw new FinanceMutationError("The linked debt is unavailable.");
    const principal = decimalToNumber(transaction.breakdown?.principal);
    const next = Math.round((decimalToNumber(debt.currentPrincipal) - principal * direction) * 100) / 100;
    if (next < 0 || next > decimalToNumber(debt.originalPrincipal)) throw new FinanceMutationError("The principal would exceed the debt balance. Check the payment and debt amounts.");
    await db.collection<DebtDoc>("debts").updateOne({ _id: debtId, userId }, { $set: { currentPrincipal: toDecimal(next), status: next === 0 ? "paid_off" : "active", updatedAt: new Date() } }, { session });
  }
}
