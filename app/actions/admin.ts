"use server";

import { createHash, randomBytes } from "crypto";
import { MongoServerError, ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/app/lib/data";
import { ensureAuthIndexes, ensureLifecycleIndexes, getDb, getMongoClient, type UserDoc, type LeadDoc } from "@/app/lib/mongodb";
import { SUPER_ADMIN_EMAIL } from "@/app/lib/constants";
import { sendInvitationEmail } from "@/app/lib/email";
import { INVITATION_TTL_MS, inviteUserSchema, leadSchema, type ActionResult } from "@/app/lib/user-lifecycle";

function refreshAdmin() { for (const path of ["/admin", "/admin/users", "/admin/leads"]) revalidatePath(path); }
function safeError(error: unknown): ActionResult { return { status: "error", message: error instanceof MongoServerError && error.code === 11000 ? "This email or phone is already registered." : "The change couldn't be saved. Please try again." }; }
function field(formData: FormData, key: string) { return String(formData.get(key) ?? ""); }
function digest(token: string) { return createHash("sha256").update(token).digest("hex"); }

function invitationUrl(token: string) {
  const origin = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : undefined);
  if (!origin) throw new Error("APP_URL is required for invitation emails.");
  const url = new URL("/accept-invitation", origin);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("Invitation URLs require HTTPS in production.");
  url.searchParams.set("token", token); return url.toString();
}

async function deliverInvite(user: UserDoc, token: string, url: string): Promise<ActionResult> {
  const db = await getDb();
  try {
    await sendInvitationEmail({ to: user.email, name: user.name, url, expiresAt: user.invitation!.expiresAt });
    await db.collection<UserDoc>("users").updateOne({ _id: user._id, "invitation.tokenHash": digest(token) }, { $set: { "invitation.delivery": "sent", "invitation.sentAt": new Date() } });
    refreshAdmin(); return { status: "success", message: "Invitation sent. The recipient has 72 hours to set their password." };
  } catch {
    await db.collection<UserDoc>("users").updateOne({ _id: user._id, "invitation.tokenHash": digest(token) }, { $set: { "invitation.delivery": "failed" } });
    refreshAdmin(); return { status: "error", message: "The user is reserved, but the invitation email couldn't be delivered. Use Reinvite to retry." };
  }
}

export async function inviteUserAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  const parsed = inviteUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Check the user details.", errors: parsed.error.flatten().fieldErrors };
  if (parsed.data.email === SUPER_ADMIN_EMAIL) return { status: "error", message: "The super admin identity cannot be invited." };
  const token = randomBytes(32).toString("hex");
  let url: string;
  try { url = invitationUrl(token); } catch { return { status: "error", message: "Set APP_URL to the public HTTPS application URL before sending invitations." }; }
  const now = new Date();
  const user: UserDoc = { _id: new ObjectId(), ...parsed.data, role: "user", status: "invited", authVersion: 0,
    invitation: { tokenHash: digest(token), expiresAt: new Date(now.getTime() + INVITATION_TTL_MS), delivery: "pending", invitedBy: new ObjectId(admin.id) }, createdAt: now, updatedAt: now };
  try {
    await ensureAuthIndexes(); await ensureLifecycleIndexes();
    const client = await getMongoClient(); const db = await getDb(client); const session = client.startSession();
    try { await session.withTransaction(async () => {
      const leadId = field(formData, "leadId");
      if (leadId) {
        if (!ObjectId.isValid(leadId)) throw new Error("Invalid lead");
        const lead = await db.collection<LeadDoc>("leads").findOne({ _id: new ObjectId(leadId), email: user.email, userId: { $exists: false } }, { session });
        if (!lead) throw new Error("Unavailable lead");
        await db.collection<LeadDoc>("leads").updateOne({ _id: lead._id }, { $set: { stage: "invited", userId: user._id, updatedAt: now } }, { session });
      }
      await db.collection<UserDoc>("users").insertOne(user, { session });
    }); } finally { await session.endSession(); }
    return await deliverInvite(user, token, url);
  } catch (error) { return safeError(error); }
}

