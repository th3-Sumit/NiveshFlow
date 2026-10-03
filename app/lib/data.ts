import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";
import { cache } from "react";
import { decimalToNumber } from "./money";
import {
  ensureFinanceIndexes,
  getDb,
  type AccountDoc,
  type BillDoc,
  type DebtDoc,
  type DebtPaymentDoc,
  type SavingsGoalDoc,
  type TransactionDoc,
  type UserDoc,
} from "./mongodb";
import { readSession } from "./session";
import { canAccessAccount } from "./user-lifecycle";

export type UserSafe = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserDoc["role"];
  avatarUrl?: string;
  createdAt: string;
  lastLoginAt?: string;
};

function toSafeUser(user: UserDoc): UserSafe {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString(),
  };
}

export const getCurrentUser = cache(async () => {
  const session = await readSession();

  if (!session?.userId || !ObjectId.isValid(session.userId)) {
    return null;
  }

  const db = await getDb();
  const user = await db.collection<UserDoc>("users").findOne({
    _id: new ObjectId(session.userId),
  });

  return user && canAccessAccount(user, session.authVersion ?? 0) ? toSafeUser(user) : null;
});

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireSuperAdmin() {
  const user = await requireCurrentUser();

  if (user.role !== "super_admin") {
    redirect("/dashboard");
  }

  return user;
}

export async function getAdminUsers() {
  await requireSuperAdmin();

  const db = await getDb();
  const users = await db
    .collection<UserDoc>("users")
    .find({})
    .sort({ createdAt: -1 })
    .limit(12)
    .toArray();

  return users.map(toSafeUser);
}

export async function getAdminStats() {
  await requireSuperAdmin();

  const db = await getDb();
  const [
    totalUsers,
    admins,
    recentUsers,
    accounts,
    transactions,
    debts,
    bills,
  ] = await Promise.all([
    db.collection<UserDoc>("users").countDocuments(),
    db.collection<UserDoc>("users").countDocuments({ role: "super_admin" }),
    db.collection<UserDoc>("users").countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    }),
    db.collection<AccountDoc>("accounts").countDocuments({ status: "active" }),
    db
      .collection<TransactionDoc>("transactions")
      .countDocuments({ status: "completed" }),
    db.collection<DebtDoc>("debts").countDocuments({ status: "active" }),
    db.collection<BillDoc>("bills").countDocuments({ status: "upcoming" }),
  ]);

  return {
    accounts,
    totalUsers,
    admins,
    bills,
    debts,
    recentUsers,
    transactions,
  };
}

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return { end, start };
}

export function accountView(account: AccountDoc) {
  return {
    id: account._id.toString(),
    name: account.name,
    type: account.type,
    institution: account.institution,
    currency: account.currency,
    openingBalance: decimalToNumber(account.openingBalance),
    currentBalance: decimalToNumber(account.currentBalance),
    status: account.status,
    createdAt: account.createdAt.toISOString(),
  };
}

export function transactionView(transaction: TransactionDoc) {
  return {
    id: transaction._id.toString(),
    accountId: transaction.accountId.toString(),
    toAccountId: transaction.toAccountId?.toString(),
    type: transaction.type,
    amount: decimalToNumber(transaction.amount),
    principal: decimalToNumber(transaction.breakdown?.principal),
    interest: decimalToNumber(transaction.breakdown?.interest),
    fee: decimalToNumber(transaction.breakdown?.fee),
    transactionDate: transaction.transactionDate.toISOString(),
    merchant: transaction.merchant,
    description: transaction.description,
    status: transaction.status,
    tags: transaction.tags,
  };
}

export function debtView(debt: DebtDoc) {
  const originalPrincipal = decimalToNumber(debt.originalPrincipal);
  const currentPrincipal = decimalToNumber(debt.currentPrincipal);
  const paidPercent =
    originalPrincipal > 0
      ? Math.min(((originalPrincipal - currentPrincipal) / originalPrincipal) * 100, 100)
      : 0;

  return {
    id: debt._id.toString(),
    name: debt.name,
    lender: debt.lender,
    type: debt.type,
    originalPrincipal,
    currentPrincipal,
    interestRate: decimalToNumber(debt.interestRate),
    minimumPayment: decimalToNumber(debt.minimumPayment),
    startDate: debt.startDate.toISOString(),
    maturityDate: debt.maturityDate?.toISOString(),
    nextPaymentDate: debt.nextPaymentDate?.toISOString(),
    status: debt.status,
    paidPercent,
  };
}

export function billView(bill: BillDoc) {
  return {
    id: bill._id.toString(),
    name: bill.name,
    type: bill.type,
    amount: decimalToNumber(bill.amount),
    dueDate: bill.dueDate.toISOString(),
    frequency: bill.frequency,
    status: bill.status,
  };
}

export function goalView(goal: SavingsGoalDoc) {
  const targetAmount = decimalToNumber(goal.targetAmount);
  const currentAmount = decimalToNumber(goal.currentAmount);

  return {
    id: goal._id.toString(),
    name: goal.name,
    targetAmount,
    currentAmount,
    targetDate: goal.targetDate?.toISOString(),
    status: goal.status,
    progress: targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0,
  };
}

async function financeCollections() {
  const user = await requireCurrentUser();

  await ensureFinanceIndexes();

  const db = await getDb();
  const userId = new ObjectId(user.id);

  return { db, user, userId };
}

