import { AuthCard } from "@/app/components/auth/auth-card";
import { privatePageMetadata } from "@/app/lib/seo";

export const metadata = privatePageMetadata("Login", "Sign in to your NiveshFlow personal finance workspace with your password.");

export default function LoginPage() {
  return <AuthCard mode="login" />;
}
