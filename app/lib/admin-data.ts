import "server-only";
import type { Filter } from "mongodb";
import { requireSuperAdmin } from "./data";
import { getDb, type UserDoc, type LeadDoc, type DeletionFeedbackDoc } from "./mongodb";
import { userStatus, userStatuses, type AdminUserView, type AdminOverview, type LeadView, type UserStatus } from "./user-lifecycle";

export function adminUserView(user: UserDoc): AdminUserView {
  return { id: user._id.toString(), name: user.name, email: user.email, phone: user.phone, role: user.role,
    status: userStatus(user), createdAt: user.createdAt.toISOString(), lastLoginAt: user.lastLoginAt?.toISOString(),
    invitationExpiresAt: user.invitation?.expiresAt.toISOString(), invitationDelivery: user.invitation?.delivery };
}

export function statusQuery(status?: string): Filter<UserDoc> {
  if (status === "inactive") return { status: "disabled" };
  if (status === "invited") return { status: "invited", "invitation.expiresAt": { $gt: new Date() } };
  if (status === "expired") return { status: "invited", $or: [{ "invitation.expiresAt": { $lte: new Date() } }, { "invitation.expiresAt": { $exists: false } }] };
  if (status === "active") return { $or: [{ status: "active" }, { status: { $exists: false } }] };
  return {};
}

export async function getManagedUsers(params: { query?: string; status?: string; page?: string }) {
  await requireSuperAdmin();
  const db = await getDb();
  const query = (params.query ?? "").trim().slice(0, 120).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const filter: Filter<UserDoc> = { $and: [statusQuery(params.status), ...(query ? [{ $or: [{ name: { $regex: query, $options: "i" } }, { email: { $regex: query, $options: "i" } }, { phone: { $regex: query, $options: "i" } }] }] : [])] };
  const total = await db.collection<UserDoc>("users").countDocuments(filter);
  const pages = Math.max(1, Math.ceil(total / 20));
  const page = Math.min(pages, Math.max(1, Number.parseInt(params.page ?? "1") || 1));
  const users = await db.collection<UserDoc>("users").find(filter, { projection: { passwordHash: 0, "invitation.tokenHash": 0 } }).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 20).limit(20).toArray();
  return { users: users.map(adminUserView), total, page, pages };
}

export async function getLeads(): Promise<LeadView[]> {
  await requireSuperAdmin();
  const db = await getDb();
  const leads = await db.collection<LeadDoc>("leads").find({}).sort({ createdAt: -1 }).toArray();
  return leads.map(lead => ({ id: lead._id.toString(), name: lead.name, email: lead.email, phone: lead.phone, source: lead.source, notes: lead.notes, stage: lead.stage, userId: lead.userId?.toString(), createdAt: lead.createdAt.toISOString() }));
}

export async function getAdminOverview(): Promise<AdminOverview> {
  await requireSuperAdmin();
  const db = await getDb();
  const now = new Date();
  const since = new Date(now); since.setUTCHours(0, 0, 0, 0); since.setUTCDate(since.getUTCDate() - 89);
  const [groups, created, activated, recentLogins, openTickets, resolvedTickets, leadCount, feedbackCount, feedback] = await Promise.all([
    db.collection<UserDoc>("users").aggregate<{ _id: UserStatus; count: number }>([
      { $match: { role: "user" } }, { $group: { _id: { $switch: { branches: [
        { case: { $eq: ["$status", "disabled"] }, then: "inactive" },
        { case: { $eq: ["$status", "invited"] }, then: { $cond: [{ $gt: ["$invitation.expiresAt", now] }, "invited", "expired"] } },
      ], default: "active" } }, count: { $sum: 1 } } },
    ]).toArray(),
    db.collection<UserDoc>("users").aggregate<{ _id: string; count: number }>([{ $match: { role: "user", createdAt: { $gte: since } } }, { $group: { _id: { $dateToString: { date: "$createdAt", format: "%Y-%m-%d" } }, count: { $sum: 1 } } }]).toArray(),
    db.collection<UserDoc>("users").aggregate<{ _id: string; count: number }>([{ $match: { role: "user", activatedAt: { $gte: since } } }, { $group: { _id: { $dateToString: { date: "$activatedAt", format: "%Y-%m-%d" } }, count: { $sum: 1 } } }]).toArray(),
    db.collection<UserDoc>("users").countDocuments({ role: "user", lastLoginAt: { $gte: new Date(now.getTime() - 7 * 86400000) }, ...statusQuery("active") }),
    db.collection("supportRequests").countDocuments({ status: { $in: ["open", "in_progress"] } }),
    db.collection("supportRequests").countDocuments({ status: "resolved" }), db.collection("leads").countDocuments(), db.collection("deletionFeedback").countDocuments(),
    db.collection<DeletionFeedbackDoc>("deletionFeedback").find({}).sort({ createdAt: -1 }).limit(30).toArray(),
  ]);
  const counts = Object.fromEntries(userStatuses.map(status => [status, groups.find(group => group._id === status)?.count ?? 0])) as Record<UserStatus, number>;
  const growth = Array.from({ length: 90 }, (_, index) => { const date = new Date(since); date.setUTCDate(date.getUTCDate() + index); const key = date.toISOString().slice(0, 10); return { date: key, created: created.find(item => item._id === key)?.count ?? 0, activated: activated.find(item => item._id === key)?.count ?? 0 }; });
  return { counts, total: Object.values(counts).reduce((a, b) => a + b, 0), recentLogins, tickets: { open: openTickets, resolved: resolvedTickets }, leadCount, feedbackCount, growth,
    feedback: feedback.map(item => ({ id: item._id.toString(), reason: item.reason, feedback: item.feedback, createdAt: item.createdAt.toISOString() })) };
}
