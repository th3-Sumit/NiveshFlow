"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, CalendarDays, Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CreditCard, Inbox, Loader2, Search, SlidersHorizontal, Target, WalletCards, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { FinanceCreateDialog, selectClass } from "./create-dialog";
import { RecordControls } from "./record-controls";
import { financeConfig, financeHref, normalizeFinanceQuery, paginationItems, type FinanceList, type FinanceOption, type FinanceQuery, type FinanceRow, type FinanceView } from "@/app/lib/finance-list";
import { formatCurrency } from "@/app/lib/currency";
import { getTransactionAmountDisplay } from "@/app/lib/transaction-display";
import { cn } from "@/app/lib/utils";

const text = (row: FinanceRow, field: string) => String(row[field] ?? "");
const number = (row: FinanceRow, field: string) => Number(row[field] ?? 0);
const human = (value: string) => value.replaceAll("_", " ");
const date = (value: string) => value ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value)) : "Not set";
const icons = { account: WalletCards, transaction: ArrowLeftRight, debt: CreditCard, payment: CreditCard, bill: CalendarDays, goal: Target };
const sortLabels: Record<string, string> = { newest: "Newest first", oldest: "Oldest first", name: "Name A-Z", balance_high: "Balance: high to low", balance_low: "Balance: low to high", amount_high: "Amount: high to low", amount_low: "Amount: low to high", due_soon: "Earliest due first" };
const isFiltered = (query: FinanceQuery) => [query.q, query.type, query.status, query.account, query.debt, query.frequency, query.from, query.to].some(Boolean);

function Status({ value }: { value: string }) {
  const color = ["active", "completed", "paid", "paid_off"].includes(value) ? "bg-teal-50 text-teal-800 ring-teal-100" : value === "overdue" ? "bg-rose-50 text-rose-700 ring-rose-100" : ["upcoming", "due_soon", "pending"].includes(value) ? "bg-amber-50 text-amber-800 ring-amber-100" : "bg-slate-100 text-slate-600 ring-slate-200";
  return <span className={cn("inline-flex rounded-md px-2 py-1 text-xs font-medium capitalize ring-1 ring-inset", color)}>{human(value)}</span>;
}
function Progress({ value, label }: { value: number; label: string }) {
  const progress = Math.max(0, Math.min(100, value));
  return <div className="mt-2 flex items-center gap-2"><div role="progressbar" aria-label={label} aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 sm:w-20"><div className="h-full rounded-full bg-teal-500" style={{ width: progress + "%" }} /></div><span className="text-xs tabular-nums text-slate-500">{Math.round(progress)}%</span></div>;
}

