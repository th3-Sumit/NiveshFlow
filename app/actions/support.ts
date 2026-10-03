"use server";

import { MongoServerError, ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { requireCurrentUser, requireSuperAdmin } from "@/app/lib/data";
import { ensureAuthIndexes, ensureSupportIndexes, getDb, getMongoClient, type OtpDoc, type PasswordResetTokenDoc, type SupportRequestDoc, type UserDoc } from "@/app/lib/mongodb";
import { removeSupportAttachment, uploadSupportAttachment, SupportAttachmentError } from "@/app/lib/cloudinary";
import { getMySupportRequests } from "@/app/lib/support-data";
import { MAX_SUPPORT_FILES, supportRequestSchema, supportStatuses, validateSupportFile, type SupportActionState, type SupportAttachment } from "@/app/lib/support";
import { normalizeEmail } from "@/app/lib/validation";
import { z } from "zod";

class SupportRequestError extends Error {}

export async function createSupportRequestAction(formData: FormData): Promise<SupportActionState> {
  const user = await requireCurrentUser();
  const parsed = supportRequestSchema.safeParse({
    type: formData.get("type"), priority: formData.get("priority"),
    subject: formData.get("subject"), description: formData.get("description"),
  });
  if (!parsed.success) return { status: "error", errors: parsed.error.flatten().fieldErrors };
  const files = formData.getAll("attachments");
  if (files.length > MAX_SUPPORT_FILES || files.some(file => !(file instanceof File) || Boolean(validateSupportFile(file)))) {
    return { status: "error", errors: { attachments: ["Attach up to 3 PNG, JPG, PDF, or DOCX files, 5 MB each."] } };
  }

  const attachments: SupportAttachment[] = [];
  let saved = false;
  try {
    await ensureSupportIndexes();
    const db = await getDb();
    const id = new ObjectId();
    for (const file of files as File[]) attachments.push(await uploadSupportAttachment(file, user.id, id.toString()));
    const now = new Date();
    await db.collection<SupportRequestDoc>("supportRequests").insertOne({
      _id: id, userId: new ObjectId(user.id), ...parsed.data,
      user: { name: user.name, email: user.email, phone: user.phone, ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}) },
      status: "open", attachments, createdAt: now, updatedAt: now,
    });
    saved = true;
    revalidatePath("/admin");
    return { status: "success", message: "Your request has been sent to the support inbox.", reference: `NF-${id.toString().slice(-8).toUpperCase()}` };
  } catch (error) {
    if (!saved) await Promise.allSettled(attachments.map(removeSupportAttachment));
    return { status: "error", message: error instanceof SupportAttachmentError ? error.message : "We couldn't send your request. Please try again shortly." };
  }
}

export async function getMySupportRequestsAction() {
  await requireCurrentUser();
  try {
    return { requests: await getMySupportRequests() };
  } catch {
    return { requests: [], error: "Your requests couldn't be loaded. Please try again." };
  }
}

export async function updateSupportRequestAction(formData: FormData): Promise<SupportActionState> {
  const admin = await requireSuperAdmin();
  const requestId = String(formData.get("requestId") ?? "");
  const parsed = z.object({ status: z.enum(supportStatuses), response: z.string().trim().max(3000) }).safeParse({
    status: formData.get("status"), response: formData.get("response") ?? "",
  });
  if (!ObjectId.isValid(requestId) || !parsed.success) return { status: "error", message: "Check the status and keep your response under 3,000 characters." };
  try {
    const db = await getDb();
    const result = await db.collection<SupportRequestDoc>("supportRequests").updateOne({ _id: new ObjectId(requestId) }, {
      $set: { ...parsed.data, handledBy: new ObjectId(admin.id), updatedAt: new Date() },
    });
    if (!result.matchedCount) return { status: "error", message: "Request not found." };
    revalidatePath("/admin");
    return { status: "success", message: "Request updated. The user can see your response in My requests." };
  } catch {
    return { status: "error", message: "The request couldn't be updated. Please try again." };
  }
}

export async function changeUserEmailAction(formData: FormData): Promise<SupportActionState> {
  const admin = await requireSuperAdmin();
  const requestId = String(formData.get("requestId") ?? "");
  const parsed = z.string().trim().email().transform(normalizeEmail).safeParse(formData.get("newEmail"));
  if (!ObjectId.isValid(requestId) || !parsed.success) return { status: "error", message: "Enter a valid new email address." };
  try {
    await ensureAuthIndexes();
    const client = await getMongoClient();
    const db = await getDb(client);
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        const request = await db.collection<SupportRequestDoc>("supportRequests").findOne({ _id: new ObjectId(requestId) }, { session });
        if (!request || request.emailChange) throw new SupportRequestError("This request is unavailable or its email change is already complete.");
        const user = await db.collection<UserDoc>("users").findOne({ _id: request.userId }, { session });
        if (!user || user.role === "super_admin") throw new SupportRequestError("The configured super admin email cannot be changed here.");
        if (user.email === parsed.data) throw new SupportRequestError("The new email is the same as the current email.");
        const now = new Date();
        await db.collection<UserDoc>("users").updateOne({ _id: user._id }, { $set: { email: parsed.data, updatedAt: now } }, { session });
        await db.collection<OtpDoc>("otps").deleteMany({ userId: user._id }, { session });
        await db.collection<PasswordResetTokenDoc>("passwordResetTokens").deleteMany({ userId: user._id }, { session });
        await db.collection<SupportRequestDoc>("supportRequests").updateOne({ _id: request._id }, { $set: {
          emailChange: { previous: user.email, next: parsed.data, changedAt: now, changedBy: new ObjectId(admin.id) },
          status: "resolved", response: `Your account email has been updated to ${parsed.data}. Use this email the next time you sign in.`,
          handledBy: new ObjectId(admin.id), updatedAt: now,
        } }, { session });
      });
    } finally {
      await session.endSession();
    }
    revalidatePath("/admin");
    revalidatePath("/profile");
    revalidatePath("/dashboard");
    return { status: "success", message: "Email updated and the request resolved." };
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) return { status: "error", message: "Another account already uses this email." };
    return { status: "error", message: error instanceof SupportRequestError ? error.message : "The email couldn't be updated. Please try again." };
  }
}
