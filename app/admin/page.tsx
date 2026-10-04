import Link from "next/link";
import { AppShell } from "@/app/components/app-shell";
import { AdminAnalytics } from "@/app/components/admin/admin-analytics";
import { AdminDetailsForm } from "@/app/components/admin/admin-forms";
import { requireSuperAdmin } from "@/app/lib/data";
import { getAdminOverview } from "@/app/lib/admin-data";
import { privatePageMetadata } from "@/app/lib/seo";

export const metadata = privatePageMetadata("Admin dashboard", "NiveshFlow platform administration.");

export default async function AdminPage() {
  const admin = await requireSuperAdmin();
  const overview = await getAdminOverview();
  return <AppShell title="Admin dashboard" user={admin}>
    <section className="mx-auto grid max-w-7xl gap-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl font-semibold">Platform overview</h1><p className="mt-1 text-sm text-slate-500">User activity and support</p></div>
        <AdminDetailsForm mode="invite" />
      </header>
      <AdminAnalytics data={overview} />
      <section id="feedback" className="scroll-mt-8 border-t border-slate-200 pt-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Account deletion feedback</h2><Link href="/admin/tickets" className="text-sm font-medium text-teal-700">View support tickets</Link></div>
        {overview.feedback.length ? <div className="grid gap-3 md:grid-cols-2">{overview.feedback.map(item => <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap justify-between gap-2 text-xs"><strong className="capitalize text-slate-600">{item.reason.replaceAll("_", " ") || "Feedback"}</strong><time className="text-slate-400">{new Date(item.createdAt).toLocaleDateString("en-IN")}</time></div>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{item.feedback || "No additional comments."}</p>
        </article>)}</div> : <p className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">No deletion feedback yet.</p>}
      </section>
    </section>
  </AppShell>;
}
