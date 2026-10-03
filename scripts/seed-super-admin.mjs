import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { promisify } from "node:util";
import { MongoClient, ObjectId } from "mongodb";

const scrypt = promisify(scryptCallback);
const SUPER_ADMIN_EMAIL = "kumarsumit747037@gmail.com";

function loadLocalEnv() {
  if (!existsSync(".env.local")) {
    return;
  }

  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function databaseNameFromUri(connectionUri) {
  try {
    const parsed = new URL(connectionUri);
    const database = parsed.pathname.replace("/", "").trim();

    return database || "finance_management";
  } catch {
    return "finance_management";
  }
}

async function hashSecret(secret) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(secret, salt, 64);

  return `${salt}:${derivedKey.toString("hex")}`;
}

loadLocalEnv();

const mongoUri = process.env.MONGO_URI;
const password = process.env.SUPER_ADMIN_PASSWORD;
const name = process.env.SUPER_ADMIN_NAME?.trim();
const phone = process.env.SUPER_ADMIN_PHONE?.trim();
const resetPassword = process.env.SUPER_ADMIN_RESET_PASSWORD === "true";

if (!mongoUri) {
  console.error("MONGO_URI is required in .env.local or the current shell.");
  process.exit(1);
}

if (!password) {
  console.error(
    "SUPER_ADMIN_PASSWORD is required in .env.local or the current shell.",
  );
  process.exit(1);
}

if (!name || !phone) {
  console.error("SUPER_ADMIN_NAME and SUPER_ADMIN_PHONE are required. Set the administrator's real contact details before seeding.");
  process.exit(1);
}

const client = new MongoClient(mongoUri, {
  serverSelectionTimeoutMS: 10_000,
});

try {
  await client.connect();

  const db = client.db(databaseNameFromUri(mongoUri));
  const users = db.collection("users");
  const now = new Date();
  const existingAdmin = await users.findOne({ email: SUPER_ADMIN_EMAIL });
  const passwordHash = await hashSecret(password);

  await Promise.all([
    users.createIndex({ email: 1 }, { unique: true }),
    users.createIndex({ phone: 1 }, { unique: true }),
  ]);

  if (existingAdmin) {
    await users.updateOne(
      { _id: existingAdmin._id },
      {
        $set: {
          role: "super_admin",
          updatedAt: now,
          ...(name ? { name } : {}),
          ...(phone ? { phone } : {}),
          ...(resetPassword ? { passwordHash } : {}),
        },
      },
    );

    console.log(
      resetPassword
        ? `Super admin promoted and password reset: ${SUPER_ADMIN_EMAIL}`
        : `Super admin promoted: ${SUPER_ADMIN_EMAIL}`,
    );
  } else {
    await users.insertOne({
      _id: new ObjectId(),
      name,
      email: SUPER_ADMIN_EMAIL,
      phone,
      role: "super_admin",
      passwordHash,
      createdAt: now,
      updatedAt: now,
    });

    console.log(`Super admin seeded: ${SUPER_ADMIN_EMAIL}`);
  }
} finally {
  await client.close();
}
