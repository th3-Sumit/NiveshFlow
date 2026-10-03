import { AppShell } from "@/app/components/app-shell";
import { FinanceWorkspace } from "@/app/components/finance/workspace";
import { requireCurrentUser } from "@/app/lib/data";
import { getFinanceList, getFinanceOptions } from "@/app/lib/finance-list-data";
import type { FinanceSearchParams } from "@/app/lib/finance-list";

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<FinanceSearchParams> }) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const [data, options] = await Promise.all([getFinanceList("transaction", params), getFinanceOptions()]);
  return <AppShell title="Transactions" user={user}><FinanceWorkspace view="transaction" path="/transactions" data={data} accounts={options.accounts} /></AppShell>;
}
