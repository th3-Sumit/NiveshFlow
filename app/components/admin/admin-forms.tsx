"use client";

import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Loader2, MailPlus, Pencil, Plus, RotateCw, ShieldOff, ShieldCheck, Trash2 } from "lucide-react";
import { inviteUserAction, reinviteUserAction, setUserAccessAction, updateManagedUserAction, saveLeadAction, deleteLeadAction } from "@/app/actions/admin";
import { inviteUserSchema, leadSchema, type AdminUserView, type LeadView, type ActionResult } from "@/app/lib/user-lifecycle";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Modal } from "@/app/components/ui/modal";

type Details = { name: string; email: string; phone: string; source: string; stage: string; notes: string };
const empty: Details = { name: "", email: "", phone: "", source: "", stage: "new", notes: "" };
export function AdminDetailsForm({ mode, user, lead }: { mode: "invite" | "user" | "lead"; user?: AdminUserView; lead?: LeadView }) {
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  const defaults = { ...empty, ...(user ?? lead ?? {}), ...(mode === "invite" ? { stage: "new" } : {}) };
  const form = useForm<Details>({ defaultValues: defaults, mode: "onTouched" });
  async function submit(values: Details) {
    setMessage("");
    const schema = mode === "lead" ? leadSchema : mode === "user" ? inviteUserSchema.omit({ email: true }) : inviteUserSchema;
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) form.setError(issue.path[0] as keyof Details, { message: issue.message });
      return;
    }
    const data = new FormData();
    for (const [key, value] of Object.entries(values)) data.set(key, value);
    if (mode === "user") data.set("id", user!.id);
    if (mode === "lead" && lead) data.set("id", lead.id);
    if (mode === "invite" && lead) data.set("leadId", lead.id);
    try {
      const action = mode === "invite" ? inviteUserAction : mode === "user" ? updateManagedUserAction : saveLeadAction;
      const result = await action(data);
      router.refresh();
      if (result.status === "success") { setOpen(false); setMessage(result.message); }
      else { setMessage(result.message); for (const [key, errors] of Object.entries(result.errors ?? {})) form.setError(key as keyof Details, { message: errors[0] }); }
    } catch { setMessage("Unable to save. Please try again."); }
  }
  const title = mode === "invite" ? "Invite user" : mode === "user" ? "Update user" : lead ? "Update lead" : "Add lead";
  return (
    <>
      <Button variant={mode === "invite" && !lead ? "default" : "outline"} size="sm" onClick={() => { form.reset(defaults); setMessage(""); setOpen(true); }}>
        {mode === "invite" ? <MailPlus /> : user || lead ? <Pencil /> : <Plus />}{title}
      </Button>
      {!open && message ? <p role="status" className="max-w-sm text-xs text-teal-700">{message}</p> : null}
      <Modal open={open} onClose={() => setOpen(false)} title={title} busy={form.formState.isSubmitting}>
        <form noValidate className="grid gap-4" onSubmit={form.handleSubmit(submit)}>
          {mode === "invite" ? <p className="text-sm leading-6 text-slate-500">The invitation expires after 3 days. The recipient chooses their own password.</p> : null}
          {(["name", "email", "phone"] as const).map(key => (
            <div key={key} className="grid gap-1.5">
              <label htmlFor={prefix + "-" + key} className="text-sm font-medium capitalize">{key}</label>
              <Input id={prefix + "-" + key} type={key === "email" ? "email" : key === "phone" ? "tel" : "text"} readOnly={key === "email" && (mode === "user" || (mode === "invite" && !!lead))} autoComplete={key} {...form.register(key, { validate: value => {
                if (key === "email" && mode === "user") return true;
                const valid = inviteUserSchema.shape[key].safeParse(value);
                return valid.success || valid.error.issues[0].message;
              } })} aria-invalid={!!form.formState.errors[key]} />
              {form.formState.errors[key] ? <p role="alert" className="text-xs text-rose-600">{form.formState.errors[key]?.message}</p> : null}
            </div>
          ))}
          {mode === "lead" ? <>
            <label className="grid gap-1.5 text-sm font-medium">Source<Input {...form.register("source")} maxLength={80} /></label>
            <label className="grid gap-1.5 text-sm font-medium">Stage<select {...form.register("stage")} className="h-11 rounded-lg border border-slate-200 bg-white px-3"><option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option></select></label>
            <label className="grid gap-1.5 text-sm font-medium">Notes<textarea {...form.register("notes")} maxLength={2000} rows={3} className="rounded-lg border border-slate-200 p-3" /></label>
          </> : null}
          {message ? <p role="alert" className="text-sm text-rose-600">{message}</p> : null}
          <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : mode === "invite" ? <MailPlus /> : null}{mode === "invite" ? "Send invitation" : "Save changes"}</Button>
        </form>
      </Modal>
    </>
  );
}

