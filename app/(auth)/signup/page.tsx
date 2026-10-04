import { AuthCard } from "@/app/components/auth/auth-card";
import { privatePageMetadata } from "@/app/lib/seo";

export const metadata = privatePageMetadata("Create an account", "Create your NiveshFlow account to manage accounts, transactions, debt, and savings goals.");

export default function SignupPage() {
  return <AuthCard mode="signup" />;
}
