"use server";

import { createHash, randomBytes } from "crypto";
import { MongoServerError, ObjectId } from "mongodb";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { AuthFormState } from "@/app/lib/auth-state";
import { uploadProfileImage } from "@/app/lib/cloudinary";
import { SUPER_ADMIN_EMAIL } from "@/app/lib/constants";
import { requireCurrentUser } from "@/app/lib/data";
import { sendOtpEmail } from "@/app/lib/email";
import {
  ensureAuthIndexes,
  getDb,
  type OtpDoc,
  type OtpPurpose,
  type PasswordResetTokenDoc,
  type UserDoc,
  type UserRole,
} from "@/app/lib/mongodb";
import { hashSecret, verifySecret } from "@/app/lib/password";
import { createSession, deleteSession } from "@/app/lib/session";
import { canAccessAccount } from "@/app/lib/user-lifecycle";
import {
  identifierSchema,
  loginSchema,
  normalizeEmail,
  normalizePhone,
  otpSchema,
  profileUpdateSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/app/lib/validation";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESET_TTL_MS = 15 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function fieldValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function zodErrorState(error: {
  flatten: () => { fieldErrors: AuthFormState["errors"] };
}) {
  return {
    status: "error" as const,
    errors: error.flatten().fieldErrors,
  };
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");

  if (!local || !domain) {
    return email;
  }

  return `${local.slice(0, 2)}${"*".repeat(Math.max(local.length - 2, 3))}@${domain}`;
}

function normalizeIdentifier(identifier: string) {
  const trimmed = identifier.trim();

  return trimmed.includes("@") ? normalizeEmail(trimmed) : normalizePhone(trimmed);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isDuplicateKey(error: unknown) {
  return error instanceof MongoServerError && error.code === 11000;
}

function isNextRedirect(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

function authServiceError(error: unknown, context: string): AuthFormState {
  console.error(`${context} failed`, error);

  const details =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const isDatabaseError =
    /Mongo|server selection|SSL|TLS|ECONN|ENOTFOUND|ETIMEOUT/i.test(details);

  return {
    status: "error",
    message: isDatabaseError
      ? "The database is not reachable right now. Check MongoDB Atlas access and try again."
      : "We could not complete that request right now. Please try again.",
  };
}

async function getReadyDb() {
  await ensureAuthIndexes();

  return getDb();
}

async function findUserByIdentifier(identifier: string) {
  const db = await getDb();
  const normalized = normalizeIdentifier(identifier);
  const query = normalized.includes("@")
    ? { email: normalized }
    : { phone: normalized };

  const user = await db.collection<UserDoc>("users").findOne(query);
  return user && canAccessAccount(user) ? user : null;
}

async function createOtp(
  user: UserDoc,
  identifier: string,
  purpose: OtpPurpose,
) {
  const db = await getDb();
  const code = randomBytes(4)
    .readUInt32BE(0)
    .toString()
    .slice(0, 6)
    .padStart(6, "0");
  const codeHash = await hashSecret(code);
  const now = new Date();

  await db.collection<OtpDoc>("otps").updateMany(
    {
      userId: user._id,
      purpose,
      consumedAt: { $exists: false },
    },
    {
      $set: {
        consumedAt: now,
      },
    },
  );

  await db.collection<OtpDoc>("otps").insertOne({
    _id: new ObjectId(),
    userId: user._id,
    identifier: normalizeIdentifier(identifier),
    purpose,
    codeHash,
    attempts: 0,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    createdAt: now,
  });

  await sendOtpEmail({
    to: user.email,
    name: user.name,
    code,
    purpose,
  });
}

async function consumeOtp(user: UserDoc, code: string, purpose: OtpPurpose) {
  const db = await getDb();
  const otp = await db.collection<OtpDoc>("otps").findOne(
    {
      userId: user._id,
      purpose,
      consumedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    },
    {
      sort: { createdAt: -1 },
    },
  );

  if (!otp) {
    return {
      ok: false,
      message: "The OTP expired or was already used.",
    };
  }

  if (otp.attempts >= MAX_OTP_ATTEMPTS) {
    await db.collection<OtpDoc>("otps").updateOne(
      { _id: otp._id },
      { $set: { consumedAt: new Date() } },
    );

    return {
      ok: false,
      message: "Too many attempts. Request a fresh OTP.",
    };
  }

  const isValid = await verifySecret(code, otp.codeHash);

  if (!isValid) {
    await db.collection<OtpDoc>("otps").updateOne(
      { _id: otp._id },
      { $inc: { attempts: 1 } },
    );

    return {
      ok: false,
      message: "That OTP does not match.",
    };
  }

  await db.collection<OtpDoc>("otps").updateOne(
    { _id: otp._id },
    { $set: { consumedAt: new Date() } },
  );

  return {
    ok: true,
  };
}

export async function signupAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse({
    name: fieldValue(formData, "name"),
    email: fieldValue(formData, "email"),
    phone: fieldValue(formData, "phone"),
    password: fieldValue(formData, "password"),
    confirmPassword: fieldValue(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    return zodErrorState(parsed.error);
  }

  let db: Awaited<ReturnType<typeof getReadyDb>>;
  let existingUser: UserDoc | null;

  try {
    db = await getReadyDb();
    existingUser = await db.collection<UserDoc>("users").findOne({
      $or: [{ email: parsed.data.email }, { phone: parsed.data.phone }],
    });
  } catch (error) {
    return authServiceError(error, "Signup database lookup");
  }

  if (existingUser) {
    return {
      status: "error",
      message:
        existingUser.email === parsed.data.email
          ? "An account with this email already exists."
          : "An account with this phone already exists.",
    };
  }

  let uploadedAvatar: Awaited<ReturnType<typeof uploadProfileImage>> = null;

  try {
    const avatar = formData.get("avatar");
    uploadedAvatar = avatar instanceof File ? await uploadProfileImage(avatar) : null;
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Profile image upload failed.",
    };
  }

  const now = new Date();
  const role: UserRole =
    parsed.data.email === SUPER_ADMIN_EMAIL ? "super_admin" : "user";
  const user: UserDoc = {
    _id: new ObjectId(),
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    role,
    status: "active",
    authVersion: 0,
    activatedAt: now,
    passwordHash: await hashSecret(parsed.data.password),
    avatarUrl: uploadedAvatar?.avatarUrl,
    avatarPublicId: uploadedAvatar?.avatarPublicId,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await db.collection<UserDoc>("users").insertOne(user);
  } catch (error) {
    if (isDuplicateKey(error)) {
      return {
        status: "error",
        message: "This email or phone is already registered.",
      };
    }

    return authServiceError(error, "Signup account creation");
  }

  await createSession({
    userId: user._id.toString(),
    role: user.role,
    authVersion: user.authVersion ?? 0,
  });

  redirect(role === "super_admin" ? "/admin" : "/dashboard");
}

export async function loginAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: fieldValue(formData, "email"),
    password: fieldValue(formData, "password"),
  });

  if (!parsed.success) {
    return zodErrorState(parsed.error);
  }

  let user: UserDoc | null;

  try {
    const db = await getReadyDb();
    user = await db.collection<UserDoc>("users").findOne({
      email: parsed.data.email,
    });

    if (!user || !canAccessAccount(user) || !user.passwordHash || !(await verifySecret(parsed.data.password, user.passwordHash))) {
      return {
        status: "error",
        message: "Invalid email or password.",
      };
    }

    await db.collection<UserDoc>("users").updateOne(
      { _id: user._id },
      {
        $set: {
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );
  } catch (error) {
    return authServiceError(error, "Login");
  }

  await createSession({
    userId: user._id.toString(),
    role: user.role,
    authVersion: user.authVersion ?? 0,
  });

  redirect(user.role === "super_admin" ? "/admin" : "/dashboard");
}

export async function requestLoginOtpAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = identifierSchema.safeParse({
    identifier: fieldValue(formData, "identifier"),
  });

  if (!parsed.success) {
    return zodErrorState(parsed.error);
  }

  try {
    await ensureAuthIndexes();
    const user = await findUserByIdentifier(parsed.data.identifier);

    if (!user) {
      return {
        status: "error",
        message: "No account matched that email or phone.",
      };
    }

    await createOtp(user, parsed.data.identifier, "login");

    return {
      status: "success",
      stage: "verify",
      identifier: parsed.data.identifier,
      maskedDestination: maskEmail(user.email),
      message: "OTP sent.",
    };
  } catch (error) {
    return authServiceError(error, "Login OTP request");
  }
}

