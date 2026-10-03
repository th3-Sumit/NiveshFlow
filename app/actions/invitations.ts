"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, getMongoClient, type UserDoc, type LeadDoc } from "@/app/lib/mongodb";
import { hashSecret } from "@/app/lib/password";
import { createSession } from "@/app/lib/session";
import { acceptInvitationSchema, type ActionResult } from "@/app/lib/user-lifecycle";

export async function acceptInvitationAction(formData: FormData): Promise<ActionResult> {
  const parsed = acceptInvitationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Check the password fields.", errors: parsed.error.flatten().fieldErrors };
  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  try {
    const client = await getMongoClient(); const db = await getDb(client);
    const eligible = await db.collection<UserDoc>("users").findOne({ role: "user", status: "invited", "invitation.tokenHash": tokenHash, "invitation.expiresAt": { $gt: new Date() } }, { projection: { _id: 1 } });
    if (!eligible) return { status: "error", message: "This invitation is expired, disabled, replaced, or already accepted. Ask the sender to reinvite you." };
    const passwordHash = await hashSecret(parsed.data.password); const session = client.startSession(); let activated: UserDoc | null = null;
    try { await session.withTransaction(async () => {
      activated = await db.collection<UserDoc>("users").findOneAndUpdate({ _id: eligible._id, role: "user", status: "invited", "invitation.tokenHash": tokenHash, "invitation.expiresAt": { $gt: new Date() } }, {
        $set: { passwordHash, status: "active", activatedAt: new Date(), updatedAt: new Date(), lastLoginAt: new Date() }, $unset: { invitation: "" },
      }, { returnDocument: "after", session });
      if (!activated) throw new Error("Invitation unavailable");
      await db.collection<LeadDoc>("leads").updateMany({ userId: eligible._id }, { $set: { stage: "converted", updatedAt: new Date() } }, { session });
    }); } finally { await session.endSession(); }
    // Reload the committed account rather than trusting a transaction callback's captured value.
    const user = await db.collection<UserDoc>("users").findOne({ _id: eligible._id, status: "active" });
    if (!user) return { status: "error", message: "Your account is no longer available. Contact the sender." };
    await createSession({ userId: user._id.toString(), role: user.role, authVersion: user.authVersion ?? 0 });
    revalidatePath("/admin"); revalidatePath("/admin/users"); revalidatePath("/admin/leads");
  } catch { return { status: "error", message: "This invitation couldn't be accepted. It may have expired or already been used. Please contact the sender." }; }
  redirect("/dashboard");
}