function FinanceFilters({ view, path, query, accounts, debts }: { view: FinanceView; path: string; query: FinanceQuery; accounts: FinanceOption[]; debts: FinanceOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(!!(query.from || query.to || query.account || query.debt || query.frequency));
  const [rangeError, setRangeError] = useState("");
  const config = financeConfig[view];
  const extraFilters = !!config.dateLabel;
  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    if (values.from && values.to && values.from > values.to) { setRangeError("End date must be on or after the start date."); return; }
    setRangeError("");
    const next = normalizeFinanceQuery(view, { ...values, page: "1", size: String(query.size) });
    startTransition(() => router.push(financeHref(path, view, next), { scroll: false }));
  }
  const filterSelect = (name: string, label: string, options: Array<{ value: string; label: string }>, initial: string) => <label className="grid min-w-0 gap-1.5"><span className="text-xs font-medium text-slate-500">{label}</span><select name={name} aria-label={label} defaultValue={initial} className={cn(selectClass, "h-10")}><option value="">All {label.toLowerCase()}</option>{options.map(option => <option value={option.value} key={option.value}>{human(option.label)}</option>)}</select></label>;
  return <form onSubmit={apply} className="border-y border-slate-200/70 bg-white/60 px-4 py-4 sm:px-5" aria-label={config.title + " search and filters"}>
    <fieldset disabled={pending} className="grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid min-w-[160px] flex-1 gap-1.5"><span className="text-xs font-medium text-slate-500">Search</span><div className="relative"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" /><Input type="search" name="q" defaultValue={query.q} placeholder={config.search} maxLength={120} className="h-10 pl-9" /></div></label>
        {config.types.length ? <div className="w-[140px] grow sm:grow-0">{filterSelect("type", "Types", config.types, query.type)}</div> : null}
        <div className="w-[140px] grow sm:grow-0">{filterSelect("status", "Statuses", config.statuses, query.status)}</div>
        <label className="grid w-[180px] grow gap-1.5 sm:grow-0"><span className="text-xs font-medium text-slate-500">Sort by</span><select name="sort" aria-label="Sort by" defaultValue={query.sort} className={cn(selectClass, "h-10")}>{config.sorts.map(option => <option key={option.value} value={option.value}>{sortLabels[option.value]}</option>)}</select></label>
        <div className="flex items-center gap-2">
          {extraFilters ? <Button type="button" variant={expanded ? "secondary" : "outline"} size="icon" aria-expanded={expanded} aria-controls={view + "-extra-filters"} aria-label="More filters" title="More filters" onClick={() => setExpanded(!expanded)}><SlidersHorizontal /></Button> : null}
          <Button type="submit" className="h-10 px-4">{pending ? <Loader2 className="animate-spin" /> : <Search />}Apply</Button>
          {isFiltered(query) ? <Button type="button" variant="ghost" size="icon" aria-label="Clear filters" title="Clear filters" onClick={() => startTransition(() => router.push(financeHref(path, view, normalizeFinanceQuery(view, { size: String(query.size) })), { scroll: false }))}><X /></Button> : null}
        </div>
      </div>
      {extraFilters ? <div id={view + "-extra-filters"} hidden={!expanded} className={cn(expanded ? "grid" : "hidden", "gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-4")}>
        <label className="grid gap-1.5"><span className="text-xs font-medium text-slate-500">{config.dateLabel}: from</span><Input type="date" name="from" defaultValue={query.from} className="h-10" /></label>
        <label className="grid gap-1.5"><span className="text-xs font-medium text-slate-500">{config.dateLabel}: to</span><Input type="date" name="to" defaultValue={query.to} className="h-10" /></label>
        {["transaction", "payment"].includes(view) ? filterSelect("account", "Accounts", accounts.map(account => ({ value: account.id, label: account.name })), query.account) : null}
        {view === "payment" ? filterSelect("debt", "Debts", debts.map(debt => ({ value: debt.id, label: debt.name })), query.debt) : null}
        {view === "bill" ? filterSelect("frequency", "Frequencies", ["once", "weekly", "monthly", "quarterly", "yearly"].map(value => ({ value, label: value })), query.frequency) : null}
      </div> : null}
    </fieldset>
    {rangeError ? <p role="alert" className="mt-3 text-xs text-rose-600">{rangeError}</p> : null}
  </form>;
}