export async function verifyLoginOtpAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = otpSchema.safeParse({
    identifier: fieldValue(formData, "identifier"),
    code: fieldValue(formData, "code"),
  });

  if (!parsed.success) {
    return zodErrorState(parsed.error);
  }

  let user: UserDoc | null;

  try {
    await ensureAuthIndexes();
    user = await findUserByIdentifier(parsed.data.identifier);

    if (!user) {
      return {
        status: "error",
        message: "No account matched that email or phone.",
      };
    }

    const result = await consumeOtp(user, parsed.data.code, "login");

    if (!result.ok) {
      return {
        status: "error",
        message: result.message,
      };
    }

    const db = await getDb();

    await db.collection<UserDoc>("users").updateOne(
      { _id: user._id },
      {
        $set: {
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );
  } catch (error) {
    return authServiceError(error, "Login OTP verification");
  }

  await createSession({
    userId: user._id.toString(),
    role: user.role,
    authVersion: user.authVersion ?? 0,
  });

  redirect(user.role === "super_admin" ? "/admin" : "/dashboard");
}

export async function requestPasswordResetOtpAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = identifierSchema.safeParse({
    identifier: fieldValue(formData, "identifier"),
  });

  if (!parsed.success) {
    return zodErrorState(parsed.error);
  }

  try {
    await ensureAuthIndexes();
    const user = await findUserByIdentifier(parsed.data.identifier);

    if (!user) {
      return {
        status: "error",
        message: "No account matched that email or phone.",
      };
    }

    await createOtp(user, parsed.data.identifier, "password_reset");

    return {
      status: "success",
      stage: "verify",
      identifier: parsed.data.identifier,
      maskedDestination: maskEmail(user.email),
      message: "Recovery OTP sent.",
    };
  } catch (error) {
    return authServiceError(error, "Password reset OTP request");
  }
}

export async function verifyPasswordResetOtpAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = otpSchema.safeParse({
    identifier: fieldValue(formData, "identifier"),
    code: fieldValue(formData, "code"),
  });

  if (!parsed.success) {
    return zodErrorState(parsed.error);
  }

  try {
    await ensureAuthIndexes();
    const user = await findUserByIdentifier(parsed.data.identifier);

    if (!user) {
      return {
        status: "error",
        message: "No account matched that email or phone.",
      };
    }

    const result = await consumeOtp(user, parsed.data.code, "password_reset");

    if (!result.ok) {
      return {
        status: "error",
        message: result.message,
      };
    }

    const db = await getDb();
    const resetToken = randomBytes(32).toString("base64url");

    await db.collection<PasswordResetTokenDoc>("passwordResetTokens").insertOne({
      _id: new ObjectId(),
      userId: user._id,
      tokenHash: hashToken(resetToken),
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
      createdAt: new Date(),
    });

    return {
      status: "success",
      stage: "reset",
      identifier: parsed.data.identifier,
      resetToken,
      message: "OTP verified. Create a new password.",
    };
  } catch (error) {
    return authServiceError(error, "Password reset OTP verification");
  }
}

export async function resetPasswordAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = resetPasswordSchema.safeParse({
    resetToken: fieldValue(formData, "resetToken"),
    password: fieldValue(formData, "password"),
    confirmPassword: fieldValue(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    return zodErrorState(parsed.error);
  }

  let role: UserRole;

  try {
    const db = await getReadyDb();
    const resetToken = await db
      .collection<PasswordResetTokenDoc>("passwordResetTokens")
      .findOne({
        tokenHash: hashToken(parsed.data.resetToken),
        consumedAt: { $exists: false },
        expiresAt: { $gt: new Date() },
      });

    if (!resetToken) {
      return {
        status: "error",
        message: "This reset session expired. Request a new OTP.",
      };
    }

    const user = await db.collection<UserDoc>("users").findOne({
      _id: resetToken.userId,
    });

    if (!user || !canAccessAccount(user)) {
      return {
        status: "error",
        message: "Account not found.",
      };
    }

    await db.collection<UserDoc>("users").updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash: await hashSecret(parsed.data.password),
          updatedAt: new Date(),
          lastLoginAt: new Date(),
        },
      },
    );

    await db.collection<PasswordResetTokenDoc>("passwordResetTokens").updateOne(
      { _id: resetToken._id },
      {
        $set: {
          consumedAt: new Date(),
        },
      },
    );

    await createSession({
      userId: user._id.toString(),
      role: user.role,
      authVersion: user.authVersion ?? 0,
    });

    role = user.role;
  } catch (error) {
    return authServiceError(error, "Password reset");
  }

  redirect(role === "super_admin" ? "/admin" : "/dashboard");
}

export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}

export async function updateProfileAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  const submittedEmail = formData.get("email");

  if (submittedEmail !== null && normalizeEmail(String(submittedEmail)) !== currentUser.email) {
    redirect(`/profile?error=${encodeURIComponent("Email changes must be requested through the Help Center.")}`);
  }

  const parsed = profileUpdateSchema.safeParse({
    name: fieldValue(formData, "name"),
    phone: fieldValue(formData, "phone"),
  });

  if (!parsed.success) {
    const firstMessage =
      Object.values(parsed.error.flatten().fieldErrors).flat().find(Boolean) ??
      "Profile information is invalid.";

    redirect(`/profile?error=${encodeURIComponent(firstMessage)}`);
  }

  try {
    const db = await getReadyDb();
    const userId = new ObjectId(currentUser.id);
    const duplicate = await db.collection<UserDoc>("users").findOne({
      _id: { $ne: userId },
      phone: parsed.data.phone,
    });

    if (duplicate) {
      redirect(
        `/profile?error=${encodeURIComponent(
          "Another account already uses this phone number.",
        )}`,
      );
    }

    const avatar = formData.get("avatar");
    const avatarUpload =
      avatar instanceof File && avatar.size > 0
        ? await uploadProfileImage(avatar)
        : null;
    const update: Partial<UserDoc> = {
      name: parsed.data.name,
      phone: parsed.data.phone,
      updatedAt: new Date(),
    };

    if (avatarUpload) {
      update.avatarUrl = avatarUpload.avatarUrl;
      update.avatarPublicId = avatarUpload.avatarPublicId;
    }

    await db.collection<UserDoc>("users").updateOne(
      { _id: userId },
      {
        $set: update,
      },
    );
  } catch (error) {
    if (isNextRedirect(error)) {
      throw error;
    }

    const state = authServiceError(error, "Profile update");

    redirect(`/profile?error=${encodeURIComponent(state.message ?? "")}`);
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  redirect("/profile?updated=1");
}
