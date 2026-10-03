import "server-only";
import { ObjectId } from "mongodb";
import { requireCurrentUser, requireSuperAdmin } from "./data";
import { getDb, type SupportRequestDoc } from "./mongodb";
import type { SupportRequestView } from "./support";

export function supportRequestView(request: SupportRequestDoc): SupportRequestView {
  return {
    id: request._id.toString(),
    reference: `NF-${request._id.toString().slice(-8).toUpperCase()}`,
    type: request.type,
    priority: request.priority,
    subject: request.subject,
    description: request.description,
    status: request.status,
    user: { name: request.user.name, email: request.user.email, phone: request.user.phone, ...(request.user.avatarUrl ? { avatarUrl: request.user.avatarUrl } : {}) },
    response: request.response,
    attachments: request.attachments.map(({ id, name, size }) => ({ id, name, size })),
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    emailChange: request.emailChange ? {
      previous: request.emailChange.previous,
      next: request.emailChange.next,
      changedAt: request.emailChange.changedAt.toISOString(),
    } : undefined,
  };
}

export async function getMySupportRequests() {
  const user = await requireCurrentUser();
  const db = await getDb();
  const requests = await db.collection<SupportRequestDoc>("supportRequests")
    .find({ userId: new ObjectId(user.id) }).sort({ createdAt: -1 }).limit(30).toArray();
  return requests.map(supportRequestView);
}

export async function getAdminSupportRequests() {
  await requireSuperAdmin();
  const db = await getDb();
  const requests = await db.collection<SupportRequestDoc>("supportRequests")
    .find({}).sort({ createdAt: -1 }).limit(100).toArray();
  return requests.map(supportRequestView);
}
