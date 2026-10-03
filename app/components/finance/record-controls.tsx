"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { updateRecordAction, deleteRecordAction } from "@/app/actions/finance";
import { recordFields, recordSchemas, type RecordKind } from "@/app/lib/record-management";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Modal } from "@/app/components/ui/modal";

export function RecordControls({ kind, record, accounts = [], hasPayments = false }: {
  kind: RecordKind; record: { id: string; [key: string]: unknown };
  accounts?: Array<{ id: string; name: string }>; hasPayments?: boolean;
}) {
  const [mode, setMode] = useState<"edit" | "delete" | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const defaults = Object.fromEntries(Object.entries(record).map(([key, value]) => [key,
    typeof value === "string" && /Date$/.test(key) ? value.slice(0, 10) : Array.isArray(value) ? value.join(", ") : String(value ?? ""),
  ]));
  const form = useForm<Record<string, string>>({ defaultValues: { toAccountId: "", merchant: "", description: "", tags: "", principal: "0", interest: "0", fee: "0", ...defaults } });
  const selectedType = useWatch({ control: form.control, name: "type" });
  const isPayment = record.type === "debt_payment";
  async function submit(values: Record<string, string>) {
    setMessage("");
    const parsed = recordSchemas[kind].safeParse({ ...values, ...(isPayment ? { amount: 1 } : {}) });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) form.setError(String(issue.path[0]), { message: issue.message });
      return;
    }
    const data = new FormData();
    for (const [key, value] of Object.entries(values)) data.set(key, value);
    data.set("kind", kind); data.set("id", record.id); setBusy(true);
    try {
      const result = await updateRecordAction(data);
      if (result.status === "success") { setMode(null); router.refresh(); }
      else setMessage(result.message);
    } catch { setMessage("Couldn't update the record. Please try again."); }
    finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setMessage("");
    const data = new FormData(); data.set("kind", kind); data.set("id", record.id);
    try {
      const result = await deleteRecordAction(data);
      if (result.status === "success") { setMode(null); router.refresh(); }
      else setMessage(result.message);
    } catch { setMessage("Couldn't remove the record. Please try again."); }
    finally { setBusy(false); }
  }
  function open(next: "edit" | "delete") { form.reset({ toAccountId: "", merchant: "", description: "", tags: "", principal: "0", interest: "0", fee: "0", ...defaults }); setMessage(""); setMode(next); }
  return (
    <>
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon" aria-label={"Edit " + kind} title={"Edit " + kind} onClick={() => open("edit")}><Pencil /></Button>
        <Button variant="destructive" size="icon" aria-label={"Remove " + kind} title={"Remove " + kind} onClick={() => open("delete")}><Trash2 /></Button>
      </div>
      <Modal open={mode !== null} onClose={() => setMode(null)} title={(mode === "edit" ? "Edit " : "Remove ") + kind} busy={busy} className={mode === "edit" ? "max-w-2xl" : undefined}>
        {mode === "edit" ? (
          <form noValidate onSubmit={form.handleSubmit(submit)} className="grid gap-4 sm:grid-cols-2">
            {hasPayments ? <p className="text-sm text-slate-500 sm:col-span-2">Principal is calculated from linked payments. Edit those entries to change the balance.</p> : null}
            {recordFields(kind, isPayment).map(field => {
              if (field.name === "toAccountId" && selectedType !== "transfer") return null;
              const choices = ["accountId", "toAccountId"].includes(field.name) ? [{ value: "", label: "Choose an account" }, ...accounts.map(account => ({ value: account.id, label: account.name }))] : field.options;
              const readOnly = field.readOnly || (hasPayments && ["originalPrincipal", "currentPrincipal"].includes(field.name));
              const id = record.id + "-" + field.name;
              return (
                <div key={field.name} className={"grid min-w-0 gap-1.5 " + (field.type === "textarea" || field.name === "tags" ? "sm:col-span-2" : "")}>
                  <label htmlFor={id} className="text-sm font-medium">{field.label}</label>
                  {choices ? <select id={id} disabled={busy} aria-invalid={!!form.formState.errors[field.name]} {...form.register(field.name)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" onChange={readOnly ? () => {} : form.register(field.name).onChange}>{choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select>
                    : field.type === "textarea" ? <textarea id={id} disabled={busy} {...form.register(field.name)} rows={3} className="rounded-lg border border-slate-200 p-3 text-sm" />
                    : <Input id={id} disabled={busy} {...form.register(field.name)} type={field.type ?? "text"} step={field.type === "number" ? "0.01" : undefined} readOnly={readOnly} aria-invalid={!!form.formState.errors[field.name]} />}
                  {form.formState.errors[field.name] ? <p role="alert" className="text-xs text-rose-600">{form.formState.errors[field.name]?.message}</p> : null}
                </div>
              );
            })}
            {message ? <p role="alert" className="text-sm text-rose-600 sm:col-span-2">{message}</p> : null}
            <Button type="submit" disabled={busy} className="sm:col-span-2">{busy ? <Loader2 className="animate-spin" /> : null}Save changes</Button>
          </form>
        ) : (
          <div className="grid gap-5">
            <p className="text-sm leading-6 text-slate-600">Remove this {kind} permanently? {kind === "transaction" ? "Its account and debt balance effects will be reversed." : "Records with linked transactions or payments must be unlinked first."}</p>
            {message ? <p role="alert" className="text-sm text-rose-600">{message}</p> : null}
            <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setMode(null)}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={remove}>{busy ? <Loader2 className="animate-spin" /> : <Trash2 />}Remove record</Button></div>
          </div>
        )}
      </Modal>
    </>
  );
}
