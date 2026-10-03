"use server";

import { createHash, randomBytes } from "crypto";
import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentUser, requireSuperAdmin } from "@/app/lib/data";
import { ensureLifecycleIndexes, getDb, getMongoClient, type UserDoc, type DeletionChallengeDoc, type DeletionFeedbackDoc, type SupportRequestDoc, type MailJobDoc, type MediaCleanupDoc } from "@/app/lib/mongodb";
import { verifySecret } from "@/app/lib/password";
import { deleteSession } from "@/app/lib/session";
import { SUPER_ADMIN_EMAIL } from "@/app/lib/constants";
import { canAccessAccount, type ActionResult } from "@/app/lib/user-lifecycle";
import { processMailJob, processMediaJob } from "@/app/lib/maintenance";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const reasons = ["", "not_needed", "missing_features", "privacy", "too_complex", "other"] as const;

export async function prepareAccountDeletionAction() {
  const user = await requireCurrentUser();
  if (user.role === "super_admin" || user.email === SUPER_ADMIN_EMAIL) return { error: "The super admin account is protected from self-deletion." };
  try {
    await ensureLifecycleIndexes(); const db = await getDb(); const phrase = `delete-niveshflow-${randomBytes(6).toString("hex")}`;
    await db.collection<DeletionChallengeDoc>("deletionChallenges").updateOne({ userId: new ObjectId(user.id) }, { $set: { challengeHash: hash(phrase), attempts: 0, expiresAt: new Date(Date.now() + 10 * 60000), createdAt: new Date() }, $setOnInsert: { _id: new ObjectId() } }, { upsert: true });
    return { phrase };
  } catch { return { error: "Couldn't prepare account deletion. Please try again." }; }
}

export async function deleteMyAccountAction(formData: FormData): Promise<ActionResult> {
  const current = await requireCurrentUser();
  if (current.role === "super_admin" || current.email === SUPER_ADMIN_EMAIL) return { status: "error", message: "The super admin account is protected from self-deletion." };
  const parsed = z.object({ confirmation: z.string().min(1).max(80), password: z.string().min(1).max(128), reason: z.enum(reasons), feedback: z.string().trim().max(2000) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Check the confirmation, password, and feedback fields." };
  let committed = false; let emailPending = true;
  try {
    const client = await getMongoClient(); const db = await getDb(client); const userId = new ObjectId(current.id);
    const challenge = await db.collection<DeletionChallengeDoc>("deletionChallenges").findOne({ userId, challengeHash: hash(parsed.data.confirmation), expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } });
    if (!challenge) return { status: "error", message: "The confirmation text doesn't match, or it expired. Close and reopen the dialog." };
    const user = await db.collection<UserDoc>("users").findOne({ _id: userId, role: "user", email: { $ne: SUPER_ADMIN_EMAIL } });
    if (!user || !canAccessAccount(user) || !user.passwordHash || !(await verifySecret(parsed.data.password, user.passwordHash))) {
      await db.collection<DeletionChallengeDoc>("deletionChallenges").updateOne({ _id: challenge._id }, { $inc: { attempts: 1 } });
      return { status: "error", message: "The password is incorrect, or the account is unavailable." };
    }
    const mailId = new ObjectId(); const mediaId = new ObjectId(); const session = client.startSession();
    try { await session.withTransaction(async () => {
      const fresh = await db.collection<UserDoc>("users").findOne({ _id: userId, role: "user", email: { $ne: SUPER_ADMIN_EMAIL } }, { session });
      if (!fresh || !canAccessAccount(fresh) || fresh.passwordHash !== user.passwordHash || (fresh.authVersion ?? 0) !== (user.authVersion ?? 0)) throw new Error("Account changed");
      const consumed = await db.collection<DeletionChallengeDoc>("deletionChallenges").deleteOne({ _id: challenge._id, challengeHash: hash(parsed.data.confirmation), expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } }, { session });
      if (!consumed.deletedCount) throw new Error("Challenge expired");
      const tickets = await db.collection<SupportRequestDoc>("supportRequests").find({ userId }, { session, projection: { attachments: 1 } }).toArray();
      const assets: MediaCleanupDoc["assets"] = tickets.flatMap(ticket => ticket.attachments.map(file => ({ publicId: file.publicId, resourceType: file.resourceType, deliveryType: "authenticated" as const })));
      if (fresh.avatarPublicId) assets.push({ publicId: fresh.avatarPublicId, resourceType: "image", deliveryType: "upload" });
      if (assets.length) await db.collection<MediaCleanupDoc>("mediaCleanupJobs").insertOne({ _id: mediaId, assets, createdAt: new Date() }, { session });
      if (parsed.data.reason || parsed.data.feedback) await db.collection<DeletionFeedbackDoc>("deletionFeedback").insertOne({ _id: new ObjectId(), reason: parsed.data.reason, feedback: parsed.data.feedback, createdAt: new Date() }, { session });
      await db.collection<MailJobDoc>("mailJobs").insertOne({ _id: mailId, to: fresh.email, subject: "Your NiveshFlow account has been deleted", text: `Hi ${fresh.name},\n\nYour NiveshFlow account and its personal finance records have been permanently deleted. Your previous sign-in sessions can no longer be used. Any optional feedback you shared was saved without your account identity.\n\nThank you for using NiveshFlow.`, attempts: 0, createdAt: new Date() }, { session });
      for (const collection of ["accounts", "transactions", "debts", "debtPayments", "bills", "savingsGoals", "budgets", "categories", "otps", "passwordResetTokens", "supportRequests", "deletionChallenges"]) await db.collection(collection).deleteMany({ userId }, { session });
      await db.collection("leads").deleteMany({ $or: [{ userId }, { email: fresh.email }] }, { session });
      await db.collection<UserDoc>("users").deleteOne({ _id: userId, role: "user" }, { session });
    }); committed = true; } finally { await session.endSession(); }
    await deleteSession();
    try { emailPending = !(await processMailJob(db, mailId)); } catch { /* The durable notification job remains available for retry. */ }
    try { await processMediaJob(db, mediaId); } catch { /* Cleanup is retried from admin Operations. */ }
    revalidatePath("/", "layout");
  } catch {
    if (!committed) return { status: "error", message: "Account deletion couldn't be confirmed. Refresh the page before trying again." };
    try { await deleteSession(); } catch { /* A removed account cannot authenticate even if clearing the cookie fails. */ }
  }
  // Cookie deletion re-renders the current route; redirect before a protected page can send the user to login.
  redirect("/?accountDeleted=1&notification=" + (emailPending ? "pending" : "sent"));
}

export async function retryMaintenanceAction(): Promise<ActionResult> {
  await requireSuperAdmin();
  try {
    const db = await getDb(); const mail = await db.collection<MailJobDoc>("mailJobs").find({}).sort({ createdAt: 1 }).limit(5).toArray();
    for (const job of mail) await processMailJob(db, job._id);
    const media = await db.collection<MediaCleanupDoc>("mediaCleanupJobs").find({}).sort({ createdAt: 1 }).limit(2).toArray();
    for (const job of media) await processMediaJob(db, job._id);
    revalidatePath("/admin/operations"); return { status: "success", message: "Retry batch finished. Jobs that still need delivery or cleanup remain queued." };
  } catch { return { status: "error", message: "The retry batch couldn't be completed. Please try again." }; }
}
