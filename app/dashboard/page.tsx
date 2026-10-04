import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  Landmark,
  PiggyBank,
  ReceiptText,
  Scale,
  TrendingUp,
} from "lucide-react";
import { AppShell } from "@/app/components/app-shell";
import { FinanceVisualizer } from "@/app/components/dashboard/finance-visualizer";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { getFinanceDashboard } from "@/app/lib/data";
import { formatCurrency } from "@/app/lib/money";
import { getTransactionAmountDisplay } from "@/app/lib/transaction-display";
import { privatePageMetadata } from "@/app/lib/seo";

export const metadata = privatePageMetadata("Dashboard", "View your personal cash flow, account balances, recent transactions, and savings progress.");

function StatTile({
  detail,
  icon: Icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: typeof Banknote;
  label: string;
  tone: "emerald" | "rose" | "sky" | "amber";
  value: string;
}) {
  const toneClass = {
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
    sky: "bg-sky-50 text-sky-700 ring-sky-100",
  }[tone];

  return (
    <div className="min-h-[116px] overflow-hidden rounded-lg border border-slate-200/80 bg-white/90 p-4">
      <div className="flex items-center gap-3">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ${toneClass}`}
        >
          <Icon size={18} />
        </span>
        <span className="min-w-0 text-[11px] font-black uppercase leading-4 text-slate-500">
          {label}
        </span>
      </div>
      <span className="mt-4 block text-xl font-semibold leading-none text-slate-950">
        {value}
      </span>
      <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
        {detail}
      </p>
    </div>
  );
}

function SummaryRow({
  label,
  maxValue,
  tone,
  value,
}: {
  label: string;
  maxValue: number;
  tone: "emerald" | "rose" | "sky" | "amber";
  value: number;
}) {
  const width = `${Math.max((Math.abs(value) / Math.max(maxValue, 1)) * 100, value === 0 ? 0 : 6)}%`;
  const toneClass = {
    amber: "bg-amber-400",
    emerald: "bg-emerald-400",
    rose: "bg-rose-400",
    sky: "bg-sky-400",
  }[tone];

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-medium text-white/75">{label}</span>
        <span className="text-sm font-black text-white">
          {formatCurrency(value)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${toneClass}`} style={{ width }} />
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const {
    accounts,
    debts,
    recentTransactions,
    savingsGoals,
    stats,
    upcomingBills,
    user,
  } = await getFinanceDashboard();
  const summaryMax = Math.max(
    stats.cashOutflow,
    stats.debtReduction,
    stats.outstandingDebt,
    Math.abs(stats.cashFlow),
    1,
  );
  const cashFlowStatusClass =
    stats.cashFlow >= 0
      ? "bg-emerald-400 text-slate-950"
      : "bg-rose-400 text-white";

  return (
    <AppShell title="Financial OS" user={user}>
      <section className="grid w-full min-w-0 gap-6 py-8">
        <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <Card className="overflow-hidden p-0">
            <CardContent className="relative p-6 sm:p-7">
              <div className="relative flex flex-wrap items-start justify-between gap-5">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary text-lg font-bold text-white shadow-sm">
                    {user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={user.name}
                        className="size-full object-cover"
                        src={user.avatarUrl}
                      />
                    ) : (
                      user.name.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      Welcome back
                    </p>
                    <h1 className="mt-1 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
                      {user.name}
                    </h1>
                    <p className="mt-2 text-xs font-semibold text-emerald-700 sm:text-sm">
                      Personal finance workspace is live
                    </p>
                  </div>
                </div>
                <Button asChild className="h-11 px-5 text-sm">
                  <Link href="/transactions">
                    Add movement
                    <ArrowRight size={17} />
                  </Link>
                </Button>
              </div>
              <p className="relative mt-7 max-w-3xl text-base font-medium leading-7 text-slate-600">
                Your ledger is the source of truth. Accounts, spending, debt
                payments, savings goals, reports, and net worth all derive from
                financial movements.
              </p>
              <div className="relative mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile
                  detail="Available across active accounts"
                  icon={Landmark}
                  label="Total balance"
                  tone="sky"
                  value={formatCurrency(stats.totalBalance)}
                />
                <StatTile
                  detail="Income recorded this month"
                  icon={TrendingUp}
                  label="Month income"
                  tone="emerald"
                  value={formatCurrency(stats.incomeThisMonth)}
                />
                <StatTile
                  detail="Spending plus interest and fees"
                  icon={ReceiptText}
                  label="Actual expenses"
                  tone="rose"
                  value={formatCurrency(stats.actualExpenses)}
                />
                <StatTile
                  detail="Assets minus outstanding debt"
                  icon={PiggyBank}
                  label="Net worth"
                  tone="amber"
                  value={formatCurrency(stats.netWorth)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-teal-800 bg-teal-900 p-0 text-white">
            <CardContent className="relative p-6 sm:p-7">
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-teal-100/80">
                    Monthly summary
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold leading-tight">
                    Cash flow control
                  </h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase text-emerald-200">
                  {stats.cashFlow >= 0 ? "Surplus" : "Deficit"}
                </span>
              </div>

              <div className="relative mt-8 rounded-[24px] border border-white/10 bg-white/[0.06] p-5">
                <p className="text-xs font-medium text-white/75">Cash remaining</p>
                <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
                  <p className="text-3xl font-semibold">
                    {formatCurrency(stats.cashFlow)}
                  </p>
                  <span
                    className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-black ${cashFlowStatusClass}`}
                  >
                    {stats.cashFlow >= 0 ? (
                      <ArrowUpRight size={16} />
                    ) : (
                      <ArrowDownRight size={16} />
                    )}
                    This month
                  </span>
                </div>
              </div>

              <div className="relative mt-6 grid gap-4">
                <SummaryRow
                  label="Cash outflow"
                  maxValue={summaryMax}
                  tone="rose"
                  value={stats.cashOutflow}
                />
                <SummaryRow
                  label="Debt reduction"
                  maxValue={summaryMax}
                  tone="emerald"
                  value={stats.debtReduction}
                />
                <SummaryRow
                  label="Outstanding debt"
                  maxValue={summaryMax}
                  tone="amber"
                  value={stats.outstandingDebt}
                />
              </div>

              <div className="relative mt-7 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                  <CircleDollarSign className="text-emerald-300" size={19} />
                  <p className="mt-3 text-[11px] font-semibold uppercase text-white/75">
                    Income
                  </p>
                  <p className="mt-1 text-base font-black">
                    {formatCurrency(stats.incomeThisMonth)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                  <Scale className="text-sky-300" size={19} />
                  <p className="mt-3 text-[11px] font-semibold uppercase text-white/75">
                    Net worth
                  </p>
                  <p className="mt-1 text-base font-black">
                    {formatCurrency(stats.netWorth)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <FinanceVisualizer
          accounts={accounts}
          debts={debts}
          recentTransactions={recentTransactions}
          savingsGoals={savingsGoals}
          stats={stats}
        />

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="p-0">
            <CardHeader className="flex flex-row items-center justify-between p-6 pb-0">
              <div>
                <p className="text-sm font-bold uppercase text-slate-500">
                  Accounts
                </p>
                <CardTitle className="mt-1">Wallets and sources</CardTitle>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/accounts">Manage</Link>
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3 p-6">
              {accounts.slice(0, 4).map((account) => (
                <div
                  className="flex items-center justify-between rounded-3xl border border-slate-200/80 bg-white/65 p-4"
                  key={account.id}
                >
                  <span>
                    <span className="block font-bold">{account.name}</span>
                    <span className="text-sm font-semibold capitalize text-slate-500">
                      {account.type.replace("_", " ")}
                    </span>
                  </span>
                  <span className="text-lg font-semibold">
                    {formatCurrency(account.currentBalance)}
                  </span>
                </div>
              ))}
              {accounts.length === 0 ? (
                <p className="rounded-3xl border border-dashed border-slate-300 p-5 text-sm font-semibold text-slate-500">
                  Add your first cash, bank, wallet, card, or investment account.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="p-0">
            <CardHeader className="flex flex-row items-center justify-between p-6 pb-0">
              <div>
                <p className="text-sm font-bold uppercase text-slate-500">
                  Ledger
                </p>
                <CardTitle className="mt-1">Recent transactions</CardTitle>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/transactions">View all</Link>
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3 p-6">
              {recentTransactions.map((transaction) => {
                const amountDisplay = getTransactionAmountDisplay(
                  transaction.type,
                  transaction.amount,
                );

                return (
                  <div
                    className="grid gap-2 rounded-3xl border border-slate-200/80 bg-white/65 p-4 sm:grid-cols-[1fr_auto]"
                    key={transaction.id}
                  >
                    <span>
                      <span className="block font-bold capitalize">
                        {transaction.type.replace("_", " ")}
                      </span>
                      <span className="text-sm font-semibold text-slate-500">
                        {transaction.description ||
                          transaction.merchant ||
                          "Ledger entry"}
                      </span>
                    </span>
                    <span className={`font-semibold ${amountDisplay.className}`}>
                      {amountDisplay.label}
                    </span>
                  </div>
                );
              })}
              {recentTransactions.length === 0 ? (
                <p className="rounded-3xl border border-dashed border-slate-300 p-5 text-sm font-semibold text-slate-500">
                  No transactions yet. Add income, expenses, and debt payments
                  to activate reports.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-0">
            <CardHeader className="p-6 pb-0">
              <CreditCard className="text-rose-500" size={28} />
              <CardTitle className="mt-4">Debt position</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-6">
              {debts.slice(0, 3).map((debt) => (
                <div key={debt.id}>
                  <div className="flex justify-between gap-4">
                    <span className="font-bold">{debt.name}</span>
                    <span className="font-semibold">
                      {formatCurrency(debt.currentPrincipal)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-emerald-500"
                      style={{ width: `${debt.paidPercent}%` }}
                    />
                  </div>
                </div>
              ))}
              {debts.length === 0 ? (
                <p className="text-sm font-semibold text-slate-500">
                  Add loans or credit-card debt to track principal reduction.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="p-0">
            <CardHeader className="p-6 pb-0">
              <CalendarDays className="text-amber-500" size={28} />
              <CardTitle className="mt-4">Upcoming bills</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-6">
              {upcomingBills.map((bill) => (
                <div className="flex justify-between gap-4" key={bill.id}>
                  <span>
                    <span className="block font-bold">{bill.name}</span>
                    <span className="text-sm font-semibold text-slate-500">
                      {new Date(bill.dueDate).toLocaleDateString("en-IN")}
                    </span>
                  </span>
                  <span className="font-semibold">{formatCurrency(bill.amount)}</span>
                </div>
              ))}
              {upcomingBills.length === 0 ? (
                <p className="text-sm font-semibold text-slate-500">
                  No bills due in the next 30 days.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="p-0">
            <CardHeader className="p-6 pb-0">
              <PiggyBank className="text-emerald-600" size={28} />
              <CardTitle className="mt-4">Savings goals</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-6">
              {savingsGoals.map((goal) => (
                <div key={goal.id}>
                  <div className="flex justify-between gap-4">
                    <span className="font-bold">{goal.name}</span>
                    <span className="font-semibold">
                      {goal.progress.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-emerald-500"
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                </div>
              ))}
              {savingsGoals.length === 0 ? (
                <p className="text-sm font-semibold text-slate-500">
                  Create targets for emergency funds, travel, or major purchases.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
