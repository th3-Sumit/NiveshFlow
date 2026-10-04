import { AppShell } from "@/app/components/app-shell";
import { FinanceWorkspace } from "@/app/components/finance/workspace";
import { requireCurrentUser } from "@/app/lib/data";
import { getFinanceList, getFinanceOptions } from "@/app/lib/finance-list-data";
import type { FinanceSearchParams } from "@/app/lib/finance-list";
import { privatePageMetadata } from "@/app/lib/seo";

export const metadata = privatePageMetadata("Transactions", "Review and manage your income, expenses, transfers, and debt payments.");

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<FinanceSearchParams> }) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const [data, options] = await Promise.all([getFinanceList("transaction", params), getFinanceOptions()]);
  return <AppShell title="Transactions" user={user}><FinanceWorkspace view="transaction" path="/transactions" data={data} accounts={options.accounts} /></AppShell>;
}
