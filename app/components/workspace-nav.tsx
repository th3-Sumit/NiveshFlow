"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenText,
  CalendarCheck,
  CreditCard,
  LayoutDashboard,
  ListChecks,
  UsersRound,
  ContactRound,
  LifeBuoy,
  Settings2,
  UserRound,
  WalletCards,
} from "lucide-react";
import { cn } from "@/app/lib/utils";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/accounts", icon: WalletCards, label: "Accounts" },
  { href: "/transactions", icon: ListChecks, label: "Transactions" },
  { href: "/debts", icon: CreditCard, label: "Debt" },
  { href: "/planning", icon: CalendarCheck, label: "Planning" },
  { href: "/profile", icon: UserRound, label: "Profile" },
  { href: "/documentation", icon: BookOpenText, label: "Docs" },
];

const adminItems = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/users", icon: UsersRound, label: "Users" },
  { href: "/admin/leads", icon: ContactRound, label: "Leads" },
  { href: "/admin/tickets", icon: LifeBuoy, label: "Tickets" },
  { href: "/profile", icon: UserRound, label: "Profile" },
  { href: "/admin/operations", icon: Settings2, label: "Operations" },
  { href: "/documentation", icon: BookOpenText, label: "Docs" },
];

export function WorkspaceNav({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const pathname = usePathname();
  const items = isSuperAdmin ? adminItems : navItems;

  return (
    <nav aria-label="Workspace navigation" className="scrollbar-none order-3 flex w-full min-w-0 gap-1 overflow-x-auto pb-2 lg:order-none lg:w-auto lg:pb-0">
      {items.map(({ href, icon: Icon, label }) => (
        <Link
          aria-current={pathname === href ? "page" : undefined}
          className={cn(
            "flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-teal-500",
            pathname === href
              ? "bg-teal-50 font-semibold text-teal-800"
              : "text-slate-500 hover:bg-teal-50/60 hover:text-teal-800",
          )}
          href={href}
          key={href}
        >
          <Icon size={15} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
