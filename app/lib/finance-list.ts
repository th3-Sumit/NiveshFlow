import { accountTypes, debtTypes, transactionTypes } from "./record-management";

export const financeViews = ["account", "transaction", "debt", "payment", "bill", "goal"] as const;
export type FinanceView = (typeof financeViews)[number];
export type FinanceSearchParams = Record<string, string | string[] | undefined>;
export type FinanceQuery = { q: string; type: string; status: string; account: string; debt: string; frequency: string; from: string; to: string; sort: string; page: number; size: number };
export type FinanceOption = { id: string; name: string; status: string; currentPrincipal?: number };
export type FinanceRow = { id: string; [key: string]: unknown };
export type FinanceList = { rows: FinanceRow[]; total: number; page: number; pages: number; size: number; sum: number; sum2: number; query: FinanceQuery };
export type FilterOption = { value: string; label: string };
const options = (values: readonly string[]): FilterOption[] => values.map(value => ({ value, label: value.replaceAll("_", " ") }));
export const financeConfig = {
  account: { title: "Accounts", singular: "account", search: "Search accounts or institutions", types: options(accountTypes), statuses: options(["active", "archived"]), sorts: options(["newest", "oldest", "name", "balance_high", "balance_low"]), dateLabel: "", sumLabel: "Matching balance", sum2Label: "Opening balance" },
  transaction: { title: "Transactions", singular: "transaction", search: "Search descriptions, merchants or tags", types: options(transactionTypes), statuses: options(["completed", "pending", "reversed"]), sorts: options(["newest", "oldest", "amount_high", "amount_low"]), dateLabel: "Transaction date", sumLabel: "Entry value", sum2Label: "" },
  debt: { title: "Debts", singular: "debt", search: "Search debts or lenders", types: options(debtTypes), statuses: options(["active", "paid_off", "archived"]), sorts: options(["newest", "oldest", "name", "balance_high", "balance_low", "due_soon"]), dateLabel: "Next payment", sumLabel: "Outstanding principal", sum2Label: "Original principal" },
  payment: { title: "Payment history", singular: "payment", search: "Search payment descriptions or merchants", types: [], statuses: options(["completed", "pending", "reversed"]), sorts: options(["newest", "oldest", "amount_high", "amount_low"]), dateLabel: "Payment date", sumLabel: "Payments", sum2Label: "Principal paid" },
  bill: { title: "Bills & subscriptions", singular: "bill", search: "Search bills or subscriptions", types: options(["bill", "subscription"]), statuses: options(["upcoming", "due_soon", "paid", "overdue"]), sorts: options(["due_soon", "newest", "oldest", "name", "amount_high", "amount_low"]), dateLabel: "Due date", sumLabel: "Bill value", sum2Label: "" },
  goal: { title: "Savings goals", singular: "goal", search: "Search savings goals", types: [], statuses: options(["active", "completed", "archived"]), sorts: options(["newest", "oldest", "name", "due_soon", "amount_high", "amount_low"]), dateLabel: "Target date", sumLabel: "Saved", sum2Label: "Target" },
} satisfies Record<FinanceView, { title: string; singular: string; search: string; types: FilterOption[]; statuses: FilterOption[]; sorts: FilterOption[]; dateLabel: string; sumLabel: string; sum2Label: string }>;

function scalar(value: unknown) { return typeof value === "string" ? value : ""; }
export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime()) && new Date(value).toISOString().slice(0, 10) === value;
}
export function normalizeFinanceQuery(view: FinanceView, params: FinanceSearchParams): FinanceQuery {
  const config = financeConfig[view];
  const option = (key: string, values: FilterOption[], fallback = "") => values.some(value => value.value === scalar(params[key])) ? scalar(params[key]) : fallback;
  const identifier = (key: string) => /^[a-f0-9]{24}$/i.test(scalar(params[key])) ? scalar(params[key]) : "";
  const size = Number(scalar(params.size));
  const from = scalar(params.from), to = scalar(params.to);
  return {
    q: scalar(params.q).trim().slice(0, 120), type: option("type", config.types), status: option("status", config.statuses),
    account: ["transaction", "payment"].includes(view) ? identifier("account") : "", debt: view === "payment" ? identifier("debt") : "",
    frequency: view === "bill" ? option("frequency", options(["once", "weekly", "monthly", "quarterly", "yearly"])) : "",
    from: config.dateLabel && validDate(from) ? from : "", to: config.dateLabel && validDate(to) ? to : "",
    sort: option("sort", config.sorts, config.sorts[0].value),
    page: Math.max(1, Math.min(1_000_000, Number.parseInt(scalar(params.page)) || 1)),
    size: [10, 20, 50].includes(size) ? size : 10,
  };
}
export function financeHref(path: string, view: FinanceView, query: FinanceQuery, changes: Partial<FinanceQuery> = {}) {
  const next = { ...query, ...changes };
  const params = new URLSearchParams();
  if (path === "/debts") params.set("view", view === "payment" ? "payments" : "debts");
  if (path === "/planning") params.set("view", view === "goal" ? "goals" : "bills");
  for (const [key, value] of Object.entries(next)) if (value !== "" && !(key === "page" && value === 1)) params.set(key, String(value));
  return path + "?" + params.toString();
}
export function paginationItems(page: number, pages: number): Array<number | "ellipsis"> {
  const visible = new Set([1, pages, page - 1, page, page + 1].filter(value => value > 0 && value <= pages));
  const result: Array<number | "ellipsis"> = [];
  let previous = 0;
  for (const value of [...visible].sort((a, b) => a - b)) {
    if (previous && value - previous > 1) result.push("ellipsis");
    result.push(value); previous = value;
  }
  return result;
}
