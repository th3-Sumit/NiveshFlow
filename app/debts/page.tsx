import { AppShell } from "@/app/components/app-shell";
import { FinanceWorkspace } from "@/app/components/finance/workspace";
import { requireCurrentUser } from "@/app/lib/data";
import { getFinanceList, getFinanceOptions } from "@/app/lib/finance-list-data";
import type { FinanceSearchParams } from "@/app/lib/finance-list";
import { privatePageMetadata } from "@/app/lib/seo";

export const metadata = privatePageMetadata("Debt management", "Track your debts, repayment history, principal, interest, and fees.");

export default async function DebtsPage({ searchParams }: { searchParams: Promise<FinanceSearchParams> }) {
  const user = await requireCurrentUser();
  const params = await searchParams, view = params.view === "payments" ? "payment" : "debt";
  const [data, options] = await Promise.all([getFinanceList(view, params), getFinanceOptions(true)]);
  return <AppShell title="Debt management" user={user}><FinanceWorkspace view={view} path="/debts" data={data} {...options} /></AppShell>;
}