export async function getFinanceDashboard() {
  const { db, user, userId } = await financeCollections();
  const { end, start } = monthRange();
  const next30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const [
    accounts,
    recentTransactions,
    monthTransactions,
    debts,
    upcomingBills,
    savingsGoals,
  ] = await Promise.all([
    db
      .collection<AccountDoc>("accounts")
      .find({ userId, status: "active" })
      .sort({ createdAt: -1 })
      .toArray(),
    db
      .collection<TransactionDoc>("transactions")
      .find({ userId })
      .sort({ transactionDate: -1, createdAt: -1 })
      .limit(8)
      .toArray(),
    db
      .collection<TransactionDoc>("transactions")
      .find({
        userId,
        status: "completed",
        transactionDate: { $gte: start, $lt: end },
      })
      .toArray(),
    db
      .collection<DebtDoc>("debts")
      .find({ userId, status: { $in: ["active", "paid_off"] } })
      .sort({ updatedAt: -1 })
      .toArray(),
    db
      .collection<BillDoc>("bills")
      .find({
        userId,
        dueDate: { $gte: new Date(), $lte: next30Days },
        status: { $in: ["upcoming", "due_soon", "overdue"] },
      })
      .sort({ dueDate: 1 })
      .limit(5)
      .toArray(),
    db
      .collection<SavingsGoalDoc>("savingsGoals")
      .find({ userId, status: "active" })
      .sort({ createdAt: -1 })
      .limit(4)
      .toArray(),
  ]);

  const totalBalance = accounts.reduce(
    (total, account) => total + decimalToNumber(account.currentBalance),
    0,
  );
  const incomeThisMonth = monthTransactions
    .filter((transaction) => transaction.type === "income")
    .reduce((total, transaction) => total + decimalToNumber(transaction.amount), 0);
  const livingExpenses = monthTransactions
    .filter((transaction) =>
      ["expense", "bill_payment", "subscription_payment"].includes(transaction.type),
    )
    .reduce((total, transaction) => total + decimalToNumber(transaction.amount), 0);
  const debtExpense = monthTransactions
    .filter((transaction) => transaction.type === "debt_payment")
    .reduce(
      (total, transaction) =>
        total +
        decimalToNumber(transaction.breakdown?.interest) +
        decimalToNumber(transaction.breakdown?.fee),
      0,
    );
  const debtReduction = monthTransactions
    .filter((transaction) => transaction.type === "debt_payment")
    .reduce(
      (total, transaction) =>
        total + decimalToNumber(transaction.breakdown?.principal),
      0,
    );
  const cashOutflow = monthTransactions
    .filter((transaction) => transaction.type !== "income" && transaction.type !== "refund")
    .reduce((total, transaction) => total + decimalToNumber(transaction.amount), 0);
  const outstandingDebt = debts
    .filter((debt) => debt.status === "active")
    .reduce((total, debt) => total + decimalToNumber(debt.currentPrincipal), 0);
  const savings = savingsGoals.reduce(
    (total, goal) => total + decimalToNumber(goal.currentAmount),
    0,
  );

  return {
    accounts: accounts.map(accountView),
    debts: debts.map(debtView),
    recentTransactions: recentTransactions.map(transactionView),
    savingsGoals: savingsGoals.map(goalView),
    stats: {
      actualExpenses: livingExpenses + debtExpense,
      cashFlow: incomeThisMonth - cashOutflow,
      cashOutflow,
      debtReduction,
      incomeThisMonth,
      netWorth: totalBalance + savings - outstandingDebt,
      outstandingDebt,
      totalBalance,
      upcomingBills: upcomingBills.length,
    },
    upcomingBills: upcomingBills.map(billView),
    user,
  };
}

export async function getAccountsData() {
  const { db, userId } = await financeCollections();
  const accounts = await db
    .collection<AccountDoc>("accounts")
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray();

  return accounts.map(accountView);
}

export async function getTransactionsData() {
  const { db, userId } = await financeCollections();
  const [accounts, transactions] = await Promise.all([
    db
      .collection<AccountDoc>("accounts")
      .find({ userId, status: "active" })
      .sort({ createdAt: -1 })
      .toArray(),
    db
      .collection<TransactionDoc>("transactions")
      .find({ userId })
      .sort({ transactionDate: -1, createdAt: -1 })
      .limit(50)
      .toArray(),
  ]);

  return {
    accounts: accounts.map(accountView),
    transactions: transactions.map(transactionView),
  };
}

export async function getDebtsData() {
  const { db, userId } = await financeCollections();
  const [accounts, debts, payments] = await Promise.all([
    db
      .collection<AccountDoc>("accounts")
      .find({ userId, status: "active" })
      .sort({ createdAt: -1 })
      .toArray(),
    db
      .collection<DebtDoc>("debts")
      .find({ userId })
      .sort({ updatedAt: -1 })
      .toArray(),
    db
      .collection<DebtPaymentDoc>("debtPayments")
      .find({ userId })
      .sort({ paymentDate: -1 })
      .limit(12)
      .toArray(),
  ]);

  return {
    accounts: accounts.map(accountView),
    debts: debts.map(debtView),
    payments: payments.map((payment) => ({
      id: payment._id.toString(),
      transactionId: payment.transactionId.toString(),
      debtId: payment.debtId.toString(),
      accountId: payment.accountId.toString(),
      amount: decimalToNumber(payment.amount),
      principalAmount: decimalToNumber(payment.principalAmount),
      interestAmount: decimalToNumber(payment.interestAmount),
      feeAmount: decimalToNumber(payment.feeAmount),
      paymentDate: payment.paymentDate.toISOString(),
      status: payment.status,
    })),
  };
}

export async function getPlanningData() {
  const { db, userId } = await financeCollections();
  const [bills, goals] = await Promise.all([
    db
      .collection<BillDoc>("bills")
      .find({ userId })
      .sort({ dueDate: 1 })
      .limit(30)
      .toArray(),
    db
      .collection<SavingsGoalDoc>("savingsGoals")
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray(),
  ]);

  return {
    bills: bills.map(billView),
    goals: goals.map(goalView),
  };
}
