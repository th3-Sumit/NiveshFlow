import { Decimal128, MongoClient, ObjectId } from "mongodb";
import type { SupportAttachment, SupportFormValues, SupportStatus } from "./support";
import type { LeadStage } from "./user-lifecycle";

const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
  throw new Error("MONGO_URI is required.");
}

const uri = mongoUri;

declare global {
  var mongoClientPromise: Promise<MongoClient> | undefined;
}

function databaseNameFromUri(connectionUri: string) {
  try {
    const parsed = new URL(connectionUri);
    const database = parsed.pathname.replace("/", "").trim();

    return database || "finance_management";
  } catch {
    return "finance_management";
  }
}

function getClientPromise() {
  if (global.mongoClientPromise) {
    return global.mongoClientPromise;
  }

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10_000,
  });
  const clientPromise = client.connect().catch((error) => {
    global.mongoClientPromise = undefined;
    throw error;
  });

  global.mongoClientPromise = clientPromise;

  return clientPromise;
}

export async function getMongoClient() {
  return getClientPromise();
}

export async function getDb(client?: MongoClient) {
  const connectedClient = client ?? await getClientPromise();

  return connectedClient.db(databaseNameFromUri(uri));
}

export type UserRole = "user" | "super_admin";

export type SupportRequestDoc = SupportFormValues & {
  _id: ObjectId;
  userId: ObjectId;
  user: { name: string; email: string; phone: string; avatarUrl?: string };
  status: SupportStatus;
  attachments: SupportAttachment[];
  response?: string;
  handledBy?: ObjectId;
  emailChange?: { previous: string; next: string; changedAt: Date; changedBy: ObjectId };
  createdAt: Date;
  updatedAt: Date;
};

export type UserDoc = {
  _id: ObjectId;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  passwordHash?: string;
  status?: "active" | "disabled" | "invited";
  authVersion?: number;
  activatedAt?: Date;
  invitation?: { tokenHash: string; expiresAt: Date; delivery: "pending" | "sent" | "failed"; sentAt?: Date; invitedBy: ObjectId };
  avatarUrl?: string;
  avatarPublicId?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
};

export type LeadDoc = {
  _id: ObjectId; name: string; email: string; phone: string; source: string; notes: string; stage: LeadStage;
  userId?: ObjectId; createdBy: ObjectId; createdAt: Date; updatedAt: Date;
};
export type DeletionChallengeDoc = { _id: ObjectId; userId: ObjectId; challengeHash: string; expiresAt: Date; attempts: number; createdAt: Date };
export type DeletionFeedbackDoc = { _id: ObjectId; reason: string; feedback: string; createdAt: Date };
export type MailJobDoc = { _id: ObjectId; to: string; subject: string; text: string; attempts: number; leaseToken?: ObjectId; leaseUntil?: Date; createdAt: Date };
export type MediaCleanupDoc = { _id: ObjectId; assets: Array<{ publicId: string; resourceType: "image" | "raw"; deliveryType: "upload" | "authenticated" }>; leaseToken?: ObjectId; leaseUntil?: Date; createdAt: Date };

export type OtpPurpose = "login" | "password_reset";

export type OtpDoc = {
  _id: ObjectId;
  userId: ObjectId;
  identifier: string;
  purpose: OtpPurpose;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt?: Date;
  createdAt: Date;
};

export type PasswordResetTokenDoc = {
  _id: ObjectId;
  userId: ObjectId;
  tokenHash: string;
  expiresAt: Date;
  consumedAt?: Date;
  createdAt: Date;
};

export type AccountType =
  | "cash"
  | "checking"
  | "savings"
  | "credit_card"
  | "digital_wallet"
  | "investment"
  | "custom";

export type AccountDoc = {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  type: AccountType;
  institution?: string;
  currency: string;
  openingBalance: Decimal128;
  currentBalance: Decimal128;
  status: "active" | "archived";
  createdAt: Date;
  updatedAt: Date;
};

export type CategoryType = "income" | "expense" | "debt" | "bill" | "savings";

