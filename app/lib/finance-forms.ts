import { z } from "zod";
import { recordFields, recordSchemas, type RecordField, type RecordKind } from "./record-management";
import { validDate } from "./finance-list";

export type FinanceCreateKind = RecordKind | "payment";
const identifier = z.string().regex(/^[a-f0-9]{24}$/i, "Choose a valid record.");
const amount = z.preprocess(value => Number(String(value ?? "0") || "0"), z.number().finite().min(0, "Amount cannot be negative.").max(1e12)).transform(value => Math.round(value * 100) / 100);
const date = z.string().refine(value => validDate(value), "Choose a valid date.");
export const financeCreateSchemas = {
  ...recordSchemas,
  transaction: recordSchemas.transaction.extend({ accountId: identifier, transactionDate: date }).superRefine((value, context) => {
    if (value.type === "debt_payment") context.addIssue({ code: "custom", path: ["type"], message: "Use Record payment in the Debt section." });
    if (value.type === "transfer" && !/^[a-f0-9]{24}$/i.test(value.toAccountId)) context.addIssue({ code: "custom", path: ["toAccountId"], message: "Choose a destination account." });
    if (value.type === "transfer" && value.toAccountId === value.accountId) context.addIssue({ code: "custom", path: ["toAccountId"], message: "Choose a different destination account." });
  }),
  bill: recordSchemas.bill.extend({ dueDate: date }),
  payment: z.object({ debtId: identifier, accountId: identifier, principalAmount: amount, interestAmount: amount, feeAmount: amount, paymentDate: date }).refine(value => value.principalAmount + value.interestAmount + value.feeAmount > 0, { path: ["principalAmount"], message: "The payment total must be greater than zero." }),
};

export function createFields(kind: FinanceCreateKind): RecordField[] {
  if (kind === "payment") return [
    { name: "debtId", label: "Debt" }, { name: "accountId", label: "Payment account" },
    { name: "principalAmount", label: "Principal", type: "number" }, { name: "interestAmount", label: "Interest", type: "number" },
    { name: "feeAmount", label: "Fees", type: "number" }, { name: "paymentDate", label: "Payment date", type: "date" },
  ];
  return recordFields(kind).filter(field => !(kind === "bill" && field.name === "status"));
}
export function createDefaults(kind: FinanceCreateKind, debtId = ""): Record<string, string> {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const values: Record<string, string> = { principal: "0", interest: "0", fee: "0", status: "upcoming", toAccountId: "", merchant: "", description: "", tags: "" };
  for (const field of createFields(kind)) values[field.name] = field.options?.[0]?.value ?? (field.type === "number" ? "0" : "");
  for (const field of ["transactionDate", "paymentDate", "dueDate", "startDate"]) if (field in values) values[field] = today;
  if (kind === "debt") values.currentPrincipal = "";
  if (kind === "payment") values.debtId = debtId;
  return values;
}
export function createInput(kind: FinanceCreateKind, values: Record<string, unknown>) {
  return kind === "debt" ? { ...values, currentPrincipal: values.currentPrincipal === "" ? values.originalPrincipal : values.currentPrincipal } : values;
}
