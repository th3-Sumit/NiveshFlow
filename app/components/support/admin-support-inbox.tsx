"use client";

import { Check, ChevronDown, Inbox, Loader2, Mail, Search, UserRound } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { changeUserEmailAction, updateSupportRequestAction } from "@/app/actions/support";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { priorityLabels, statusLabels, supportPriorities, supportStatuses, type SupportActionState, type SupportRequestView, type SupportStatus } from "@/app/lib/support";
import { RequestAttachments, RequestBadges } from "./request-display";

const selectClass = "h-10 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10";

function RequestManagement({ request }: { request: SupportRequestView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [emailPending, emailTransition] = useTransition();
  const [result, setResult] = useState<SupportActionState>({ status: "idle" });
  const [emailResult, setEmailResult] = useState<SupportActionState>({ status: "idle" });
  const reply = useForm<{ status: SupportStatus; response: string }>({ defaultValues: { status: request.status, response: request.response ?? "" } });
  const email = useForm<{ newEmail: string; confirmed: boolean }>({ defaultValues: { newEmail: "", confirmed: false } });
  const resetReply = reply.reset;
  useEffect(() => {
    resetReply({ status: request.status, response: request.response ?? "" });
  }, [request.status, request.response, resetReply]);

  return (
    <div className="grid gap-6 border-t border-slate-100 bg-slate-50/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
        <UserRound className="mt-0.5 shrink-0 text-primary" size={18} />
        <div className="min-w-0"><p className="font-semibold">{request.user.name}</p><p className="mt-1 break-all text-slate-500">{request.user.email}</p><p className="mt-1 text-slate-500">{request.user.phone}</p></div>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{request.description}</p>
      <RequestAttachments request={request} />
      <form className="grid gap-3" noValidate onSubmit={reply.handleSubmit(values => {
        const data = new FormData();
        data.set("requestId", request.id); data.set("status", values.status); data.set("response", values.response);
        startTransition(async () => {
          try { const response = await updateSupportRequestAction(data); setResult(response); if (response.status === "success") router.refresh(); }
          catch { setResult({ status: "error", message: "The update failed. Please try again." }); }
        });
      })}>
        <div><Label htmlFor={`status-${request.id}`}>Status</Label><select className={selectClass} id={`status-${request.id}`} {...reply.register("status")} disabled={pending}>{supportStatuses.map(status => <option value={status} key={status}>{statusLabels[status]}</option>)}</select></div>
        <div><Label htmlFor={`reply-${request.id}`}>Response to the user</Label><Textarea id={`reply-${request.id}`} placeholder="Write a response..." disabled={pending} {...reply.register("response", { maxLength: { value: 3000, message: "Keep the response under 3,000 characters." } })} aria-invalid={Boolean(reply.formState.errors.response)} />{reply.formState.errors.response ? <p className="text-xs text-rose-700">{reply.formState.errors.response.message}</p> : null}</div>
        {result.message ? <p role="status" className={`text-sm ${result.status === "error" ? "text-rose-700" : "text-primary"}`}>{result.message}</p> : null}
        <Button className="w-fit" type="submit" size="sm" disabled={pending}>{pending ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />}Save response</Button>
      </form>
      {request.emailChange ? <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm"><p className="font-semibold text-primary">Email change completed</p><p className="mt-1 break-all text-slate-600">{request.emailChange.previous} to {request.emailChange.next}</p><p className="mt-1 text-xs text-slate-500">{new Date(request.emailChange.changedAt).toLocaleString()}</p></div> : (
        <details className="rounded-lg border border-slate-200 bg-white">
          <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-medium text-slate-700"><Mail size={16} />Change this user&apos;s email<ChevronDown size={15} className="ml-auto" /></summary>
          <form className="grid gap-3 border-t border-slate-100 p-4" noValidate onSubmit={email.handleSubmit(values => {
            const data = new FormData(); data.set("requestId", request.id); data.set("newEmail", values.newEmail);
            emailTransition(async () => {
              try { const response = await changeUserEmailAction(data); setEmailResult(response); if (response.status === "success") { email.reset(); router.refresh(); } }
              catch { setEmailResult({ status: "error", message: "The email couldn't be changed. Please try again." }); }
            });
          })}>
            <div><Label htmlFor={`new-email-${request.id}`}>New email address</Label><Input id={`new-email-${request.id}`} type="email" placeholder="New email requested by the user" disabled={emailPending} aria-invalid={Boolean(email.formState.errors.newEmail)} {...email.register("newEmail", { required: "Enter the new email.", pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email address." } })} />{email.formState.errors.newEmail ? <p className="mt-1 text-xs text-rose-700">{email.formState.errors.newEmail.message}</p> : null}</div>
            <label className="flex cursor-pointer items-start gap-2 text-xs leading-5 text-slate-600"><input className="mt-1 size-4 shrink-0 accent-teal-600" type="checkbox" disabled={emailPending} {...email.register("confirmed", { required: "Confirm the user's request before changing the email." })} /><span>I have verified that the account owner requested this email change. This will resolve the request and invalidate existing recovery codes.</span></label>
            {email.formState.errors.confirmed ? <p className="text-xs text-rose-700">{email.formState.errors.confirmed.message}</p> : null}
            {emailResult.message ? <p role="status" className={`text-sm ${emailResult.status === "error" ? "text-rose-700" : "text-primary"}`}>{emailResult.message}</p> : null}
            <Button className="w-fit" type="submit" size="sm" disabled={emailPending}>{emailPending ? <Loader2 className="animate-spin" size={15} /> : <Mail size={15} />}Confirm email change</Button>
          </form>
        </details>
      )}
    </div>
  );
}

export function AdminSupportInbox({ requests }: { requests: SupportRequestView[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const visible = requests.filter(request => (status === "all" || request.status === status) && (priority === "all" || request.priority === priority) && `${request.subject} ${request.description} ${request.user.name} ${request.user.email} ${request.reference}`.toLowerCase().includes(search.toLowerCase()));
  const openCount = requests.filter(request => request.status !== "resolved").length;
  return (
    <section className="border-y border-teal-100 py-6" id="support-inbox">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-semibold"><Inbox className="text-primary" size={21} />Support inbox</h2><p className="mt-1 text-sm text-slate-500">{openCount} active requests / {requests.length} recent requests</p></div></div>
      <div className="mt-5 flex flex-wrap gap-3"><div className="relative min-w-48 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><Input aria-label="Search support requests" className="h-10 pl-10" placeholder="Search requests or users" value={search} onChange={event => setSearch(event.target.value)} /></div><select aria-label="Filter request status" className={selectClass} value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option>{supportStatuses.map(value => <option value={value} key={value}>{statusLabels[value]}</option>)}</select><select aria-label="Filter request priority" className={selectClass} value={priority} onChange={event => setPriority(event.target.value)}><option value="all">All priorities</option>{supportPriorities.map(value => <option value={value} key={value}>{priorityLabels[value]}</option>)}</select></div>
      <div className="mt-5 grid gap-3">{visible.map(request => <details key={request.id} className="group overflow-hidden rounded-lg border border-slate-200 bg-white"><summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4 sm:p-5"><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{request.subject}</p><p className="mt-1 break-all text-xs text-slate-500">{request.user.name} / {request.user.email}</p><p className="mt-2 text-xs text-slate-400">{request.reference} / {new Date(request.createdAt).toLocaleString()}</p></div><RequestBadges request={request} /><ChevronDown className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" size={18} /></summary><RequestManagement request={request} /></details>)}{!visible.length ? <p className="py-10 text-center text-sm text-slate-500">{requests.length ? "No requests match these filters." : "The support inbox is empty."}</p> : null}</div>
    </section>
  );
}
