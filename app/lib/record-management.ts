import { z } from "zod";

export const accountTypes = ["cash", "checking", "savings", "credit_card", "digital_wallet", "investment", "custom"] as const;
export const debtTypes = ["personal_loan", "auto_loan", "home_loan", "student_loan", "credit_card", "family_friend", "custom"] as const;
export const transactionTypes = ["income", "expense", "transfer", "refund", "bill_payment", "subscription_payment", "savings_contribution", "investment", "adjustment", "debt_payment"] as const;
export const recordKinds = ["account", "transaction", "debt", "bill", "goal"] as const;
export type RecordKind = (typeof recordKinds)[number];
export const recordCollections = { account: "accounts", transaction: "transactions", debt: "debts", bill: "bills", goal: "savingsGoals" } as const;
const amount = z.preprocess(value => Number(String(value ?? "0").replace(/,/g, "") || "0"), z.number().finite().min(0).max(1e12)).transform(value => Math.round(value * 100) / 100);
const signedAmount = z.preprocess(value => Number(String(value ?? "0").replace(/,/g, "") || "0"), z.number().finite().min(-1e12).max(1e12)).transform(value => Math.round(value * 100) / 100);
const date = z.string().refine(value => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime()) && new Date(value).toISOString().slice(0, 10) === value), "Choose a valid date.");
const name = z.string().trim().min(2, "Enter at least 2 characters.").max(100, "Use no more than 100 characters.");
export const recordSchemas = {
  account: z.object({ name, type: z.enum(accountTypes), institution: z.string().trim().max(100), openingBalance: signedAmount }),
  transaction: z.object({ accountId: z.string(), toAccountId: z.string(), type: z.enum(transactionTypes), amount: amount.refine(value => value > 0, "Amount must be greater than zero."), transactionDate: date, merchant: z.string().trim().max(120), description: z.string().trim().max(2000), tags: z.string().trim().max(1000), principal: amount, interest: amount, fee: amount }),
  debt: z.object({ name, lender: name, type: z.enum(debtTypes), originalPrincipal: amount, currentPrincipal: amount, interestRate: amount.refine(value => value <= 100, "Interest rate must be at most 100%."), minimumPayment: amount, startDate: date, maturityDate: date, nextPaymentDate: date }).refine(value => value.currentPrincipal <= value.originalPrincipal, { message: "Current principal cannot exceed original principal.", path: ["currentPrincipal"] }),
  bill: z.object({ name, type: z.enum(["bill", "subscription"]), amount: amount.refine(value => value > 0, "Amount must be greater than zero."), dueDate: date, frequency: z.enum(["once", "weekly", "monthly", "quarterly", "yearly"]), status: z.enum(["upcoming", "due_soon", "paid", "overdue"]) }),
  goal: z.object({ name, targetAmount: amount.refine(value => value > 0, "Target amount must be greater than zero."), currentAmount: amount, targetDate: date }),
};
export type RecordField = { name: string; label: string; type?: "number" | "date" | "textarea"; options?: Array<{ value: string; label: string }>; readOnly?: boolean };
const options = (values: readonly string[]) => values.map(value => ({ value, label: value.replaceAll("_", " ") }));
export function recordFields(kind: RecordKind, isDebtPayment = false): RecordField[] {
  const named: RecordField = { name: "name", label: "Name" };
  switch (kind) {
    case "account": return [named, { name: "type", label: "Type", options: options(accountTypes) }, { name: "institution", label: "Institution" }, { name: "openingBalance", label: "Opening balance", type: "number" }];
    case "transaction": return [{ name: "accountId", label: "Account" }, { name: "type", label: "Type", options: options(isDebtPayment ? ["debt_payment"] : transactionTypes.filter(type => type !== "debt_payment")), readOnly: isDebtPayment }, ...(!isDebtPayment ? [{ name: "toAccountId", label: "Transfer destination" }, { name: "amount", label: "Amount", type: "number" as const }] : [{ name: "principal", label: "Principal", type: "number" as const }, { name: "interest", label: "Interest", type: "number" as const }, { name: "fee", label: "Fees", type: "number" as const }]), { name: "transactionDate", label: "Date", type: "date" }, { name: "merchant", label: "Merchant / payee" }, { name: "description", label: "Description", type: "textarea" }, { name: "tags", label: "Tags" }];
    case "debt": return [named, { name: "lender", label: "Lender" }, { name: "type", label: "Type", options: options(debtTypes) }, ...["originalPrincipal", "currentPrincipal", "interestRate", "minimumPayment"].map((field, index) => ({ name: field, label: ["Original principal", "Current principal", "Interest rate %", "Minimum payment"][index], type: "number" as const })), ...["startDate", "maturityDate", "nextPaymentDate"].map((field, index) => ({ name: field, label: ["Start date", "End date", "Next payment"][index], type: "date" as const }))];
    case "bill": return [named, { name: "type", label: "Type", options: options(["bill", "subscription"]) }, { name: "amount", label: "Amount", type: "number" }, { name: "dueDate", label: "Due date", type: "date" }, { name: "frequency", label: "Frequency", options: options(["once", "weekly", "monthly", "quarterly", "yearly"]) }, { name: "status", label: "Status", options: options(["upcoming", "due_soon", "paid", "overdue"]) }];
    case "goal": return [named, { name: "targetAmount", label: "Target amount", type: "number" }, { name: "currentAmount", label: "Saved amount", type: "number" }, { name: "targetDate", label: "Target date", type: "date" }];
  }
}
