import { z } from "zod";
import { normalizeEmail, normalizePhone, getPasswordErrors } from "./validation";

export const INVITATION_TTL_MS = 3 * 24 * 60 * 60 * 1000;
export const userStatuses = ["active", "inactive", "invited", "expired"] as const;
export type UserStatus = (typeof userStatuses)[number];
export type ActionResult = { status: "success" | "error"; message: string; errors?: Record<string, string[]> };
export const leadStages = ["new", "contacted", "invited", "converted", "closed"] as const;
export type LeadStage = (typeof leadStages)[number];

export function userStatus(user: { status?: string; invitation?: { expiresAt: Date | string } }, now = new Date()): UserStatus {
  if (user.status === "disabled") return "inactive";
  if (user.status === "invited") return user.invitation && new Date(user.invitation.expiresAt).getTime() > now.getTime() ? "invited" : "expired";
  return "active";
}

export function canAccessAccount(user: { status?: string; passwordHash?: string; authVersion?: number }, sessionVersion?: number) {
  return (!user.status || user.status === "active") && Boolean(user.passwordHash) && (sessionVersion === undefined || (user.authVersion ?? 0) === sessionVersion);
}

export const inviteUserSchema = z.object({
  name: z.string().trim().min(2, "Enter at least 2 characters.").max(80),
  email: z.string().trim().email("Enter a valid email.").transform(normalizeEmail),
  phone: z.string().trim().transform(normalizePhone).refine(value => /^\+?\d{7,15}$/.test(value), "Enter a valid phone number."),
});
export const acceptInvitationSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  password: z.string().max(128), confirmPassword: z.string().max(128),
}).superRefine((value, ctx) => {
  for (const message of getPasswordErrors(value.password)) ctx.addIssue({ code: "custom", path: ["password"], message });
  if (value.password !== value.confirmPassword) ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords must match." });
});
export const leadSchema = inviteUserSchema.extend({
  source: z.string().trim().max(80), notes: z.string().trim().max(2000), stage: z.enum(leadStages),
});

export type AdminUserView = {
  id: string; name: string; email: string; phone: string; role: "user" | "super_admin";
  status: UserStatus; createdAt: string; lastLoginAt?: string; invitationExpiresAt?: string;
  invitationDelivery?: "pending" | "sent" | "failed";
};
export type LeadView = { id: string; name: string; email: string; phone: string; source: string; notes: string; stage: LeadStage; userId?: string; createdAt: string };
export type AdminOverview = {
  counts: Record<UserStatus, number>; total: number; recentLogins: number; tickets: { open: number; resolved: number };
  leadCount: number; feedbackCount: number;
  growth: Array<{ date: string; created: number; activated: number }>;
  feedback: Array<{ id: string; reason: string; feedback: string; createdAt: string }>;
};