export async function reinviteUserAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireSuperAdmin(); const id = field(formData, "id");
  if (!ObjectId.isValid(id)) return { status: "error", message: "Invalid user." };
  try {
    const token = randomBytes(32).toString("hex"); const url = invitationUrl(token); const db = await getDb(); const now = new Date();
    const user = await db.collection<UserDoc>("users").findOneAndUpdate({ _id: new ObjectId(id), role: "user", email: { $ne: SUPER_ADMIN_EMAIL }, status: "invited", passwordHash: { $exists: false } }, {
      $set: { invitation: { tokenHash: digest(token), expiresAt: new Date(now.getTime() + INVITATION_TTL_MS), delivery: "pending", invitedBy: new ObjectId(admin.id) }, updatedAt: now },
    }, { returnDocument: "after" });
    if (!user) return { status: "error", message: "Enable this user first, or use an account that has not activated yet." };
    return await deliverInvite(user, token, url);
  } catch (error) { return safeError(error); }
}

export async function setUserAccessAction(formData: FormData): Promise<ActionResult> {
  await requireSuperAdmin(); const id = field(formData, "id"); const enabled = field(formData, "enabled");
  if (!ObjectId.isValid(id) || !["true", "false"].includes(enabled)) return { status: "error", message: "Invalid access change." };
  try {
    const client = await getMongoClient(); const db = await getDb(client); const session = client.startSession(); let found = false;
    try { await session.withTransaction(async () => {
      const user = await db.collection<UserDoc>("users").findOne({ _id: new ObjectId(id), role: "user" }, { session });
      if (!user || user.email === SUPER_ADMIN_EMAIL) return;
      found = true;
      await db.collection<UserDoc>("users").updateOne({ _id: user._id }, { $set: { status: enabled === "false" ? "disabled" : user.passwordHash ? "active" : "invited", updatedAt: new Date() }, $inc: { authVersion: 1 } }, { session });
      await db.collection("otps").deleteMany({ userId: user._id }, { session });
      await db.collection("passwordResetTokens").deleteMany({ userId: user._id }, { session });
    }); } finally { await session.endSession(); }
    if (!found) return { status: "error", message: "The super admin account is protected, or this user is unavailable." };
    refreshAdmin(); return { status: "success", message: enabled === "true" ? "User enabled. They can sign in again with a new session." : "User disabled. Existing sessions and recovery codes no longer work." };
  } catch (error) { return safeError(error); }
}

export async function updateManagedUserAction(formData: FormData): Promise<ActionResult> {
  await requireSuperAdmin(); const id = field(formData, "id");
  const parsed = inviteUserSchema.omit({ email: true }).safeParse(Object.fromEntries(formData));
  if (!ObjectId.isValid(id) || !parsed.success) return { status: "error", message: "Enter a valid name and phone number." };
  try {
    const db = await getDb(); const result = await db.collection<UserDoc>("users").updateOne({ _id: new ObjectId(id), role: "user", email: { $ne: SUPER_ADMIN_EMAIL } }, { $set: { ...parsed.data, updatedAt: new Date() } });
    if (!result.matchedCount) return { status: "error", message: "This user is protected or unavailable." };
    refreshAdmin(); return { status: "success", message: "User details updated." };
  } catch (error) { return safeError(error); }
}

export async function saveLeadAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireSuperAdmin(); const parsed = leadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Check the lead details.", errors: parsed.error.flatten().fieldErrors };
  if (["invited", "converted"].includes(parsed.data.stage)) return { status: "error", message: "Invitation and conversion stages are managed by the invitation workflow." };
  try {
    await ensureLifecycleIndexes(); const db = await getDb(); const now = new Date(); const id = field(formData, "id");
    if (id) {
      if (!ObjectId.isValid(id)) return { status: "error", message: "Invalid lead." };
      const result = await db.collection<LeadDoc>("leads").updateOne({ _id: new ObjectId(id), userId: { $exists: false } }, { $set: { ...parsed.data, updatedAt: now } });
      if (!result.matchedCount) return { status: "error", message: "Invited or converted leads are managed from Users." };
    } else await db.collection<LeadDoc>("leads").insertOne({ _id: new ObjectId(), ...parsed.data, createdBy: new ObjectId(admin.id), createdAt: now, updatedAt: now });
    refreshAdmin(); return { status: "success", message: "Lead saved." };
  } catch (error) { return safeError(error); }
}

export async function deleteLeadAction(formData: FormData): Promise<ActionResult> {
  await requireSuperAdmin(); const id = field(formData, "id");
  if (!ObjectId.isValid(id)) return { status: "error", message: "Invalid lead." };
  try { const db = await getDb(); const result = await db.collection<LeadDoc>("leads").deleteOne({ _id: new ObjectId(id) });
    if (!result.deletedCount) return { status: "error", message: "Lead not found." }; refreshAdmin(); return { status: "success", message: "Lead removed. Any associated user account is unchanged." };
  } catch (error) { return safeError(error); }
}
