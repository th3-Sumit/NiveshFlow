"use client";

import { useEffect, useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { createFinanceRecordAction } from "@/app/actions/finance";
import { createDefaults, createFields, createInput, financeCreateSchemas, type FinanceCreateKind } from "@/app/lib/finance-forms";
import type { FinanceOption } from "@/app/lib/finance-list";
import { formatCurrency } from "@/app/lib/currency";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Modal } from "@/app/components/ui/modal";

export const selectClass = "h-11 w-full min-w-0 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 disabled:cursor-not-allowed disabled:opacity-60";
const labels = { account: "Add account", transaction: "Add transaction", debt: "Add debt", payment: "Record payment", bill: "Add bill", goal: "Add savings goal" };

export function FinanceCreateDialog({ kind, accounts = [], debts = [], debtId, compact = false, onSuccess }: {
  kind: FinanceCreateKind; accounts?: FinanceOption[]; debts?: FinanceOption[]; debtId?: string; compact?: boolean; onSuccess?: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter(), id = useId();
  const form = useForm<Record<string, string>>({ defaultValues: createDefaults(kind, debtId), mode: "onTouched", resolver: values => {
    const parsed = financeCreateSchemas[kind].safeParse(createInput(kind, values));
    if (parsed.success) return { values, errors: {} };
    return { values: {}, errors: Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0]), { type: "validate", message: issue.message }])) };
  } });
  const values = useWatch({ control: form.control });
  useEffect(() => { if (open) form.setFocus(createFields(kind)[0].name); }, [open, form, kind]);
  const activeAccounts = accounts.filter(account => account.status === "active");
  const activeDebts = debts.filter(debt => debt.status === "active");
  const missingAccount = ["transaction", "payment"].includes(kind) && !activeAccounts.length;
  const missingDebt = kind === "payment" && !activeDebts.length;
  async function submit(input: Record<string, string>) {
    form.clearErrors(); setMessage("");
    const parsed = financeCreateSchemas[kind].safeParse(createInput(kind, input));
    if (!parsed.success) {
      for (const issue of parsed.error.issues) form.setError(String(issue.path[0]), { message: issue.message });
      form.setFocus(String(parsed.error.issues[0].path[0])); return;
    }
    if (kind === "payment" && Number(input.principalAmount) > (activeDebts.find(debt => debt.id === input.debtId)?.currentPrincipal ?? 0)) {
      form.setError("principalAmount", { message: "Principal cannot exceed the remaining debt balance." }); form.setFocus("principalAmount"); return;
    }
    const data = new FormData(); data.set("kind", kind);
    for (const [key, value] of Object.entries(parsed.data)) data.set(key, String(value));
    setBusy(true);
    try {
      const result = await createFinanceRecordAction(data);
      if (result.status === "success") { setOpen(false); onSuccess?.(result.message); router.refresh(); }
      else {
        setMessage(result.message);
        for (const [field, errors] of Object.entries(result.errors ?? {})) if (errors?.[0]) form.setError(field, { message: errors[0] });
      }
    } catch { setMessage("Couldn't save the record. Please try again."); }
    finally { setBusy(false); }
  }
  return <>
    <Button variant={compact ? "outline" : "default"} size={compact ? "sm" : "default"} onClick={() => { form.reset(createDefaults(kind, debtId)); setMessage(""); setOpen(true); }}><Plus aria-hidden="true" />{compact ? "Pay" : labels[kind]}</Button>
    <Modal open={open} onClose={() => setOpen(false)} title={labels[kind]} busy={busy} className="max-w-2xl" footer={<><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" form={id} disabled={busy || missingAccount || missingDebt}>{busy ? <Loader2 className="animate-spin" /> : <Plus />}{labels[kind]}</Button></>}>
      <form id={id} noValidate onSubmit={form.handleSubmit(submit)}>
        {missingAccount || missingDebt ? <p role="status" className="mb-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{missingAccount ? "Add an active account before recording a transaction or payment." : "Add an active debt before recording a payment."}</p> : null}
        <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
          {createFields(kind).map(field => {
            if (field.name === "toAccountId" && values.type !== "transfer") return null;
            const choices = ["accountId", "toAccountId"].includes(field.name) ? [{ value: "", label: "Choose an account" }, ...activeAccounts.filter(account => field.name !== "toAccountId" || account.id !== values.accountId).map(account => ({ value: account.id, label: account.name }))]
              : field.name === "debtId" ? [{ value: "", label: "Choose a debt" }, ...activeDebts.map(debt => ({ value: debt.id, label: debt.name }))] : field.options;
            const error = form.formState.errors[field.name]?.message;
            const fieldId = id + field.name, errorId = fieldId + "-error";
            return <div key={field.name} className={"grid min-w-0 gap-1.5 " + (field.type === "textarea" || field.name === "tags" ? "sm:col-span-2" : "")}>
              <label htmlFor={fieldId} className="text-sm font-medium text-slate-700">{field.label}</label>
              {choices ? <select id={fieldId} className={selectClass} {...form.register(field.name)} aria-invalid={!!error} aria-describedby={error ? errorId : undefined}>{choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select>
                : field.type === "textarea" ? <textarea id={fieldId} rows={3} {...form.register(field.name)} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} className="w-full resize-y rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15" />
                : <Input id={fieldId} {...form.register(field.name)} type={field.type ?? "text"} step={field.type === "number" ? "0.01" : undefined} inputMode={field.type === "number" ? "decimal" : undefined} placeholder={field.name === "currentPrincipal" ? "Same as original principal" : undefined} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} />}
              {error ? <p id={errorId} role="alert" className="text-xs text-rose-600">{error}</p> : null}
            </div>;
          })}
        </fieldset>
        {kind === "payment" ? <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-sm"><span className="text-slate-500">Remaining principal: {formatCurrency(activeDebts.find(debt => debt.id === values.debtId)?.currentPrincipal ?? 0)}</span><span className="font-semibold">Total: {formatCurrency(["principalAmount", "interestAmount", "feeAmount"].reduce((sum, field) => sum + (Number(values[field]) || 0), 0))}</span></div> : null}
        {message ? <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{message}</p> : null}
      </form>
    </Modal>
  </>;
}
