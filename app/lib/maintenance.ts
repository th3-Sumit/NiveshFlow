import "server-only";
import { ObjectId, type Db } from "mongodb";
import type { MailJobDoc, MediaCleanupDoc } from "./mongodb";
import { sendNotificationEmail } from "./email";
import { removeCloudinaryAsset } from "./cloudinary";

const availableLease = () => ({ $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: new Date() } }] });

export async function processMailJob(db: Db, id: ObjectId) {
  const leaseToken = new ObjectId();
  const job = await db.collection<MailJobDoc>("mailJobs").findOneAndUpdate({ _id: id, ...availableLease() }, { $set: { leaseToken, leaseUntil: new Date(Date.now() + 60_000) } }, { returnDocument: "after" });
  if (!job) return false;
  try {
    await sendNotificationEmail({ to: job.to, subject: job.subject, text: job.text });
    await db.collection<MailJobDoc>("mailJobs").deleteOne({ _id: id, leaseToken });
    return true;
  } catch {
    await db.collection<MailJobDoc>("mailJobs").updateOne({ _id: id, leaseToken }, { $unset: { leaseToken: "", leaseUntil: "" }, $inc: { attempts: 1 } });
    return false;
  }
}

export async function processMediaJob(db: Db, id: ObjectId) {
  const leaseToken = new ObjectId();
  const job = await db.collection<MediaCleanupDoc>("mediaCleanupJobs").findOneAndUpdate({ _id: id, ...availableLease() }, { $set: { leaseToken, leaseUntil: new Date(Date.now() + 120_000) } }, { returnDocument: "after" });
  if (!job) return;
  const remaining = [...job.assets];
  try {
    for (const asset of job.assets.slice(0, 5)) {
      try { await removeCloudinaryAsset(asset); remaining.splice(remaining.findIndex(item => item.publicId === asset.publicId && item.resourceType === asset.resourceType), 1); } catch { /* Preserve failed assets for the next retry. */ }
    }
    if (!remaining.length) await db.collection<MediaCleanupDoc>("mediaCleanupJobs").deleteOne({ _id: id, leaseToken });
    else await db.collection<MediaCleanupDoc>("mediaCleanupJobs").updateOne({ _id: id, leaseToken }, { $set: { assets: remaining }, $unset: { leaseToken: "", leaseUntil: "" } });
  } catch { /* The lease expires automatically if a database write fails. */ }
}
