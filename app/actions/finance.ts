"use server";

import { ObjectId, type ClientSession } from "mongodb";
import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/app/lib/data";
import { decimalToNumber, toDecimal } from "@/app/lib/money";
import { recordCollections, recordKinds, recordSchemas } from "@/app/lib/record-management";
import { applyLedgerEffects, FinanceMutationError } from "@/app/lib/ledger-effects";
import type { ActionResult } from "@/app/lib/user-lifecycle";
import { createDefaults, createInput, financeCreateSchemas, type FinanceCreateKind } from "@/app/lib/finance-forms";
import {
  ensureFinanceIndexes,
  getDb,
  getMongoClient,
  type AccountDoc,
  type BillDoc,
  type DebtDoc,
  type DebtPaymentDoc,
  type SavingsGoalDoc,
  type TransactionDoc,
} from "@/app/lib/mongodb";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalText(formData: FormData, key: string) {
  return text(formData, key) || undefined;
}

function objectId(value: string, label: string) {
  if (!ObjectId.isValid(value)) {
    throw new FinanceMutationError(`${label} is invalid.`);
  }

  return new ObjectId(value);
}

function dateValue(value: string | undefined, fallback = new Date()) {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Date is invalid.");
  }

  return date;
}

function moneyDelta(value: number) {
  return toDecimal(value);
}

function revalidateFinance() {
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  revalidatePath("/transactions");
  revalidatePath("/debts");
  revalidatePath("/bills");
  revalidatePath("/goals");
  revalidatePath("/planning");
  revalidatePath("/admin");
}

export async function createFinanceRecordAction(formData: FormData): Promise<ActionResult> {
  await requireCurrentUser();
  const kind = text(formData, "kind") as FinanceCreateKind;
  if (!Object.prototype.hasOwnProperty.call(financeCreateSchemas, kind)) return { status: "error", message: "Choose a valid record type." };
  const input = createInput(kind, { ...createDefaults(kind), ...Object.fromEntries(formData) });
  const parsed = financeCreateSchemas[kind].safeParse(input);
  if (!parsed.success) return { status: "error", message: "Please check the highlighted fields.", errors: parsed.error.flatten().fieldErrors };
  const validated = new FormData();
  for (const [key, value] of Object.entries(parsed.data)) validated.set(key, String(value));
  const actions = { account: createAccountAction, transaction: createTransactionAction, debt: createDebtAction, payment: recordDebtPaymentAction, bill: createBillAction, goal: createSavingsGoalAction };
  try {
    await actions[kind](validated);
    return { status: "success", message: kind === "payment" ? "Payment recorded." : "Record created." };
  } catch (error) {
    const known = ["Debt not found.", "Payment account not found.", "Principal cannot exceed the remaining debt balance.", "Debt payment must be greater than zero."];
    return { status: "error", message: error instanceof FinanceMutationError || (error instanceof Error && known.includes(error.message)) ? (error as Error).message : "Couldn't save the record. Please try again." };
  }
}

async function requireFinanceContext() {
  const user = await requireCurrentUser();

  await ensureFinanceIndexes();

  const client = await getMongoClient();
  return {
    client,
    db: await getDb(client),
    user,
    userId: new ObjectId(user.id),
  };
}

