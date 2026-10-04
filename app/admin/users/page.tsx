import Link from "next/link";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/app/components/app-shell";
import { AdminDetailsForm, AdminUserActions } from "@/app/components/admin/admin-forms";
import { Button } from "@/app/components/ui/button";
import { requireSuperAdmin } from "@/app/lib/data";
import { getManagedUsers } from "@/app/lib/admin-data";
import { privatePageMetadata } from "@/app/lib/seo";

export const metadata = privatePageMetadata("Manage users", "NiveshFlow user administration.");

const colors = { active: "bg-teal-50 text-teal-800", inactive: "bg-rose-50 text-rose-700", invited: "bg-blue-50 text-blue-700", expired: "bg-amber-50 text-amber-800" };
export default async function UsersPage({ searchParams }: { searchParams: Promise<{ query?: string; status?: string; page?: string }> }) {
  const admin = await requireSuperAdmin();
  const params = await searchParams;
  const data = await getManagedUsers(params);
  const pageLink = (page: number) => "/admin/users?" + new URLSearchParams({ query: params.query ?? "", status: params.status ?? "", page: String(page) });
  return <AppShell title="Users" user={admin}><section className="mx-auto grid max-w-7xl gap-6 py-8">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-semibold">Users</h1><p className="mt-1 text-sm text-slate-500">{data.total} accounts</p></div><AdminDetailsForm mode="invite" /></header>
    <form className="flex flex-wrap gap-3" action="/admin/users">
      <label className="relative min-w-48 flex-1"><Search className="absolute left-3 top-3 text-slate-400" size={16} /><input name="query" defaultValue={params.query} aria-label="Search users" placeholder="Search name, email or phone" maxLength={120} className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm" /></label>
      <select name="status" aria-label="Filter user status" defaultValue={params.status ?? ""} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="invited">Invited</option><option value="expired">Expired</option></select>
      <Button size="sm" type="submit" className="h-10"><Search />Search</Button>
    </form>
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white/90">
      <table className="w-full text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500"><tr><th className="p-4">User</th><th className="p-4">Status</th><th className="p-4">Activity / invitation</th><th className="p-4">Actions</th></tr></thead>
        <tbody>{data.users.map(user => <tr key={user.id} className="border-b border-slate-100 align-top last:border-0">
          <td className="p-4"><p className="font-semibold">{user.name}</p><p className="mt-1 break-all text-xs text-slate-500">{user.email}</p><p className="mt-1 text-xs text-slate-500">{user.phone}</p></td>
          <td className="p-4"><span className={"inline-flex rounded-md px-2 py-1 text-xs font-medium capitalize " + colors[user.status]}>{user.status}</span>{user.role === "super_admin" ? <p className="mt-2 text-xs text-slate-500">Super admin</p> : null}</td>
          <td className="min-w-44 p-4 text-xs leading-6 text-slate-500">{user.invitationExpiresAt ? <>Expires: {new Date(user.invitationExpiresAt).toLocaleString("en-IN")}<p className={user.invitationDelivery === "failed" ? "text-rose-600" : ""}>Email: {user.invitationDelivery ?? "pending"}</p></> : <>Last sign-in: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString("en-IN") : "Never"}<p>Created: {new Date(user.createdAt).toLocaleDateString("en-IN")}</p></>}</td>
          <td className="min-w-60 p-4"><AdminUserActions user={user} /></td>
        </tr>)}</tbody>
      </table>
      {!data.users.length ? <p className="p-10 text-center text-sm text-slate-500">No users match these filters.</p> : null}
    </div>
    <footer className="flex items-center justify-between gap-3 text-xs text-slate-500"><span>Page {data.page} of {data.pages}</span><div className="flex gap-2">{data.page > 1 ? <Button asChild variant="outline" size="sm"><Link href={pageLink(data.page - 1)}><ChevronLeft />Previous</Link></Button> : null}{data.page < data.pages ? <Button asChild variant="outline" size="sm"><Link href={pageLink(data.page + 1)}>Next<ChevronRight /></Link></Button> : null}</div></footer>
  </section></AppShell>;
}