function FinanceTable({ view, rows, accounts, debts, onSuccess }: { view: FinanceView; rows: FinanceRow[]; accounts: FinanceOption[]; debts: FinanceOption[]; onSuccess: (message: string) => void }) {
  const accountName = (id: string) => accounts.find(account => account.id === id)?.name ?? "Account unavailable";
  const headers = view === "account" ? ["Account", "Type", "Opening balance", "Current balance", "Status"]
    : view === "transaction" ? ["Transaction", "Date", "Account", "Amount", "Status"]
    : view === "debt" ? ["Debt", "Next payment", "Interest / minimum", "Outstanding", "Status"]
    : view === "payment" ? ["Payment", "Date", "Breakdown", "Amount", "Status"]
    : view === "bill" ? ["Bill / subscription", "Due date", "Frequency", "Amount", "Status"] : ["Savings goal", "Target date", "Target", "Saved", "Status"];
  const cell = "px-2 py-4 sm:px-5", optional = cell + " hidden lg:table-cell", dateCell = cell + " hidden md:table-cell";
  return <div className="scrollbar-none overflow-x-auto"><table className="w-full text-left text-sm">
    <caption className="sr-only">{financeConfig[view].title}</caption>
    <thead className="border-b border-slate-200/70 bg-slate-50/80 text-xs font-semibold text-slate-500"><tr>{headers.map((header, index) => <th scope="col" key={header} className={cn(index === 1 ? dateCell : index === 2 || index === 4 ? optional : cell, index === 3 && "text-right")}>{index === 3 && ["account", "debt"].includes(view) ? <><span className="sm:hidden">Balance</span><span className="hidden sm:inline">{header}</span></> : header}</th>)}<th scope="col" className={cell + " text-right"}>Actions</th></tr></thead>
    <tbody className="divide-y divide-slate-100">{rows.map(row => {
      const type = text(row, "type"), status = text(row, "status");
      const title = view === "transaction" ? text(row, "merchant") || text(row, "description") || human(type) : view === "payment" ? (debts.find(debt => debt.id === text(row, "debtId"))?.name ?? text(row, "description")) || "Debt payment" : text(row, "name");
      const subtitle = view === "account" ? text(row, "institution") || human(type) : view === "transaction" ? human(type) + " / " + accountName(text(row, "accountId")) : view === "payment" ? accountName(text(row, "accountId")) : view === "debt" ? text(row, "lender") : view === "bill" ? human(type) : "Savings goal";
      const displayed = getTransactionAmountDisplay(type, number(row, "amount"));
      return <tr key={row.id} className="transition-colors hover:bg-teal-50/30">
        <td className={cell + " max-w-[260px]"}><p className="break-words font-semibold text-slate-800">{title}</p><p className="mt-1 break-words text-xs capitalize text-slate-500">{subtitle}</p>{view !== "account" ? <p className="mt-1 text-xs text-slate-500 md:hidden">{date(text(row, view === "debt" ? "nextPaymentDate" : view === "bill" ? "dueDate" : view === "goal" ? "targetDate" : "transactionDate"))}</p> : null}{view === "transaction" && type === "transfer" ? <p className="mt-1 text-xs text-slate-500">To {accountName(text(row, "toAccountId"))}</p> : null}{view === "debt" || view === "goal" ? <Progress value={number(row, view === "debt" ? "paidPercent" : "progress")} label={view === "debt" ? "Debt repaid" : "Savings progress"} /> : null}<span className="mt-2 inline-block lg:hidden"><Status value={status} /></span></td>
        <td className={dateCell + " whitespace-nowrap text-xs text-slate-600"}>{view === "account" ? <span className="capitalize">{human(type)}</span> : date(text(row, view === "debt" ? "nextPaymentDate" : view === "bill" ? "dueDate" : view === "goal" ? "targetDate" : "transactionDate"))}</td>
        <td className={optional + " text-xs text-slate-600"}>{view === "account" ? formatCurrency(number(row, "openingBalance")) : view === "transaction" ? accountName(text(row, "accountId")) : view === "debt" ? <><span className="font-medium">{number(row, "interestRate")}%</span><p className="mt-1">{formatCurrency(number(row, "minimumPayment"))} minimum</p></> : view === "payment" ? <div className="space-y-1"><p>Principal {formatCurrency(number(row, "principal"))}</p><p>Interest {formatCurrency(number(row, "interest"))} / Fees {formatCurrency(number(row, "fee"))}</p></div> : view === "bill" ? <span className="capitalize">{human(text(row, "frequency"))}</span> : formatCurrency(number(row, "targetAmount"))}</td>
        <td className={cell + " text-right font-semibold tabular-nums"}>{["transaction", "payment"].includes(view) ? <span className={displayed.className}>{displayed.label}</span> : formatCurrency(number(row, view === "account" ? "currentBalance" : view === "debt" ? "currentPrincipal" : view === "goal" ? "currentAmount" : "amount"))}{view === "goal" ? <p className="mt-1 text-xs font-normal text-slate-500 lg:hidden">of {formatCurrency(number(row, "targetAmount"))}</p> : null}</td>
        <td className={optional}><Status value={status} /></td>
        <td className={cell}><div className="flex flex-wrap items-center justify-end gap-2">{view === "debt" && status === "active" ? <span className="hidden xl:inline-flex"><FinanceCreateDialog kind="payment" accounts={accounts} debts={debts} debtId={row.id} compact onSuccess={onSuccess} /></span> : null}<RecordControls kind={view === "payment" ? "transaction" : view} record={row} accounts={accounts} hasPayments={row.hasPayments === true} /></div></td>
      </tr>;
    })}</tbody>
  </table></div>;
}

function FinancePagination({ view, path, data }: { view: FinanceView; path: string; data: FinanceList }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { page, pages, total, size, query } = data;
  const link = (target: number, label: string, icon: React.ReactNode, disabled: boolean, className?: string) => disabled ? <Button variant="ghost" size="icon" disabled aria-label={label} className={className}>{icon}</Button> : <Button asChild variant="outline" size="icon" className={className}><Link href={financeHref(path, view, query, { page: target })} scroll={false} aria-label={label} title={label}>{icon}</Link></Button>;
  return <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/70 px-4 py-4 sm:px-5">
    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500"><span className="tabular-nums">{total ? (page - 1) * size + 1 : 0}-{Math.min(page * size, total)} of {total} records</span><label className="flex items-center gap-2">Rows<select aria-label="Rows per page" disabled={pending} value={size} onChange={event => startTransition(() => router.push(financeHref(path, view, query, { size: Number(event.target.value), page: 1 }), { scroll: false }))} className={cn(selectClass, "h-8 w-16 px-2 text-xs")}>{[10, 20, 50].map(value => <option key={value} value={value}>{value}</option>)}</select>{pending ? <Loader2 className="size-3 animate-spin" /> : null}</label></div>
    <nav aria-label="Pagination" className="flex items-center gap-1.5">
      {link(1, "First page", <ChevronsLeft />, page === 1, "hidden sm:inline-flex")}
      {link(page - 1, "Previous page", <ChevronLeft />, page === 1)}
      <span className="px-2 text-xs tabular-nums text-slate-600 sm:hidden">{page} / {pages}</span>
      {paginationItems(page, pages).map((item, index) => item === "ellipsis" ? <span key={"ellipsis" + index} className="hidden w-5 text-center text-slate-400 sm:inline">...</span> : <Button key={item} asChild variant={item === page ? "default" : "ghost"} size="icon" className="hidden sm:inline-flex"><Link href={financeHref(path, view, query, { page: item })} scroll={false} aria-label={"Page " + item} aria-current={item === page ? "page" : undefined}>{item}</Link></Button>)}
      {link(page + 1, "Next page", <ChevronRight />, page === pages)}
      {link(pages, "Last page", <ChevronsRight />, page === pages, "hidden sm:inline-flex")}
    </nav>
  </footer>;
}

