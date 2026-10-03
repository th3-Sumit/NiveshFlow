"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, History, LifeBuoy, Lightbulb, Loader2, MessageSquare, Paperclip, Plus, Send, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { createSupportRequestAction, getMySupportRequestsAction } from "@/app/actions/support";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { HELP_CENTER_EVENT, MAX_SUPPORT_FILES, SUPPORT_FILE_ACCEPT, priorityColors, priorityLabels, supportPriorities, validateSupportFile, wordCount, type SupportActionState, type SupportFormValues, type SupportRequestView, type SupportType } from "@/app/lib/support";
import { RequestAttachments, RequestBadges } from "./request-display";

const requestTypes = [{ value: "issue", label: "Issue", icon: AlertTriangle }, { value: "query", label: "Query", icon: MessageSquare }, { value: "feedback", label: "Feedback", icon: Lightbulb }] as const;
const defaults: SupportFormValues = { type: "issue", priority: "not_urgent", subject: "", description: "" };

function ErrorText({ message, id }: { message?: string; id?: string }) {
  return message ? <p className="mt-1.5 text-xs font-medium text-rose-700" id={id} role="alert">{message}</p> : null;
}

export function HelpCenter() {
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"new" | "history">("new");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const [result, setResult] = useState<SupportActionState>({ status: "idle" });
  const [requests, setRequests] = useState<SupportRequestView[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [pending, startTransition] = useTransition();
  const [loading, loadTransition] = useTransition();
  const { register, control, handleSubmit, reset, setError, setValue, formState: { errors } } = useForm<SupportFormValues>({ defaultValues: defaults, mode: "onTouched" });
  const priority = useWatch({ control, name: "priority" });
  const words = wordCount(useWatch({ control, name: "description" }));

  function loadRequests() {
    setHistoryError("");
    loadTransition(async () => {
      try {
        const response = await getMySupportRequestsAction();
        setRequests(response.requests);
        setHistoryError(response.error ?? "");
      } catch {
        setHistoryError("Your requests couldn't be loaded. Please try again.");
      }
    });
  }

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current?.close();
  }, [open]);

  useEffect(() => {
    function onHelp(event: Event) {
      const detail = (event as CustomEvent<{ subject?: string; type?: SupportType }>).detail;
      if (detail?.subject) {
        setValue("subject", detail.subject);
        setValue("type", detail.type ?? "query");
        setResult({ status: "idle" });
      }
      setTab("new");
      setOpen(true);
    }
    window.addEventListener(HELP_CENTER_EVENT, onHelp);
    return () => window.removeEventListener(HELP_CENTER_EVENT, onHelp);
  }, [setValue]);

  function addFiles(selected: File[]) {
    setFileError("");
    if (files.length + selected.length > MAX_SUPPORT_FILES) {
      setFileError("You can attach up to 3 files.");
      return;
    }
    for (const file of selected) {
      const error = validateSupportFile(file);
      if (error) { setFileError(error); return; }
    }
    setFiles(previous => [...previous, ...selected]);
  }

  function submit(values: SupportFormValues) {
    if (pending) return;
    setResult({ status: "idle" });
    setFileError("");
    const data = new FormData();
    Object.entries(values).forEach(([key, value]) => data.set(key, value));
    files.forEach(file => data.append("attachments", file));
    startTransition(async () => {
      try {
        const response = await createSupportRequestAction(data);
        setResult(response);
        if (response.errors) {
          for (const [field, messages] of Object.entries(response.errors)) {
            if (field === "attachments") setFileError(messages[0]);
            else setError(field as keyof SupportFormValues, { message: messages[0] });
          }
        }
        if (response.status === "success") { reset(defaults); setFiles([]); }
      } catch {
        setResult({ status: "error", message: "We couldn't send your request. Please try again." });
      }
    });
  }

  return (
    <>
      <Button aria-label="Open Help Center" className="fixed bottom-5 right-5 z-40 size-14 rounded-full border-4 border-white shadow-xl shadow-teal-950/20 transition-transform motion-safe:hover:-translate-y-1 sm:bottom-6 sm:right-7" onClick={() => setOpen(true)} size="icon" title="Help Center" type="button"><LifeBuoy size={24} /></Button>
      <dialog ref={dialog} aria-labelledby="help-title" className="fixed inset-0 m-auto h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-2xl border border-teal-100 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/35 backdrop:backdrop-blur-sm open:flex open:flex-col open:motion-safe:animate-dialog-in sm:mr-7 sm:mb-6" onCancel={() => setOpen(false)} onClose={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setOpen(false); } }}>
        <header className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-teal-50 text-primary"><LifeBuoy size={19} /></span><h2 className="text-lg font-semibold" id="help-title">Help Center</h2></div>
          <Button aria-label="Close Help Center" onClick={() => setOpen(false)} size="icon" variant="ghost"><X size={19} /></Button>
        </header>
        <div className="flex shrink-0 gap-1 border-b border-slate-100 px-5 py-3" aria-label="Help Center views">
          <Button aria-pressed={tab === "new"} size="sm" variant={tab === "new" ? "secondary" : "ghost"} onClick={() => setTab("new")}><Plus size={15} />New request</Button>
          <Button aria-pressed={tab === "history"} size="sm" variant={tab === "history" ? "secondary" : "ghost"} onClick={() => { setTab("history"); loadRequests(); }}><History size={15} />My requests</Button>
        </div>
        <div className="scrollbar-none min-h-0 overflow-y-auto p-5">
          {tab === "new" && result.status === "success" ? (
            <div className="py-8 text-center motion-safe:animate-content-in">
              <CheckCircle2 className="mx-auto text-primary" size={44} /><h3 className="mt-4 text-lg font-semibold">Request received</h3><p className="mt-2 text-sm text-slate-500">{result.message}</p><p className="mt-3 font-mono text-sm font-semibold text-primary">{result.reference}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2"><Button onClick={() => { setTab("history"); loadRequests(); }} size="sm">My requests<ArrowRight size={15} /></Button><Button onClick={() => setResult({ status: "idle" })} size="sm" variant="outline">New request</Button></div>
            </div>
          ) : tab === "new" ? (
            <form id="support-request-form" className="grid gap-5" noValidate onSubmit={handleSubmit(submit)}>
              <fieldset disabled={pending} className="grid min-w-0 gap-5 disabled:opacity-70">
                <fieldset><legend className="mb-2.5 text-sm font-medium">What would you like to do?</legend><div className="grid grid-cols-3 gap-2">{requestTypes.map(({ value, label, icon: Icon }) => <label className="cursor-pointer" key={value}><input className="peer sr-only" type="radio" value={value} {...register("type")} /><span className="flex h-20 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 transition-colors peer-checked:border-primary peer-checked:bg-teal-50 peer-checked:text-primary peer-focus-visible:ring-2 peer-focus-visible:ring-teal-500"><Icon size={20} />{label}</span></label>)}</div></fieldset>
                <div><Label htmlFor="support-priority">Priority</Label><div className="relative w-fit min-w-48"><span className={`pointer-events-none absolute left-3 top-1/2 size-2.5 -translate-y-1/2 rounded-full ${priorityColors[priority]}`} /><select id="support-priority" className="h-10 w-full cursor-pointer rounded-lg border border-slate-200 bg-white pl-8 pr-8 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10" {...register("priority")}>{supportPriorities.map(value => <option value={value} key={value}>{priorityLabels[value]}</option>)}</select></div></div>
                <div><Label htmlFor="support-subject">Subject</Label><Input id="support-subject" placeholder="Brief summary of your request" aria-invalid={Boolean(errors.subject)} aria-describedby={errors.subject ? "subject-error" : undefined} {...register("subject", { required: "Enter a subject.", minLength: { value: 5, message: "Use at least 5 characters." }, maxLength: { value: 120, message: "Use at most 120 characters." }, validate: value => value.trim().length >= 5 || "Use at least 5 characters." })} /><ErrorText id="subject-error" message={errors.subject?.message} /></div>
                <div><Label htmlFor="support-description">Description</Label><Textarea id="support-description" placeholder="Please explain your request in detail…" aria-invalid={Boolean(errors.description)} aria-describedby="description-hint description-error" {...register("description", { validate: value => wordCount(value) >= 10 || "Please use at least 10 words.", maxLength: { value: 5000, message: "Use at most 5,000 characters." } })} /><div className="mt-1 flex justify-between gap-3 text-xs text-slate-500" id="description-hint"><span>Minimum 10 words required.</span><span className={words >= 10 ? "text-primary" : ""}>{words} words</span></div><ErrorText id="description-error" message={errors.description?.message} /></div>
                <div><Label htmlFor="support-files">Attachments <span className="font-normal text-slate-400">(optional)</span></Label><input id="support-files" className="sr-only" ref={fileInput} accept={SUPPORT_FILE_ACCEPT} multiple type="file" onChange={event => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} /><button className="grid w-full cursor-pointer place-items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-4 py-5 text-sm transition-colors hover:border-teal-500 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-teal-500" onClick={() => fileInput.current?.click()} type="button" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)); }}><Paperclip size={23} className="mb-1 text-primary" /><span className="font-medium">Upload screenshots or files</span><span className="text-xs text-slate-500">PNG, JPG, PDF, DOCX · Up to 3 files, 5 MB each</span></button><ErrorText message={fileError} /><ul className="mt-2 space-y-2">{files.map((file, index) => <li className="flex items-center gap-2 rounded-lg bg-slate-50 pl-3 text-xs" key={`${file.name}-${index}`}><Paperclip size={14} className="shrink-0 text-slate-400" /><span className="min-w-0 flex-1 truncate">{file.name}</span><Button aria-label={`Remove ${file.name}`} size="icon" type="button" variant="ghost" onClick={() => setFiles(previous => previous.filter((_, i) => i !== index))}><X size={15} /></Button></li>)}</ul></div>
              </fieldset>
              {result.status === "error" && result.message ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{result.message}</p> : null}
            </form>
          ) : (
            <div className="grid gap-4">
              <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Your recent requests</h3><Button size="sm" variant="ghost" onClick={loadRequests} disabled={loading}>{loading ? <Loader2 size={15} className="animate-spin" /> : null}Refresh</Button></div>
              {historyError ? <p role="alert" className="text-sm text-rose-700">{historyError}</p> : !loading && !requests.length ? <div className="py-8 text-center text-sm text-slate-500"><MessageSquare className="mx-auto mb-3 text-slate-300" size={32} />No requests yet.</div> : null}
              {requests.map(request => <details className="group rounded-lg border border-slate-200" key={request.id}><summary className="cursor-pointer space-y-2 p-4 text-sm"><span className="block break-words font-semibold">{request.subject}</span><RequestBadges request={request} /><span className="block text-xs text-slate-400">{request.reference} · {new Date(request.createdAt).toLocaleDateString()}</span></summary><div className="space-y-4 border-t border-slate-100 p-4 text-sm"><p className="whitespace-pre-wrap break-words text-slate-600">{request.description}</p><RequestAttachments request={request} />{request.response ? <div className="rounded-lg bg-teal-50 p-3"><p className="mb-1 text-xs font-semibold text-primary">Support response</p><p className="whitespace-pre-wrap break-words text-slate-700">{request.response}</p></div> : <p className="text-xs text-slate-500">Awaiting a support response.</p>}</div></details>)}
            </div>
          )}
        </div>
        {tab === "new" && result.status !== "success" ? <footer className="shrink-0 border-t border-slate-100 bg-white px-5 py-4"><Button className="w-full" form="support-request-form" type="submit" disabled={pending}>{pending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}{pending ? "Sending request..." : "Send request"}</Button></footer> : null}
      </dialog>
    </>
  );
}
