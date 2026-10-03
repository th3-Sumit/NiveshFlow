import { createHash, randomBytes } from "crypto";
import { validateSupportFile, type SupportAttachment } from "./support";

type CloudinaryUpload = {
  secure_url: string;
  public_id: string;
};

export class SupportAttachmentError extends Error {}

function getCloudinaryConfig() {
  const cloudName = process.env.CLOUD_NAME;
  const apiKey = process.env.CLOUD_API_KEY;
  const apiSecret = process.env.CLOUD_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary credentials are required.");
  }

  return { cloudName, apiKey, apiSecret };
}

function signUpload(params: Record<string, string>, apiSecret: string) {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return createHash("sha1").update(`${payload}${apiSecret}`).digest("hex");
}

export async function uploadProfileImage(file: File | null) {
  if (!file || file.size === 0) {
    return null;
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Profile image must be an image file.");
  }

  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Profile image must be smaller than 2MB.");
  }

  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = "finance-management/profile-images";
  const signature = signUpload({ folder, timestamp }, apiSecret);
  const body = new FormData();

  body.append("file", file);
  body.append("api_key", apiKey);
  body.append("timestamp", timestamp);
  body.append("folder", folder);
  body.append("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body,
    },
  );

  if (!response.ok) {
    throw new Error("Profile image upload failed.");
  }

  const upload = (await response.json()) as CloudinaryUpload;

  return {
    avatarUrl: upload.secure_url,
    avatarPublicId: upload.public_id,
  };
}

export async function uploadSupportAttachment(file: File, userId: string, requestId: string): Promise<SupportAttachment> {
  const error = validateSupportFile(file);
  if (error) throw new SupportAttachmentError(error);
  const extension = file.name.split(".").pop()!.toLowerCase();
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const signatureValid = extension === "png"
    ? [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)
    : ["jpg", "jpeg"].includes(extension)
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : extension === "pdf"
        ? new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-"
        : bytes[0] === 80 && bytes[1] === 75 && bytes[2] === 3 && bytes[3] === 4;
  if (!signatureValid) throw new SupportAttachmentError("The attachment contents do not match its file type.");

  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const resourceType = ["png", "jpg", "jpeg"].includes(extension) ? "image" : "raw";
  const id = randomBytes(12).toString("hex");
  const params = {
    timestamp: Math.floor(Date.now() / 1000).toString(),
    folder: `finance-management/support/${userId}/${requestId}`,
    public_id: resourceType === "raw" ? `${id}.${extension}` : id,
    type: "authenticated",
  };
  const body = new FormData();
  for (const [key, value] of Object.entries(params)) body.append(key, value);
  body.append("file", file);
  body.append("api_key", apiKey);
  body.append("signature", signUpload(params, apiSecret));
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: "POST", body, signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new SupportAttachmentError("An attachment could not be uploaded. Please try again.");
  const upload = await response.json() as { public_id: string; asset_id: string; type: string };
  if (upload.type !== "authenticated" || !upload.asset_id || !upload.public_id) {
    throw new SupportAttachmentError("The attachment could not be stored privately.");
  }
  return {
    id, publicId: upload.public_id, assetId: upload.asset_id, resourceType,
    format: extension === "jpeg" ? "jpg" : extension,
    name: file.name.replace(/[\x00-\x1f\x7f/\\]/g, "_").slice(0, 160),
    size: file.size,
    mimeType: file.type || ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }[extension]!),
  };
}

export async function removeSupportAttachment(attachment: SupportAttachment) {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const params = { public_id: attachment.publicId, type: "authenticated", timestamp: Math.floor(Date.now() / 1000).toString() };
  const body = new URLSearchParams({ ...params, api_key: apiKey, signature: signUpload(params, apiSecret) });
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${attachment.resourceType}/destroy`, {
    method: "POST", body, signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Attachment cleanup failed.");
}

export async function downloadSupportAttachment(attachment: SupportAttachment) {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { asset_id: attachment.assetId, timestamp: String(timestamp), expires_at: String(timestamp + 60), attachment: "true" };
  const query = new URLSearchParams({ ...params, api_key: apiKey, signature: signUpload(params, apiSecret) });
  return fetch(`https://api.cloudinary.com/v1_1/${cloudName}/asset/download?${query}`, {
    cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
}

export async function removeCloudinaryAsset(asset: { publicId: string; resourceType: "image" | "raw"; deliveryType: "upload" | "authenticated" }) {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const params = { public_id: asset.publicId, type: asset.deliveryType, invalidate: "true", timestamp: Math.floor(Date.now() / 1000).toString() };
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${asset.resourceType}/destroy`, { method: "POST", body: new URLSearchParams({ ...params, api_key: apiKey, signature: signUpload(params, apiSecret) }), signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("Media cleanup failed.");
  const result = await response.json() as { result: string };
  if (!["ok", "not found"].includes(result.result)) throw new Error("Media cleanup failed.");
}
