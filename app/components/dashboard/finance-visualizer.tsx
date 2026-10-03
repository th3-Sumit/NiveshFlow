"use client";

import { BarChart3, Donut, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

type DashboardStats = {
  actualExpenses: number;
  cashFlow: number;
  cashOutflow: number;
  debtReduction: number;
  incomeThisMonth: number;
  netWorth: number;
  outstandingDebt: number;
  totalBalance: number;
};

type AccountView = {
  currentBalance: number;
  id: string;
  name: string;
  type: string;
};

type TransactionView = {
  amount: number;
  description?: string;
  id: string;
  merchant?: string;
  type: string;
};

type DebtView = {
  currentPrincipal: number;
  id: string;
  name: string;
};

type SavingsGoalView = {
  currentAmount: number;
  id: string;
  name: string;
  targetAmount: number;
};

type ChartItem = {
  id: string;
  label: string;
  value: number;
};

const chartViews = [
  { id: "flow", label: "Cash flow" },
  { id: "accounts", label: "Accounts" },
  { id: "ledger", label: "Ledger" },
  { id: "debt", label: "Debt" },
] as const;

const incomingTransactionTypes = new Set(["income", "refund"]);
const positiveColors = ["#10b981", "#14b8a6", "#22c55e", "#84cc16", "#06b6d4"];
const negativeColors = ["#f43f5e", "#ef4444", "#fb7185", "#f97316", "#dc2626"];

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function signedTransactionAmount(type: string, amount: number) {
  return incomingTransactionTypes.has(type) ? Math.abs(amount) : -Math.abs(amount);
}

function itemColor(item: ChartItem, index: number) {
  const palette = item.value >= 0 ? positiveColors : negativeColors;

  return palette[index % palette.length];
}

function itemLabel(transaction: TransactionView) {
  return (
    transaction.description ||
    transaction.merchant ||
    transaction.type.replace("_", " ")
  );
}

function emptyFallback(label: string): ChartItem[] {
  return [{ id: "empty", label, value: 0 }];
}

function BarChart({ items }: { items: ChartItem[] }) {
  const maxValue = Math.max(...items.map((item) => Math.abs(item.value)), 1);

  return (
    <div className="grid gap-4">
      {items.map((item, index) => {
        const width = `${Math.max((Math.abs(item.value) / maxValue) * 100, 3)}%`;
        const isPositive = item.value >= 0;

        return (
          <div className="grid gap-2" key={item.id}>
            <div className="flex items-center justify-between gap-4">
              <span className="truncate text-sm font-bold text-slate-700">
                {item.label}
              </span>
              <span
                className={
                  isPositive
                    ? "shrink-0 text-sm font-black text-emerald-600"
                    : "shrink-0 text-sm font-black text-rose-600"
                }
              >
                {isPositive ? "+" : "(-)"} {formatMoney(Math.abs(item.value))}
              </span>
            </div>
            <div className="h-4 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full origin-left rounded-full transition-[width,background-color] duration-500 motion-safe:animate-bar-in"
                style={{
                  background: itemColor(item, index),
                  width,
                  animationDelay: `${index * 60}ms`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DonutChart({ items }: { items: ChartItem[] }) {
  const total = items.reduce((sum, item) => sum + Math.abs(item.value), 0);
  let cursor = 0;
  const gradient =
    total > 0
      ? items
          .map((item, index) => {
            const start = cursor;
            const size = (Math.abs(item.value) / total) * 360;
            cursor += size;

            return `${itemColor(item, index)} ${start}deg ${cursor}deg`;
          })
          .join(", ")
      : "#e2e8f0 0deg 360deg";

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <div className="grid place-items-center">
        <div
          className="grid size-60 place-items-center rounded-full shadow-inner motion-safe:animate-content-in"
          style={{
            background: `conic-gradient(${gradient})`,
          }}
        >
          <div className="grid size-36 place-items-center rounded-full bg-white text-center shadow-[inset_0_0_30px_rgba(15,23,42,0.08)]">
            <span>
              <span className="block text-xs font-black uppercase text-slate-400">
                Total view
              </span>
              <span className="mt-1 block text-lg font-black text-slate-950">
                {formatMoney(total)}
              </span>
            </span>
          </div>
        </div>
      </div>
      <div className="grid content-center gap-3">
        {items.map((item, index) => (
          <div
            className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3"
            key={item.id}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ background: itemColor(item, index) }}
              />
              <span className="truncate text-sm font-bold text-slate-700">
                {item.label}
              </span>
            </span>
            <span
              className={
                item.value >= 0
                  ? "shrink-0 text-sm font-black text-emerald-600"
                  : "shrink-0 text-sm font-black text-rose-600"
              }
            >
              {item.value >= 0 ? "+" : "(-)"} {formatMoney(Math.abs(item.value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FinanceVisualizer({
  accounts,
  debts,
  recentTransactions,
  savingsGoals,
  stats,
}: {
  accounts: AccountView[];
  debts: DebtView[];
  recentTransactions: TransactionView[];
  savingsGoals: SavingsGoalView[];
  stats: DashboardStats;
}) {
  const [chartStyle, setChartStyle] = useState<"bars" | "donut">("bars");
  const [view, setView] = useState<(typeof chartViews)[number]["id"]>("flow");
  const [selectedIdsByView, setSelectedIdsByView] = useState<
    Partial<Record<(typeof chartViews)[number]["id"], string[]>>
  >({});

  const allItems = useMemo<ChartItem[]>(() => {
    if (view === "accounts") {
      const items = accounts.map((account) => ({
        id: `account-${account.id}`,
        label: account.name,
        value: account.currentBalance,
      }));

      return items.length > 0 ? items : emptyFallback("No accounts yet");
    }

    if (view === "ledger") {
      const items = recentTransactions.map((transaction) => ({
        id: `transaction-${transaction.id}`,
        label: itemLabel(transaction),
        value: signedTransactionAmount(transaction.type, transaction.amount),
      }));

      return items.length > 0 ? items : emptyFallback("No transactions yet");
    }

    if (view === "debt") {
      const debtItems = debts.map((debt) => ({
        id: `debt-${debt.id}`,
        label: debt.name,
        value: -Math.abs(debt.currentPrincipal),
      }));
      const items =
        stats.debtReduction > 0
          ? [
              {
                id: "debt-reduction",
                label: "Debt reduction this month",
                value: stats.debtReduction,
              },
              ...debtItems,
            ]
          : debtItems;

      return items.length > 0 ? items : emptyFallback("No active debt");
    }

    return [
      {
        id: "flow-income",
        label: "Income this month",
        value: stats.incomeThisMonth,
      },
      {
        id: "flow-expenses",
        label: "Actual expenses",
        value: -Math.abs(stats.actualExpenses),
      },
      {
        id: "flow-debt-reduction",
        label: "Debt reduction",
        value: stats.debtReduction,
      },
      { id: "flow-cash", label: "Cash remaining", value: stats.cashFlow },
      { id: "flow-net-worth", label: "Net worth", value: stats.netWorth },
      {
        id: "flow-savings",
        label: "Savings progress",
        value: savingsGoals.reduce((total, goal) => total + goal.currentAmount, 0),
      },
    ];
  }, [accounts, debts, recentTransactions, savingsGoals, stats, view]);

  const selectedItemIds =
    selectedIdsByView[view] ?? allItems.map((item) => item.id);
  const selectedIdSet = useMemo(
    () => new Set(selectedItemIds),
    [selectedItemIds],
  );
  const visibleItems = allItems.filter((item) => selectedIdSet.has(item.id));
  const positiveTotal = visibleItems
    .filter((item) => item.value > 0)
    .reduce((total, item) => total + item.value, 0);
  const negativeTotal = visibleItems
    .filter((item) => item.value < 0)
    .reduce((total, item) => total + Math.abs(item.value), 0);
  const selectedCount = visibleItems.length;
  const allSelected = selectedCount === allItems.length;

  function updateCurrentSelection(ids: string[]) {
    setSelectedIdsByView((currentSelections) => ({
      ...currentSelections,
      [view]: ids,
    }));
  }

  function toggleItem(itemId: string) {
    const currentIds =
      selectedIdsByView[view] ?? allItems.map((item) => item.id);
    const nextIds = currentIds.includes(itemId)
      ? currentIds.filter((id) => id !== itemId)
      : [...currentIds, itemId];

    updateCurrentSelection(nextIds);
  }

  function selectAllItems() {
    updateCurrentSelection(allItems.map((item) => item.id));
  }

  function clearItems() {
    updateCurrentSelection([]);
  }

  return (
    <section className="rounded-2xl border border-teal-100 bg-white/90 p-5 shadow-[0_8px_32px_rgba(19,78,74,0.06)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm font-black uppercase text-emerald-700">
            <SlidersHorizontal size={17} />
            Interactive insights
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            Visualize your money movement
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
            Your accounts, cash flow, and financial activity at a glance.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-800">
            <p className="font-black">{formatMoney(positiveTotal)}</p>
            <p className="font-semibold">Positive view</p>
          </div>
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-rose-700">
            <p className="font-black">{formatMoney(negativeTotal)}</p>
            <p className="font-semibold">Outflow view</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="flex flex-wrap gap-2">
          {chartViews.map((item) => (
            <button
              className={
                view === item.id
                  ? "rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-teal-50"
              }
              key={item.id}
              onClick={() => setView(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <details className="relative">
            <summary className="list-none rounded-lg border border-teal-200/70 bg-white px-4 py-2 text-sm font-medium text-teal-800 shadow-sm transition hover:bg-teal-50 [&::-webkit-details-marker]:hidden">
              Entries: {allSelected ? "All" : `${selectedCount}/${allItems.length}`}
            </summary>
            <div className="absolute left-0 z-20 mt-2 w-72 max-w-[calc(100vw-3rem)] rounded-xl border border-teal-100 bg-white p-3 shadow-xl shadow-teal-950/10 lg:left-auto lg:right-0">
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <p className="text-xs font-black uppercase text-slate-400">
                  Visible entries
                </p>
                <div className="flex gap-2">
                  <button
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white"
                    onClick={selectAllItems}
                    type="button"
                  >
                    All
                  </button>
                  <button
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600"
                    onClick={clearItems}
                    type="button"
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
                {allItems.map((item, index) => {
                  const checked = selectedIdSet.has(item.id);

                  return (
                    <label
                      className={
                        checked
                          ? "flex items-center gap-3 rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900"
                          : "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                      }
                      key={item.id}
                    >
                      <input
                        checked={checked}
                        className="size-4 accent-teal-600"
                        onChange={() => toggleItem(item.id)}
                        type="checkbox"
                      />
                      <span
                        className="size-3 shrink-0 rounded-full"
                        style={{ background: itemColor(item, index) }}
                      />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </details>
          <button
            className={
              chartStyle === "bars"
                ? "inline-flex items-center gap-2 rounded-lg bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-800 ring-1 ring-teal-200"
                : "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600"
            }
            onClick={() => setChartStyle("bars")}
            type="button"
          >
            <BarChart3 size={16} />
            Bars
          </button>
          <button
            className={
              chartStyle === "donut"
                ? "inline-flex items-center gap-2 rounded-lg bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-800 ring-1 ring-teal-200"
                : "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600"
            }
            onClick={() => setChartStyle("donut")}
            type="button"
          >
            <Donut size={16} />
            Donut
          </button>
        </div>
      </div>

      <div className="mt-6 border-t border-teal-100 pt-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-500">
            {chartViews.find((item) => item.id === view)?.label}
          </p>
          <p className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">
            {selectedCount} of {allItems.length} selected
          </p>
        </div>
        {selectedCount === 0 ? (
          <p className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-500">
            Select an entry to show the chart.
          </p>
        ) : (
          <>
            {chartStyle === "bars" ? (
              <BarChart key={view} items={visibleItems} />
            ) : (
              <DonutChart items={visibleItems} />
            )}
          </>
        )}
      </div>
    </section>
  );
}
