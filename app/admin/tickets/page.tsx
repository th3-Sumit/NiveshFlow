import { AppShell } from "@/app/components/app-shell";
import { AdminSupportInbox } from "@/app/components/support/admin-support-inbox";
import { requireSuperAdmin } from "@/app/lib/data";
import { getAdminSupportRequests } from "@/app/lib/support-data";
import { privatePageMetadata } from "@/app/lib/seo";

export const metadata = privatePageMetadata("Support tickets", "NiveshFlow support administration.");

export default async function TicketsPage() {
  const admin = await requireSuperAdmin();
  const requests = await getAdminSupportRequests();
  return <AppShell title="Tickets" user={admin}><section className="mx-auto grid max-w-7xl gap-6 py-8"><h1 className="text-2xl font-semibold">Tickets</h1><AdminSupportInbox requests={requests} /></section></AppShell>;
}