export async function createAccountAction(formData: FormData) {
  const { db, userId } = await requireFinanceContext();
  const parsed = recordSchemas.account.safeParse({ institution: "", ...Object.fromEntries(formData) });
  if (!parsed.success) throw new FinanceMutationError(parsed.error.issues[0].message);
  const { name, type, institution } = parsed.data;
  const openingBalance = toDecimal(parsed.data.openingBalance);

  const now = new Date();

  await db.collection<AccountDoc>("accounts").insertOne({
    _id: new ObjectId(),
    userId,
    name,
    type,
    institution,
    currency: "INR",
    openingBalance,
    currentBalance: openingBalance,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  revalidateFinance();
}

export async function createTransactionAction(formData: FormData) {
  const { db, userId, client } = await requireFinanceContext();
  const input = Object.fromEntries(formData);
  const parsed = recordSchemas.transaction.safeParse({
    toAccountId: "", transactionDate: "", merchant: "", description: "", tags: "",
    ...input, principal: 0, interest: 0, fee: 0,
  });
  if (!parsed.success) throw new FinanceMutationError(parsed.error.issues[0].message);
  const data = parsed.data;
  if (data.type === "debt_payment") throw new FinanceMutationError("Record debt payments from the Debt section.");
  const now = new Date();
  const transaction: TransactionDoc = {
    _id: new ObjectId(), userId, accountId: objectId(data.accountId, "Account"),
    toAccountId: data.type === "transfer" ? objectId(data.toAccountId, "Destination") : undefined,
    type: data.type, amount: toDecimal(data.amount),
    transactionDate: dateValue(data.transactionDate), merchant: data.merchant,
    description: data.description, tags: data.tags.split(",").map(tag => tag.trim()).filter(Boolean),
    status: "completed", createdAt: now, updatedAt: now,
  };
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      await db.collection<TransactionDoc>("transactions").insertOne(transaction, { session });
      await applyLedgerEffects(db, userId, transaction, 1, session);
    });
  } finally { await session.endSession(); }
  revalidateFinance();
}

export async function createDebtAction(formData: FormData) {
  const { db, userId } = await requireFinanceContext();
  const parsed = recordSchemas.debt.safeParse({ startDate: "", maturityDate: "", nextPaymentDate: "", ...Object.fromEntries(formData), currentPrincipal: text(formData, "currentPrincipal") || text(formData, "originalPrincipal") });
  if (!parsed.success) throw new FinanceMutationError(parsed.error.issues[0].message);
  const data = parsed.data;
  const { name, lender } = data;
  const originalPrincipal = toDecimal(data.originalPrincipal);
  const currentPrincipal = toDecimal(data.currentPrincipal);

  const now = new Date();

  await db.collection<DebtDoc>("debts").insertOne({
    _id: new ObjectId(),
    userId,
    name,
    lender,
    type: data.type,
    originalPrincipal,
    currentPrincipal,
    interestRate: toDecimal(data.interestRate),
    minimumPayment: toDecimal(data.minimumPayment),
    paymentFrequency: "monthly",
    startDate: dateValue(optionalText(formData, "startDate")),
    maturityDate: optionalText(formData, "maturityDate")
      ? dateValue(optionalText(formData, "maturityDate"))
      : undefined,
    nextPaymentDate: optionalText(formData, "nextPaymentDate")
      ? dateValue(optionalText(formData, "nextPaymentDate"))
      : undefined,
    status: decimalToNumber(currentPrincipal) <= 0 ? "paid_off" : "active",
    createdAt: now,
    updatedAt: now,
  });

  revalidateFinance();
}