export function FinanceWorkspace({ view, path, data, accounts = [], debts = [] }: { view: FinanceView; path: string; data: FinanceList; accounts?: FinanceOption[]; debts?: FinanceOption[] }) {
  const [notice, setNotice] = useState("");
  const config = financeConfig[view], Icon = icons[view];
  const tabs: Array<{ view: FinanceView; label: string }> = path === "/debts" ? [{ view: "debt", label: "Debts" }, { view: "payment", label: "Payment history" }] : path === "/planning" ? [{ view: "bill", label: "Bills & subscriptions" }, { view: "goal", label: "Savings goals" }] : [];
  return <section className="w-full min-w-0 py-6 sm:py-8">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-teal-200 bg-teal-50 text-teal-700"><Icon className="size-5" /></span><div><h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{path === "/debts" ? "Debt management" : path === "/planning" ? "Planning" : config.title}</h1><p className="mt-1 text-xs text-slate-500">{data.total} {isFiltered(data.query) ? "matching" : "total"} {config.title.toLowerCase()}</p></div></div>
      <div className="flex flex-wrap gap-2">{path === "/debts" ? <><FinanceCreateDialog kind="debt" onSuccess={setNotice} /><FinanceCreateDialog kind="payment" accounts={accounts} debts={debts} onSuccess={setNotice} /></> : path === "/planning" ? <><FinanceCreateDialog kind="bill" onSuccess={setNotice} /><FinanceCreateDialog kind="goal" onSuccess={setNotice} /></> : <FinanceCreateDialog kind={view === "payment" ? "payment" : view} accounts={accounts} debts={debts} onSuccess={setNotice} />}</div>
    </header>
    {notice ? <div role="status" className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2 text-sm text-teal-800"><span className="flex items-center gap-2"><Check className="size-4" />{notice}</span><Button size="icon" variant="ghost" aria-label="Dismiss notification" title="Dismiss" onClick={() => setNotice("")}><X /></Button></div> : null}
    <div className="my-6 flex flex-wrap gap-x-8 gap-y-4 border-b border-slate-200/70 pb-5">
      {[{ label: "Matching records", value: String(data.total) }, { label: config.sumLabel, value: formatCurrency(data.sum) }, ...(config.sum2Label ? [{ label: config.sum2Label, value: formatCurrency(data.sum2) }] : [])].map(item => <div key={item.label}><p className="text-xs font-medium text-slate-500">{item.label}</p><p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{item.value}</p></div>)}
    </div>
    {tabs.length ? <nav aria-label="Section views" className="mb-4 flex gap-1 border-b border-slate-200">{tabs.map(tab => <Link key={tab.view} href={financeHref(path, tab.view, normalizeFinanceQuery(tab.view, { size: String(data.size) }))} scroll={false} aria-current={view === tab.view ? "page" : undefined} className={cn("cursor-pointer border-b-2 px-4 py-3 text-sm font-medium transition-colors", view === tab.view ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-900")}>{tab.label}</Link>)}</nav> : null}
    <div className="overflow-hidden rounded-lg border border-slate-200/80 bg-white/90 shadow-sm">
      <FinanceFilters key={view + JSON.stringify(data.query)} view={view} path={path} query={data.query} accounts={accounts} debts={debts} />
      {data.rows.length ? <FinanceTable view={view} rows={data.rows} accounts={accounts} debts={debts} onSuccess={setNotice} /> : <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-5 py-12 text-center"><Inbox className="size-9 text-teal-400" /><h2 className="text-base font-semibold text-slate-800">{isFiltered(data.query) ? "No matching records" : "No " + config.title.toLowerCase() + " yet"}</h2>{isFiltered(data.query) ? <Button asChild variant="outline" size="sm"><Link scroll={false} href={financeHref(path, view, normalizeFinanceQuery(view, { size: String(data.size) }))}><X />Clear filters</Link></Button> : <FinanceCreateDialog kind={view} accounts={accounts} debts={debts} onSuccess={setNotice} />}</div>}
      <FinancePagination view={view} path={path} data={data} />
    </div>
  </section>;
}
