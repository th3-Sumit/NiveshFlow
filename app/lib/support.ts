import { z } from "zod";

export const supportTypes = ["issue", "query", "feedback"] as const;
export const supportPriorities = ["critical", "emergency", "fyi", "not_urgent"] as const;
export const supportStatuses = ["open", "in_progress", "resolved"] as const;
export type SupportType = (typeof supportTypes)[number];
export type SupportPriority = (typeof supportPriorities)[number];
export type SupportStatus = (typeof supportStatuses)[number];

export const priorityLabels: Record<SupportPriority, string> = {
  critical: "Critical", emergency: "Emergency", fyi: "Just FYI", not_urgent: "Nothing Urgent",
};
export const priorityColors: Record<SupportPriority, string> = {
  critical: "bg-rose-500", emergency: "bg-orange-500", fyi: "bg-sky-500", not_urgent: "bg-emerald-500",
};
export const statusLabels: Record<SupportStatus, string> = {
  open: "Open", in_progress: "In progress", resolved: "Resolved",
};
export const HELP_CENTER_EVENT = "niveshflow:open-help";
export const MAX_SUPPORT_FILES = 3;
export const MAX_SUPPORT_FILE_BYTES = 5 * 1024 * 1024;
export const SUPPORT_FILE_ACCEPT = ".png,.jpg,.jpeg,.pdf,.docx";

export function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export const supportRequestSchema = z.object({
  type: z.enum(supportTypes),
  priority: z.enum(supportPriorities),
  subject: z.string().trim().min(5, "Subject must be at least 5 characters.").max(120, "Keep the subject under 120 characters."),
  description: z.string().trim().max(5000, "Keep the description under 5,000 characters.").refine(value => wordCount(value) >= 10, "Please describe your request in at least 10 words."),
});
export type SupportFormValues = z.infer<typeof supportRequestSchema>;
export type SupportAttachment = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  publicId: string;
  assetId: string;
  resourceType: "image" | "raw";
  format: string;
};
export type SupportRequestView = SupportFormValues & {
  id: string;
  reference: string;
  status: SupportStatus;
  createdAt: string;
  updatedAt: string;
  response?: string;
  user: { name: string; email: string; phone: string; avatarUrl?: string };
  attachments: Array<Pick<SupportAttachment, "id" | "name" | "size">>;
  emailChange?: { previous: string; next: string; changedAt: string };
};
export type SupportActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  reference?: string;
  errors?: Record<string, string[]>;
};

export function validateSupportFile(file: Pick<File, "name" | "type" | "size">) {
  const mimeTypes: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!mimeTypes[extension] || (file.type && file.type !== mimeTypes[extension])) {
    return "Choose PNG, JPG, PDF, or DOCX files.";
  }
  if (file.size === 0 || file.size > MAX_SUPPORT_FILE_BYTES) {
    return "Each attachment must be between 1 byte and 5 MB.";
  }
  return undefined;
}

export function attachmentPath(requestId: string, attachmentId: string) {
  return `/api/support/${requestId}/attachments/${attachmentId}`;
}
