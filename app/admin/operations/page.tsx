import { AppShell } from "@/app/components/app-shell";
import { MaintenanceButton } from "@/app/components/admin/maintenance-button";
import { requireSuperAdmin } from "@/app/lib/data";
import { getDb } from "@/app/lib/mongodb";

export default async function OperationsPage() {
  const admin = await requireSuperAdmin(); const db = await getDb();
  const [mail, media] = await Promise.all([db.collection("mailJobs").countDocuments(), db.collection("mediaCleanupJobs").countDocuments()]);
  return <AppShell title="Operations" user={admin}><section className="mx-auto grid max-w-7xl gap-6 py-8"><h1 className="text-2xl font-semibold">Operations</h1><div className="grid max-w-2xl gap-6 rounded-lg border border-slate-200 bg-white p-6"><h2 className="text-base font-semibold">Deletion follow-up jobs</h2><dl className="grid grid-cols-2 gap-4"><div><dt className="text-xs text-slate-500">Pending email notifications</dt><dd className="mt-2 text-2xl font-semibold">{mail}</dd></div><div><dt className="text-xs text-slate-500">Pending media cleanup batches</dt><dd className="mt-2 text-2xl font-semibold">{media}</dd></div></dl><p className="text-sm leading-6 text-slate-500">Account data is removed immediately. Failed email notifications and Cloudinary removals remain queued for retry. Each run processes up to 5 email jobs and 2 cleanup batches. No recipient details are displayed here.</p><MaintenanceButton /></div></section></AppShell>;
}
