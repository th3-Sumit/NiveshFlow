import { AppShell } from "@/app/components/app-shell";
import { FinanceWorkspace } from "@/app/components/finance/workspace";
import { requireCurrentUser } from "@/app/lib/data";
import { getFinanceList } from "@/app/lib/finance-list-data";
import type { FinanceSearchParams } from "@/app/lib/finance-list";
import { privatePageMetadata } from "@/app/lib/seo";

export const metadata = privatePageMetadata("Planning", "Plan upcoming bills and savings goals in your NiveshFlow workspace.");

export default async function PlanningPage({ searchParams }: { searchParams: Promise<FinanceSearchParams> }) {
  const user = await requireCurrentUser();
  const params = await searchParams, view = params.view === "goals" ? "goal" : "bill";
  const data = await getFinanceList(view, params);
  return <AppShell title="Planning" user={user}><FinanceWorkspace view={view} path="/planning" data={data} /></AppShell>;
}
