import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/app/lib/data";
import { getDb, type SupportRequestDoc } from "@/app/lib/mongodb";
import { downloadSupportAttachment } from "@/app/lib/cloudinary";

export async function GET(_request: Request, { params }: { params: Promise<{ requestId: string; attachmentId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return new Response("Sign in to download this attachment.", { status: 401 });
    const { requestId, attachmentId } = await params;
    if (!ObjectId.isValid(requestId)) return new Response("Not found.", { status: 404 });
    const db = await getDb();
    const request = await db.collection<SupportRequestDoc>("supportRequests").findOne({
      _id: new ObjectId(requestId), ...(user.role === "super_admin" ? {} : { userId: new ObjectId(user.id) }),
    });
    const attachment = request?.attachments.find(file => file.id === attachmentId);
    if (!attachment) return new Response("Not found.", { status: 404 });
    const response = await downloadSupportAttachment(attachment);
    if (!response.ok || !response.body) return new Response("Attachment unavailable.", { status: 502 });
    return new Response(response.body, { headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.name).replace(/'/g, "%27")}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return new Response("Attachment unavailable. Please try again.", { status: 503 });
  }
}