export async function recordDebtPaymentAction(formData: FormData) {
  const { userId, client, db } = await requireFinanceContext();
  const debtId = objectId(text(formData, "debtId"), "Debt");
  const accountId = objectId(text(formData, "accountId"), "Account");
  const principal = toDecimal(formData.get("principalAmount"));
  const interest = toDecimal(formData.get("interestAmount"));
  const fee = toDecimal(formData.get("feeAmount"));
  const amountNumber =
    decimalToNumber(principal) + decimalToNumber(interest) + decimalToNumber(fee);
  const amount = toDecimal(amountNumber);
  const paymentDate = dateValue(optionalText(formData, "paymentDate"));
  const now = new Date();
  const transactionId = new ObjectId();
  const paymentId = new ObjectId();

  if (amountNumber <= 0 || [principal, interest, fee].some(value => decimalToNumber(value) < 0)) {
    throw new Error("Debt payment must be greater than zero.");
  }

  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const debt = await db.collection<DebtDoc>("debts").findOne(
          { _id: debtId, userId, status: "active" },
          { session },
        );
      const account = await db.collection<AccountDoc>("accounts").findOne(
          { _id: accountId, userId, status: "active" },
          { session },
        );

      if (!debt) {
        throw new Error("Debt not found.");
      }

      if (!account) {
        throw new Error("Payment account not found.");
      }
      if (decimalToNumber(principal) > decimalToNumber(debt.currentPrincipal)) throw new Error("Principal cannot exceed the remaining debt balance.");

      const nextPrincipal = Math.max(
        decimalToNumber(debt.currentPrincipal) - decimalToNumber(principal),
        0,
      );

      await db.collection<TransactionDoc>("transactions").insertOne(
        {
          _id: transactionId,
          userId,
          accountId,
          type: "debt_payment",
          amount,
          relatedEntity: {
            type: "debt",
            id: debtId,
          },
          breakdown: {
            principal,
            interest,
            fee,
          },
          transactionDate: paymentDate,
          description: `${debt.name} payment`,
          tags: ["debt"],
          status: "completed",
          createdAt: now,
          updatedAt: now,
        },
        { session },
      );

      await db.collection<DebtPaymentDoc>("debtPayments").insertOne(
        {
          _id: paymentId,
          userId,
          debtId,
          accountId,
          transactionId,
          amount,
          principalAmount: principal,
          interestAmount: interest,
          feeAmount: fee,
          paymentDate,
          status: "completed",
          createdAt: now,
        },
        { session },
      );

      await db.collection<DebtDoc>("debts").updateOne(
          { _id: debtId, userId },
          {
            $set: {
              currentPrincipal: toDecimal(nextPrincipal),
              status: nextPrincipal <= 0 ? "paid_off" : "active",
              updatedAt: now,
            },
          },
          { session },
        );
      await db.collection<AccountDoc>("accounts").updateOne(
          { _id: accountId, userId },
          {
            $inc: { currentBalance: moneyDelta(-amountNumber) },
            $set: { updatedAt: now },
          },
          { session },
        );
    });
  } finally {
    await session.endSession();
  }

  revalidateFinance();
}

export async function createBillAction(formData: FormData) {
  const { db, userId } = await requireFinanceContext();
  const now = new Date();
  const parsed = recordSchemas.bill.safeParse({ dueDate: "", ...Object.fromEntries(formData), status: "upcoming" });
  if (!parsed.success) throw new FinanceMutationError(parsed.error.issues[0].message);
  const data = parsed.data;

  await db.collection<BillDoc>("bills").insertOne({
    _id: new ObjectId(),
    userId,
    name: data.name,
    type: data.type,
    amount: toDecimal(data.amount),
    dueDate: dateValue(data.dueDate),
    frequency: data.frequency,
    status: "upcoming",
    createdAt: now,
    updatedAt: now,
  });

  revalidateFinance();
}

export async function createSavingsGoalAction(formData: FormData) {
  const { db, userId } = await requireFinanceContext();
  const now = new Date();
  const parsed = recordSchemas.goal.safeParse({ targetDate: "", ...Object.fromEntries(formData) });
  if (!parsed.success) throw new FinanceMutationError(parsed.error.issues[0].message);
  const data = parsed.data;

  await db.collection<SavingsGoalDoc>("savingsGoals").insertOne({
    _id: new ObjectId(),
    userId,
    name: data.name,
    targetAmount: toDecimal(data.targetAmount),
    currentAmount: toDecimal(data.currentAmount),
    targetDate: data.targetDate
      ? dateValue(data.targetDate)
      : undefined,
    status: data.currentAmount >= data.targetAmount ? "completed" : "active",
    createdAt: now,
    updatedAt: now,
  });

  revalidateFinance();
}

function mutationError(error: unknown): ActionResult {
  return { status: "error", message: error instanceof FinanceMutationError ? error.message : "Unable to save this change. Please try again." };
}

async function ownedRecord(db: Awaited<ReturnType<typeof getDb>>, collection: string, id: ObjectId, userId: ObjectId, session: ClientSession) {
  const record = await db.collection(collection).findOne({ _id: id, userId }, { session });
  if (!record) throw new FinanceMutationError("Record not found in your workspace.");
  return record;
}