export type CategoryDoc = {
  _id: ObjectId;
  userId?: ObjectId;
  name: string;
  type: CategoryType;
  parentId?: ObjectId;
  color?: string;
  icon?: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type TransactionType =
  | "income"
  | "expense"
  | "transfer"
  | "debt_payment"
  | "bill_payment"
  | "subscription_payment"
  | "refund"
  | "savings_contribution"
  | "investment"
  | "adjustment";

export type TransactionDoc = {
  _id: ObjectId;
  userId: ObjectId;
  accountId: ObjectId;
  toAccountId?: ObjectId;
  type: TransactionType;
  amount: Decimal128;
  categoryId?: ObjectId;
  relatedEntity?: {
    type: "debt" | "bill" | "subscription" | "goal" | null;
    id?: ObjectId;
  };
  breakdown?: {
    principal?: Decimal128;
    interest?: Decimal128;
    fee?: Decimal128;
  };
  transactionDate: Date;
  merchant?: string;
  description?: string;
  tags: string[];
  status: "completed" | "pending" | "reversed";
  reversalOf?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type DebtType =
  | "personal_loan"
  | "auto_loan"
  | "home_loan"
  | "student_loan"
  | "credit_card"
  | "family_friend"
  | "custom";

export type DebtDoc = {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  lender: string;
  type: DebtType;
  originalPrincipal: Decimal128;
  currentPrincipal: Decimal128;
  interestRate: Decimal128;
  minimumPayment: Decimal128;
  paymentFrequency: "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
  startDate: Date;
  maturityDate?: Date;
  nextPaymentDate?: Date;
  status: "active" | "paid_off" | "archived";
  createdAt: Date;
  updatedAt: Date;
};

export type DebtPaymentDoc = {
  _id: ObjectId;
  userId: ObjectId;
  debtId: ObjectId;
  accountId: ObjectId;
  transactionId: ObjectId;
  amount: Decimal128;
  principalAmount: Decimal128;
  interestAmount: Decimal128;
  feeAmount: Decimal128;
  paymentDate: Date;
  status: "completed" | "reversed";
  createdAt: Date;
};

export type BillDoc = {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  type: "bill" | "subscription";
  amount: Decimal128;
  dueDate: Date;
  frequency: "once" | "weekly" | "monthly" | "quarterly" | "yearly";
  categoryId?: ObjectId;
  accountId?: ObjectId;
  status: "upcoming" | "due_soon" | "paid" | "overdue";
  createdAt: Date;
  updatedAt: Date;
};

export type BudgetDoc = {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  categoryId?: ObjectId;
  month: string;
  amount: Decimal128;
  threshold: number;
  createdAt: Date;
  updatedAt: Date;
};

export type SavingsGoalDoc = {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  targetAmount: Decimal128;
  currentAmount: Decimal128;
  targetDate?: Date;
  status: "active" | "completed" | "archived";
  createdAt: Date;
  updatedAt: Date;
};

let indexesReady = false;
let financeIndexesReady = false;
let supportIndexesReady = false;
let lifecycleIndexesReady = false;

export async function ensureLifecycleIndexes() {
  if (lifecycleIndexesReady) return;
  const db = await getDb();
  await Promise.all([
    db.collection<UserDoc>("users").createIndex({ "invitation.tokenHash": 1 }, { unique: true, sparse: true }),
    db.collection<UserDoc>("users").createIndex({ status: 1, "invitation.expiresAt": 1 }),
    db.collection<LeadDoc>("leads").createIndex({ email: 1 }, { unique: true }),
    db.collection<DeletionChallengeDoc>("deletionChallenges").createIndex({ userId: 1 }, { unique: true }),
    db.collection<DeletionChallengeDoc>("deletionChallenges").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection<DeletionFeedbackDoc>("deletionFeedback").createIndex({ createdAt: -1 }),
  ]);
  lifecycleIndexesReady = true;
}

export async function ensureSupportIndexes() {
  if (supportIndexesReady) return;
  const db = await getDb();
  await Promise.all([
    db.collection<SupportRequestDoc>("supportRequests").createIndex({ userId: 1, createdAt: -1 }),
    db.collection<SupportRequestDoc>("supportRequests").createIndex({ status: 1, priority: 1, createdAt: -1 }),
  ]);
  supportIndexesReady = true;
}

export async function ensureAuthIndexes() {
  if (indexesReady) {
    return;
  }

  const db = await getDb();

  await Promise.all([
    db.collection<UserDoc>("users").createIndex({ email: 1 }, { unique: true }),
    db.collection<UserDoc>("users").createIndex({ phone: 1 }, { unique: true }),
    db
      .collection<OtpDoc>("otps")
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection<OtpDoc>("otps").createIndex({
      userId: 1,
      purpose: 1,
      consumedAt: 1,
    }),
    db
      .collection<PasswordResetTokenDoc>("passwordResetTokens")
      .createIndex({ tokenHash: 1 }, { unique: true }),
    db
      .collection<PasswordResetTokenDoc>("passwordResetTokens")
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);

  indexesReady = true;
}

export async function ensureFinanceIndexes() {
  if (financeIndexesReady) {
    return;
  }

  const db = await getDb();

  await Promise.all([
    db.collection<AccountDoc>("accounts").createIndex({ userId: 1, status: 1 }),
    db.collection<AccountDoc>("accounts").createIndex({ userId: 1, name: 1 }),
    db.collection<CategoryDoc>("categories").createIndex({
      userId: 1,
      type: 1,
      name: 1,
    }),
    db.collection<TransactionDoc>("transactions").createIndex({
      userId: 1,
      transactionDate: -1,
    }),
    db.collection<TransactionDoc>("transactions").createIndex({
      userId: 1,
      accountId: 1,
      status: 1,
    }),
    db.collection<TransactionDoc>("transactions").createIndex({
      userId: 1,
      type: 1,
      transactionDate: -1,
    }),
    db.collection<DebtDoc>("debts").createIndex({ userId: 1, status: 1 }),
    db
      .collection<DebtPaymentDoc>("debtPayments")
      .createIndex({ userId: 1, debtId: 1, paymentDate: -1 }),
    db.collection<BillDoc>("bills").createIndex({ userId: 1, dueDate: 1 }),
    db.collection<BudgetDoc>("budgets").createIndex({ userId: 1, month: 1 }),
    db
      .collection<SavingsGoalDoc>("savingsGoals")
      .createIndex({ userId: 1, status: 1 }),
  ]);

  financeIndexesReady = true;
}
