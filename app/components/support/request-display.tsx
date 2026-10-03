import { Download } from "lucide-react";
import { attachmentPath, priorityColors, priorityLabels, statusLabels, type SupportRequestView } from "@/app/lib/support";

export function RequestBadges({ request }: { request: SupportRequestView }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
      <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-slate-700"><span className={`size-2 rounded-full ${priorityColors[request.priority]}`} />{priorityLabels[request.priority]}</span>
      <span className={`rounded-full px-2.5 py-1 ${request.status === "resolved" ? "bg-teal-50 text-teal-800" : "bg-sky-50 text-sky-800"}`}>{statusLabels[request.status]}</span>
      <span className="capitalize text-slate-500">{request.type}</span>
    </div>
  );
}

export function RequestAttachments({ request }: { request: SupportRequestView }) {
  if (!request.attachments.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {request.attachments.map(file => <a className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-teal-50" href={attachmentPath(request.id, file.id)} key={file.id}><Download className="shrink-0" size={14} /><span className="truncate">{file.name}</span><span className="shrink-0 text-slate-500">{(file.size / 1024).toFixed(0)} KB</span></a>)}
    </div>
  );
}