export function AdminUserActions({ user }: { user: AdminUserView }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const router = useRouter();
  async function run(action: typeof reinviteUserAction, fields: Record<string, string>) {
    setBusy(true); setResult(null);
    const data = new FormData(); data.set("id", user.id);
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    try { const response = await action(data); setResult(response); if (response.status === "success") setConfirm(false); router.refresh(); }
    catch { setResult({ status: "error", message: "Couldn't complete this change. Please try again." }); }
    finally { setBusy(false); }
  }
  if (user.role === "super_admin") return <span className="text-xs text-slate-400">Protected account</span>;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <AdminDetailsForm mode="user" user={user} />
        {["invited", "expired"].includes(user.status) ? <Button variant="outline" size="sm" disabled={busy} onClick={() => run(reinviteUserAction, {})}><RotateCw />Reinvite</Button> : null}
        <Button size="sm" variant={user.status === "inactive" ? "outline" : "destructive"} disabled={busy} onClick={() => setConfirm(true)}>{user.status === "inactive" ? <ShieldCheck /> : <ShieldOff />}{user.status === "inactive" ? "Enable" : "Disable"}</Button>
      </div>
      {result ? <p role="status" className={"max-w-md text-xs " + (result.status === "error" ? "text-rose-600" : "text-teal-700")}>{result.message}</p> : null}
      <Modal title={user.status === "inactive" ? "Enable user" : "Disable user"} open={confirm} onClose={() => setConfirm(false)} busy={busy}>
        <p className="mb-5 break-words text-sm leading-6 text-slate-600">{user.email}: {user.status === "inactive" ? "Restore sign-in access? Unactivated invitations still require a valid link and password setup." : "Block sign-in and invalidate all existing sessions? Personal finance data will be retained."}</p>
        {result?.status === "error" ? <p role="alert" className="mb-4 text-sm text-rose-600">{result.message}</p> : null}
        <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setConfirm(false)}>Cancel</Button><Button disabled={busy} onClick={() => run(setUserAccessAction, { enabled: String(user.status === "inactive") })}>{busy ? <Loader2 className="animate-spin" /> : null}Confirm</Button></div>
      </Modal>
    </div>
  );
}

export function LeadActions({ lead }: { lead: LeadView }) {
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const router = useRouter();
  async function remove() {
    setBusy(true); const data = new FormData(); data.set("id", lead.id);
    try { const result = await deleteLeadAction(data); if (result.status === "success") { setOpen(false); router.refresh(); } else setMessage(result.message); }
    catch { setMessage("Couldn't remove the lead."); } finally { setBusy(false); }
  }
  return <div className="flex flex-wrap gap-2">
    {!lead.userId ? <><AdminDetailsForm mode="lead" lead={lead} /><AdminDetailsForm mode="invite" lead={lead} /></> : null}
    <Button aria-label={"Remove lead " + lead.name} title="Remove lead" variant="destructive" size="icon" onClick={() => setOpen(true)}><Trash2 /></Button>
    <Modal open={open} onClose={() => setOpen(false)} title="Remove lead" busy={busy}>
      <p className="mb-5 text-sm text-slate-600">Remove this prospect record? Any associated user account will remain unchanged.</p>
      {message ? <p role="alert" className="mb-4 text-sm text-rose-600">{message}</p> : null}
      <Button variant="destructive" onClick={remove} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Trash2 />}Remove lead</Button>
    </Modal>
  </div>;
}
