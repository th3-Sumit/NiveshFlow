import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "./constants";
import type { UserRole } from "./mongodb";

type SessionPayload = {
  userId: string;
  role: UserRole;
  expiresAt: string;
  authVersion?: number;
};

function base64Url(buffer: Buffer) {
  return buffer.toString("base64url");
}

function getSessionKey() {
  const seed =
    process.env.AUTH_SECRET ??
    process.env.CLOUD_API_SECRET ??
    process.env.EMAIL_PASS ??
    process.env.MONGO_URI;

  if (!seed) {
    throw new Error("A session secret source is required.");
  }

  return createHash("sha256").update(seed).digest();
}

function encryptSession(payload: SessionPayload) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getSessionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [base64Url(iv), base64Url(authTag), base64Url(encrypted)].join(".");
}

export function decryptSession(session: string | undefined) {
  if (!session) {
    return null;
  }

  try {
    const [ivValue, tagValue, encryptedValue] = session.split(".");

    if (!ivValue || !tagValue || !encryptedValue) {
      return null;
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      getSessionKey(),
      Buffer.from(ivValue, "base64url"),
    );

    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]);
    const payload = JSON.parse(decrypted.toString("utf8")) as SessionPayload;

    if (new Date(payload.expiresAt).getTime() <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function createSession(input: { userId: string; role: UserRole; authVersion?: number }) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const cookieStore = await cookies();
  const session = encryptSession({
    userId: input.userId,
    role: input.role,
    authVersion: input.authVersion ?? 0,
    expiresAt: expiresAt.toISOString(),
  });

  cookieStore.set(SESSION_COOKIE_NAME, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function readSession() {
  const cookieStore = await cookies();

  return decryptSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export async function deleteSession() {
  const cookieStore = await cookies();

  cookieStore.delete(SESSION_COOKIE_NAME);
}