export async function updateRecordAction(formData: FormData): Promise<ActionResult> {
  try {
    const kind = text(formData, "kind");
    if (!recordKinds.includes(kind as typeof recordKinds[number])) throw new FinanceMutationError("Unknown record type.");
    const id = objectId(text(formData, "id"), "Record");
    const { db, userId, client } = await requireFinanceContext();
    const input = Object.fromEntries(formData);
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        const collection = recordCollections[kind as typeof recordKinds[number]];
        const previous = await ownedRecord(db, collection, id, userId, session);
        const now = new Date();
        if (kind === "account") {
          const parsed = recordSchemas.account.safeParse(input);
          if (!parsed.success) throw new FinanceMutationError(parsed.error.issues[0].message);
          const data = parsed.data;
          await db.collection<AccountDoc>("accounts").updateOne({ _id: id, userId }, {
            $set: { name: data.name, type: data.type, institution: data.institution, openingBalance: toDecimal(data.openingBalance), updatedAt: now },
            $inc: { currentBalance: toDecimal(data.openingBalance - decimalToNumber(previous.openingBalance)) },
          }, { session });
        } else if (kind === "transaction") {
          const old = previous as unknown as TransactionDoc;
          if (old.status !== "completed" || old.reversalOf) throw new FinanceMutationError("Only completed, unreversed entries can be edited.");
          const parsed = recordSchemas.transaction.safeParse({ ...input, amount: old.type === "debt_payment" ? 1 : input.amount });
          if (!parsed.success) throw new FinanceMutationError(parsed.error.issues[0].message);
          const data = parsed.data;
          if ((old.type === "debt_payment") !== (data.type === "debt_payment")) throw new FinanceMutationError("A debt payment cannot be converted to another entry type.");
          if (old.relatedEntity?.type && old.relatedEntity.type !== "debt" && data.type !== old.type) throw new FinanceMutationError("The type of a linked entry cannot be changed.");
          const amount = old.type === "debt_payment" ? data.principal + data.interest + data.fee : data.amount;
          if (amount <= 0) throw new FinanceMutationError("Payment total must be greater than zero.");
          const next: TransactionDoc = {
            ...old, accountId: objectId(data.accountId, "Account"),
            toAccountId: data.type === "transfer" ? objectId(data.toAccountId, "Destination") : undefined,
            type: data.type, amount: toDecimal(amount), transactionDate: dateValue(data.transactionDate),
            merchant: data.merchant, description: data.description,
            tags: data.tags.split(",").map(tag => tag.trim()).filter(Boolean), updatedAt: now,
            breakdown: old.type === "debt_payment" ? { principal: toDecimal(data.principal), interest: toDecimal(data.interest), fee: toDecimal(data.fee) } : old.breakdown,
          };
          await applyLedgerEffects(db, userId, old, -1, session);
          await applyLedgerEffects(db, userId, next, 1, session);
          await db.collection<TransactionDoc>("transactions").replaceOne({ _id: id, userId }, next, { session });
          if (old.type === "debt_payment") {
            const updated = await db.collection<DebtPaymentDoc>("debtPayments").updateOne({ transactionId: id, userId }, { $set: {
              accountId: next.accountId, amount: next.amount, principalAmount: next.breakdown!.principal!,
              interestAmount: next.breakdown!.interest!, feeAmount: next.breakdown!.fee!, paymentDate: next.transactionDate,
            } }, { session });
            if (!updated.matchedCount) throw new FinanceMutationError("Linked payment record is missing. Contact support.");
          }
        } else if (kind === "debt") {
          const parsed = recordSchemas.debt.safeParse(input);
          if (!parsed.success) throw new FinanceMutationError(parsed.error.issues[0].message);
          const data = parsed.data;
          const linked = await db.collection("transactions").findOne({ userId, "relatedEntity.id": id }, { session });
          const payment = await db.collection("debtPayments").findOne({ userId, debtId: id }, { session });
          if ((linked || payment) && (data.originalPrincipal !== decimalToNumber(previous.originalPrincipal) || data.currentPrincipal !== decimalToNumber(previous.currentPrincipal))) throw new FinanceMutationError("Edit or remove linked payments before changing the debt principal.");
          await db.collection<DebtDoc>("debts").updateOne({ _id: id, userId }, { $set: {
            name: data.name, lender: data.lender, type: data.type, originalPrincipal: toDecimal(data.originalPrincipal),
            currentPrincipal: toDecimal(data.currentPrincipal), interestRate: toDecimal(data.interestRate), minimumPayment: toDecimal(data.minimumPayment),
            startDate: dateValue(data.startDate), maturityDate: data.maturityDate ? dateValue(data.maturityDate) : undefined,
            nextPaymentDate: data.nextPaymentDate ? dateValue(data.nextPaymentDate) : undefined,
            status: data.currentPrincipal === 0 ? "paid_off" : "active", updatedAt: now,
          } }, { session });
        } else if (kind === "bill") {
          const parsed = recordSchemas.bill.safeParse(input);
          if (!parsed.success) throw new FinanceMutationError(parsed.error.issues[0].message);
          const data = parsed.data;
          await db.collection<BillDoc>("bills").updateOne({ _id: id, userId }, { $set: { ...data, amount: toDecimal(data.amount), dueDate: dateValue(data.dueDate), updatedAt: now } }, { session });
        } else {
          const parsed = recordSchemas.goal.safeParse(input);
          if (!parsed.success) throw new FinanceMutationError(parsed.error.issues[0].message);
          const data = parsed.data;
          await db.collection<SavingsGoalDoc>("savingsGoals").updateOne({ _id: id, userId }, { $set: {
            name: data.name, targetAmount: toDecimal(data.targetAmount), currentAmount: toDecimal(data.currentAmount),
            targetDate: data.targetDate ? dateValue(data.targetDate) : undefined,
            status: data.currentAmount >= data.targetAmount ? "completed" : "active", updatedAt: now,
          } }, { session });
        }
      });
    } finally { await session.endSession(); }
    revalidateFinance();
    return { status: "success", message: "Record updated." };
  } catch (error) { return mutationError(error); }
}

