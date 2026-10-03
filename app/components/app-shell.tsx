import Link from "next/link";
import { LogOut, WalletCards } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import type { UserSafe } from "@/app/lib/data";
import { Button } from "@/app/components/ui/button";
import { WorkspaceNav } from "@/app/components/workspace-nav";
import { HelpCenter } from "@/app/components/support/help-center";

export function AppShell({
  children,
  title,
  user,
}: {
  children: React.ReactNode;
  title: string;
  user: UserSafe;
}) {
  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-background text-slate-950">
      <header className="z-20 shrink-0 border-b border-teal-100 bg-white/90 px-5 backdrop-blur-xl sm:px-8 lg:px-10">
        <div className="flex min-h-[72px] w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-3 lg:flex-nowrap lg:py-3">
          <Link href={user.role === "super_admin" ? "/admin" : "/dashboard"} className="flex shrink-0 items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-white shadow-sm shadow-teal-700/15">
              <WalletCards size={21} />
            </span>
            <span>
              <span className="block text-base font-semibold">NiveshFlow</span>
              <span className="block text-xs font-medium text-slate-500">
                {title}
              </span>
            </span>
          </Link>

          <WorkspaceNav isSuperAdmin={user.role === "super_admin"} />
          <form action={logoutAction}>
            <Button size="sm" type="submit" variant="outline">
              <LogOut size={15} />
              Logout
            </Button>
          </form>
        </div>
      </header>

      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-5 pb-20 sm:px-8 lg:px-10">
        <div className="workspace-enter">{children}</div>
      </div>
      <HelpCenter />
    </main>
  );
}
