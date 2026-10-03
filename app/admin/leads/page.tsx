import { AppShell } from "@/app/components/app-shell";
import { AdminDetailsForm, LeadActions } from "@/app/components/admin/admin-forms";
import { requireSuperAdmin } from "@/app/lib/data";
import { getLeads } from "@/app/lib/admin-data";

export default async function LeadsPage() {
  const admin = await requireSuperAdmin();
  const leads = await getLeads();
  return <AppShell title="Leads" user={admin}><section className="mx-auto grid max-w-7xl gap-6 py-8">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-semibold">Leads</h1><p className="mt-1 text-sm text-slate-500">{leads.length} prospects</p></div><AdminDetailsForm mode="lead" /></header>
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white/90"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-4">Prospect</th><th className="p-4">Stage</th><th className="p-4">Source / notes</th><th className="p-4">Actions</th></tr></thead><tbody>{leads.map(lead => <tr className="border-t border-slate-100 align-top" key={lead.id}><td className="p-4"><p className="font-semibold">{lead.name}</p><p className="mt-1 text-xs text-slate-500">{lead.email}</p><p className="mt-1 text-xs text-slate-500">{lead.phone}</p></td><td className="p-4"><span className="rounded-md bg-teal-50 px-2 py-1 text-xs capitalize text-teal-800">{lead.stage}</span></td><td className="max-w-sm p-4"><p className="text-xs text-slate-500">{lead.source || "Not specified"}</p><p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-600">{lead.notes}</p></td><td className="min-w-60 p-4"><LeadActions lead={lead} /></td></tr>)}</tbody></table>{!leads.length ? <p className="p-10 text-center text-sm text-slate-500">No leads yet.</p> : null}</div>
  </section></AppShell>;
}