export async function deleteRecordAction(formData: FormData): Promise<ActionResult> {
  try {
    const kind = text(formData, "kind");
    if (!recordKinds.includes(kind as typeof recordKinds[number])) throw new FinanceMutationError("Unknown record type.");
    const id = objectId(text(formData, "id"), "Record");
    const { db, userId, client } = await requireFinanceContext();
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        const collection = recordCollections[kind as typeof recordKinds[number]];
        const previous = await ownedRecord(db, collection, id, userId, session);
        if (kind === "transaction") {
          const transaction = previous as unknown as TransactionDoc;
          const reversal = await db.collection("transactions").findOne({ userId, reversalOf: id }, { session });
          if (transaction.reversalOf || reversal) throw new FinanceMutationError("Linked reversal entries must be resolved before deletion.");
          if (transaction.status === "completed") await applyLedgerEffects(db, userId, transaction, -1, session);
          await db.collection("debtPayments").deleteMany({ userId, transactionId: id }, { session });
        } else {
          const linked = await db.collection("transactions").findOne({
            userId, ...(kind === "account" ? { $or: [{ accountId: id }, { toAccountId: id }] } : { "relatedEntity.id": id }),
          }, { session });
          const payment = (kind === "account" || kind === "debt") ? await db.collection("debtPayments").findOne({ userId, [kind === "account" ? "accountId" : "debtId"]: id }, { session }) : null;
          const bill = kind === "account" ? await db.collection("bills").findOne({ userId, accountId: id }, { session }) : null;
          if (linked || payment || bill) throw new FinanceMutationError("Remove related transactions or payments and unlink any bills before deleting this record.");
        }
        await db.collection(collection).deleteOne({ _id: id, userId }, { session });
      });
    } finally { await session.endSession(); }
    revalidateFinance();
    return { status: "success", message: "Record removed. Related balances have been updated." };
  } catch (error) { return mutationError(error); }
}
