import Link from "next/link";
import { createHash } from "crypto";
import { LockKeyhole, WalletCards } from "lucide-react";
import { getDb, type UserDoc } from "@/app/lib/mongodb";
import { InvitationForm } from "@/app/components/auth/invitation-form";
import { FinanceBackdrop } from "@/app/components/auth/finance-backdrop";

export const metadata = { title: "Accept invitation | NiveshFlow", referrer: "no-referrer" as const };

export default async function InvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams; let user: Pick<UserDoc, "name" | "email"> | null = null; let unavailable = false;
  try { if (/^[a-f0-9]{64}$/.test(token)) { const db = await getDb(); user = await db.collection<UserDoc>("users").findOne({ role: "user", status: "invited", "invitation.tokenHash": createHash("sha256").update(token).digest("hex"), "invitation.expiresAt": { $gt: new Date() } }, { projection: { name: 1, email: 1 } }); } } catch { unavailable = true; }
  return (
    <main className="group/auth relative isolate flex min-h-dvh flex-col overflow-hidden bg-background">
      <FinanceBackdrop />
      <header className="relative z-20 border-b border-teal-100 bg-white/90 px-5 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-3 font-semibold">
            <span className="grid size-10 place-items-center rounded-lg bg-primary text-white"><WalletCards size={20} /></span>
            NiveshFlow
          </Link>
          <Link className="text-sm text-primary" href="/login">Sign in</Link>
        </div>
      </header>
      <div className="relative grid flex-1 place-items-center px-5 py-12">
        <section className="relative w-full max-w-lg rounded-2xl border border-teal-100 bg-white p-6 shadow-xl shadow-teal-950/5 sm:p-8">
          <div aria-hidden className="absolute inset-x-4 top-1.5 h-1 rounded-full bg-primary" />
          <div className="mb-6 border-b border-teal-100 pb-6">
            <LockKeyhole className="mb-4 text-primary" size={27} />
            <h1 className="text-2xl font-semibold motion-safe:animate-content-in motion-safe:[animation-delay:70ms]">{user ? "Welcome to your workspace" : "Invitation unavailable"}</h1>
            <p className="mt-2 break-words text-sm leading-6 text-slate-500 motion-safe:animate-content-in motion-safe:[animation-delay:150ms]">{user ? `Hi ${user.name}. Set a password for ${user.email}.` : unavailable ? "The service is temporarily unavailable. Please try again shortly." : "This link is invalid, expired, replaced, disabled, or already accepted. Ask the sender for a new invitation."}</p>
          </div>
          {user ? <InvitationForm token={token} /> : <Link className="text-sm font-medium text-primary" href="/login">Return to sign in</Link>}
        </section>
      </div>
    </main>
  );
}
