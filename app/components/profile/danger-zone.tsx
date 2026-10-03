"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { AlertTriangle, Loader2, LockKeyhole, Eye, EyeOff, Trash2 } from "lucide-react";
import { prepareAccountDeletionAction, deleteMyAccountAction } from "@/app/actions/account-deletion";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Modal } from "@/app/components/ui/modal";

type Values = { confirmation: string; password: string; reason: string; feedback: string };
export function DangerZone({ protectedAccount }: { protectedAccount: boolean }) {
  const [open, setOpen] = useState(false); const [phrase, setPhrase] = useState("");
  const [preparing, setPreparing] = useState(false); const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);
  const form = useForm<Values>({ defaultValues: { confirmation: "", password: "", reason: "", feedback: "" } });
  async function prepare() {
    setOpen(true); setPreparing(true); setMessage(""); setPhrase(""); setVisible(false); form.reset();
    try { const result = await prepareAccountDeletionAction(); if (result.phrase) setPhrase(result.phrase); else setMessage(result.error ?? "Please try again."); }
    catch { setMessage("Couldn't prepare the confirmation. Close and reopen this dialog."); } finally { setPreparing(false); }
  }
  async function remove(values: Values) {
    setMessage(""); const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value);
    try {
      const result = await deleteMyAccountAction(data);
      if (result) setMessage(result.message);
    } catch { setMessage("Couldn't confirm account deletion. Please refresh before trying again."); }
  }
  return (
    <section className="grid gap-4 rounded-lg border border-rose-200 bg-white/90 p-6 lg:col-span-2">
      <div className="flex items-center gap-2"><AlertTriangle size={18} className="text-rose-600" /><h2 className="text-lg font-semibold">Danger zone</h2></div>
      <div className="flex flex-wrap items-center justify-between gap-5">
        <p className="max-w-xl text-sm leading-6 text-slate-500">{protectedAccount ? "The super admin account cannot be deleted here." : "Permanently delete your account, finance records, profile image, and support requests. This cannot be undone."}</p>
        {!protectedAccount ? <Button variant="destructive" onClick={prepare}><Trash2 />Delete my account</Button> : null}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Permanently delete account" busy={form.formState.isSubmitting || preparing}>
        {preparing ? <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="animate-spin" size={16} />Preparing confirmation...</p> : null}
        {!preparing && phrase ? <form noValidate onSubmit={form.handleSubmit(remove)} className="grid gap-4">
          <p className="rounded-lg bg-rose-50 p-3 text-sm leading-6 text-rose-800">All your account data will be removed. You will be signed out and receive an email confirmation. Export anything you need before continuing.</p>
          <div className="grid gap-2"><label htmlFor="delete-confirmation" className="text-sm font-medium">Type this exact text to confirm</label><code className="select-all break-all rounded-md bg-slate-100 p-3 text-sm">{phrase}</code><Input id="delete-confirmation" autoComplete="off" spellCheck={false} {...form.register("confirmation", { validate: value => value === phrase || "Type the confirmation text exactly as shown." })} />{form.formState.errors.confirmation ? <p role="alert" className="text-xs text-rose-600">{form.formState.errors.confirmation.message}</p> : null}</div>
          <div className="grid gap-2"><label htmlFor="delete-password" className="text-sm font-medium">Current password</label><div className="relative"><LockKeyhole size={16} className="pointer-events-none absolute left-3 top-4 text-slate-400" /><Input id="delete-password" type={visible ? "text" : "password"} placeholder="****" autoComplete="current-password" className="pl-10 pr-12" {...form.register("password", { required: "Enter your current password.", maxLength: 128 })} /><Button type="button" variant="ghost" size="icon" title={visible ? "Hide password" : "Show password"} aria-label={visible ? "Hide password" : "Show password"} className="absolute right-1 top-1" onClick={() => setVisible(!visible)}>{visible ? <EyeOff /> : <Eye />}</Button></div>{form.formState.errors.password ? <p role="alert" className="text-xs text-rose-600">{form.formState.errors.password.message}</p> : null}</div>
          <label className="grid gap-2 text-sm font-medium">Why are you leaving? (optional)<select {...form.register("reason")} className="h-11 rounded-lg border border-slate-200 bg-white px-3"><option value="">Prefer not to say</option><option value="not_needed">I no longer need it</option><option value="missing_features">Missing features</option><option value="privacy">Privacy concerns</option><option value="too_complex">Too difficult to use</option><option value="other">Other</option></select></label>
          <label className="grid gap-2 text-sm font-medium">Feedback (optional)<textarea {...form.register("feedback", { maxLength: 2000 })} maxLength={2000} rows={3} placeholder="What could we improve?" className="rounded-lg border border-slate-200 p-3 text-sm" /></label>
          <p className="text-xs leading-5 text-slate-500">Feedback is retained without your account identity and shown to the admin. Please don’t include personal information. Failed email delivery or image cleanup will be retried separately.</p>
          {message ? <p role="alert" className="text-sm text-rose-600">{message}</p> : null}
          <Button className="h-auto min-h-11 whitespace-normal py-3" variant="destructive" type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Trash2 />}Permanently delete my account</Button>
        </form> : !preparing && message ? <p role="alert" className="text-sm text-rose-600">{message}</p> : null}
      </Modal>
    </section>
  );
}
