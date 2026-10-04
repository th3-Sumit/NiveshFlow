import { AppShell } from "@/app/components/app-shell";
import { FinanceWorkspace } from "@/app/components/finance/workspace";
import { requireCurrentUser } from "@/app/lib/data";
import { getFinanceList } from "@/app/lib/finance-list-data";
import type { FinanceSearchParams } from "@/app/lib/finance-list";
import { privatePageMetadata } from "@/app/lib/seo";

export const metadata = privatePageMetadata("Accounts", "Manage the accounts and wallets in your private NiveshFlow workspace.");

export default async function AccountsPage({ searchParams }: { searchParams: Promise<FinanceSearchParams> }) {
  const user = await requireCurrentUser();
  const data = await getFinanceList("account", await searchParams);
  return <AppShell title="Accounts & Wallets" user={user}><FinanceWorkspace view="account" path="/accounts" data={data} /></AppShell>;
}
