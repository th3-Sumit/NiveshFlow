import { AuthCard } from "@/app/components/auth/auth-card";
import { privatePageMetadata } from "@/app/lib/seo";

export const metadata = privatePageMetadata("Reset your password", "Recover access to your NiveshFlow account with a verification code and a new password.");

export default function ForgotPasswordPage() {
  return <AuthCard mode="forgot-password" />;
}
