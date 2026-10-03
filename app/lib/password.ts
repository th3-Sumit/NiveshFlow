import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: string,
  keyLength: number,
) => Promise<Buffer>;

export async function hashSecret(secret: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(secret, salt, 64);

  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifySecret(secret: string, storedHash: string) {
  const [salt, key] = storedHash.split(":");

  if (!salt || !key) {
    return false;
  }

  const storedBuffer = Buffer.from(key, "hex");
  const derivedKey = await scrypt(secret, salt, 64);

  if (storedBuffer.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(storedBuffer, derivedKey);
}
