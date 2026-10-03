import nodemailer from "nodemailer";
import { APP_NAME } from "./constants";

type OtpEmailInput = {
  to: string;
  name: string;
  code: string;
  purpose: "login" | "password_reset";
};

function getTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    throw new Error("EMAIL_USER and EMAIL_PASS are required.");
  }

  return nodemailer.createTransport({
    service: "gmail",
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    auth: {
      user,
      pass,
    },
  });
}

export async function sendNotificationEmail(input: { to: string; subject: string; text: string }) {
  await getTransporter().sendMail({ from: `"${APP_NAME}" <${process.env.EMAIL_USER}>`, ...input });
}

export async function sendInvitationEmail(input: { to: string; name: string; url: string; expiresAt: Date }) {
  await sendNotificationEmail({ to: input.to, subject: `You're invited to ${APP_NAME}`, text: `Hi ${input.name},\n\nYou've been invited to your private ${APP_NAME} workspace. Choose your own password using this secure link:\n\n${input.url}\n\nThis link expires at ${input.expiresAt.toUTCString()} (72 hours maximum) and can be used only once. If you did not expect this invitation, ignore it.\n\n${APP_NAME}` });
}

export async function sendOtpEmail({ to, name, code, purpose }: OtpEmailInput) {
  const transporter = getTransporter();
  const isLogin = purpose === "login";
  const subject = isLogin
    ? `${APP_NAME} login OTP`
    : `${APP_NAME} password reset OTP`;

  await transporter.sendMail({
    from: `"${APP_NAME}" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text: `Hi ${name}, your ${APP_NAME} ${isLogin ? "login" : "password reset"} OTP is ${code}. It expires in 10 minutes.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <p>Hi ${name},</p>
        <p>Your ${APP_NAME} ${isLogin ? "login" : "password reset"} OTP is:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>
        <p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
      </div>
    `,
  });
}
