import { AuthCard } from "@/app/components/auth/auth-card";
import { privatePageMetadata } from "@/app/lib/seo";

export const metadata = privatePageMetadata("Login with OTP", "Sign in to your NiveshFlow workspace using a one-time verification code.");

export default function LoginOtpPage() {
  return <AuthCard mode="otp-login" />;
}
