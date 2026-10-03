import Link from "next/link";
import {
  Banknote,
  BookOpenText,
  CalendarCheck,
  CircleCheck,
  CreditCard,
  Gauge,
  KeyRound,
  Layers3,
  ListChecks,
  LifeBuoy,
  LockKeyhole,
  Settings2,
  ShieldCheck,
  UserRound,
  WalletCards,
} from "lucide-react";
import { AppShell } from "@/app/components/app-shell";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { requireCurrentUser } from "@/app/lib/data";
import { HelpCenterTrigger } from "@/app/components/support/help-center-trigger";

const onboardingFlow = [
  {
    title: "Create a private account",
    text:
      "The user signs up with name, email, phone, password, and an optional cropped profile image. The app validates the inputs before creating a private workspace.",
  },
  {
    title: "Secure access",
    text:
      "The user can log in with password or OTP. Forgot password also uses OTP before opening the new password screen.",
  },
  {
    title: "Build money sources",
    text:
      "The user adds accounts such as cash, bank, wallet, card, or investment accounts. These accounts become the source for transactions.",
  },
  {
    title: "Record money movement",
    text:
      "Income, expenses, transfers, bills, subscriptions, savings, and debt payments are saved as ledger entries.",
  },
  {
    title: "Review and plan",
    text:
      "Dashboard, debt, and planning screens use saved records to show balances, outflow, net worth, upcoming bills, and savings progress.",
  },
];

const authDocs = [
  {
    title: "Signup",
    requirement:
      "A new person needs a clean workspace where only their finance records are stored.",
    how:
      "The form validates name, email, phone, strong password, confirm password, and optional avatar. The avatar is cropped before upload and stored through Cloudinary.",
    useful:
      "This gives each user a trusted starting point with a profile, session, and isolated data ownership.",
  },
  {
    title: "Password login",
    requirement:
      "A returning user needs a familiar way to access their workspace.",
    how:
      "The app verifies the email and password hash on the server, then creates an encrypted HTTP-only session cookie.",
    useful:
      "It keeps authentication simple while protecting the session from normal client-side JavaScript access.",
  },
  {
    title: "Login with OTP",
    requirement:
      "A user may need passwordless access, especially on a personal device.",
    how:
      "The user enters email or phone, the server sends a short-lived OTP to the registered email, and the code is verified before login.",
    useful:
      "It reduces lockouts and gives a secure alternate login path without exposing account data.",
  },
  {
    title: "Forgot password",
    requirement:
      "A user who forgot the password needs a safe recovery path.",
    how:
      "The app sends a recovery OTP, verifies it, creates a reset session, and then requires a valid new password.",
    useful:
      "It prevents direct password changes without proof that the user controls the account recovery channel.",
  },
];

const workspaceDocs = [
  {
    href: "/dashboard",
    icon: Gauge,
    title: "Dashboard",
    requirement:
      "The user needs one place to understand current financial health.",
    how:
      "It reads accounts, transactions, debts, bills, and goals, then calculates total balance, monthly income, actual expenses, cash outflow, outstanding debt, debt reduction, and net worth.",
    useful:
      "The user can quickly see whether cash is improving, debt is reducing, bills are coming, or spending needs attention.",
  },
  {
    href: "/accounts",
    icon: WalletCards,
    title: "Accounts",
    requirement:
      "The user needs to represent every place where money is kept or moved from.",
    how:
      "Select Add account to open a dialog for name, type, institution, and opening balance. Search names or institutions, filter type/status, select Apply, and browse pages of 10, 20, or 50 records. Totals reflect all matching accounts. The pencil opens an edit dialog; changing opening balance adjusts current balance by the difference while preserving movements. The trash opens confirmation; linked accounts cannot be removed.",
    useful:
      "This makes the ledger realistic because every income, expense, transfer, and payment has a real source.",
  },
  {
    href: "/transactions",
    icon: ListChecks,
    title: "Transactions",
    requirement:
      "The user needs a complete history of money movement.",
    how:
      "Select Add transaction for a dialog with source account, type, amount, and date. Transfers require a different destination. Search descriptions, merchants, or tags; filter type/status or open More filters for date ranges and accounts, then select Apply. Pagination reaches every owned entry. Entry value totals magnitudes, not net cash flow. Income/refunds show a green plus and outgoing entries a red minus. Pencil and trash open edit/removal dialogs; balance and linked debt effects update atomically.",
    useful:
      "This creates reliable reports. The user can trace where money came from, where it went, and which account was affected.",
  },
  {
    href: "/debts",
    icon: CreditCard,
    title: "Debt",
    requirement:
      "The user needs to track loans, credit cards, and repayment progress without mixing principal with expenses.",
    how:
      "Select Add debt to open its details dialog, or Record payment to select a debt and payment account and enter principal, interest, fees, and date. The dialog shows remaining principal and payment total. Switch between Debts and Payment history, search and filter each list, then browse its pages. Payment history can be filtered by debt, account, status, and date. Pencil/trash actions open dialogs. Once payments exist, principal cannot be overwritten directly; edit the linked payment instead. Remove linked payments before removing the debt.",
    useful:
      "The user can see actual debt reduction while expense reports only count interest and fees as spending.",
  },
  {
    href: "/planning",
    icon: CalendarCheck,
    title: "Planning",
    requirement:
      "The user needs to prepare for future obligations and goals.",
    how:
      "Select Add bill or Add savings goal to open a dialog. Switch between Bills & subscriptions and Savings goals for full-width lists with search, status filters, date ranges, sorting, and pagination. Bills also filter by type/frequency. Select Apply after changing filters; Clear filters restores all records. Each item's pencil/trash opens an edit/removal dialog. Paid status and saved amounts are manually maintained planning values; they do not create bank transactions. Record actual money movement separately in Transactions.",
    useful:
      "This helps avoid surprise bills and keeps long-term goals visible beside daily spending.",
  },
  {
    href: "/profile",
    icon: UserRound,
    title: "Profile",
    requirement:
      "The user needs control over personal identity inside the workspace.",
    how:
      "Profile allows updating your name, phone, and cropped avatar. Your email is read-only. Select Request an email change to open the Help Center, describe your request, and include the new address you want to use.",
    useful:
      "Keep your identity and contact number current. Email changes are reviewed by support. To leave the service, open Danger zone, select Delete my account, type the exact random confirmation text, and enter your password. Confirmation expires after 10 minutes. Optional reason and feedback are retained without your account identity; avoid including personal details. Deletion removes your owned finance records and tickets, signs you out, and returns you to the landing page. An email confirms deletion; unsuccessful email or image cleanup is queued for retry.",
  },
  {
    href: "#help-center-guide",
    icon: LifeBuoy,
    title: "Help Center",
    requirement: "You need a place to report a problem, ask a question, share feedback, or request an email change.",
    how: "Select the floating Help Center button at the bottom right. Choose Issue, Query, or Feedback and a priority: Critical, Emergency, Just FYI, or Nothing Urgent. Add a subject of 5-120 characters and a description of at least 10 words (up to 5,000 characters). Optionally attach up to three PNG, JPG, PDF, or DOCX files, 5 MB each, then select Send request.",
    useful: "Your request is saved with a reference number and your contact details. Open My requests to see your latest 30 requests, download your attachments, check Open / In progress / Resolved status, and read support replies. Only you and authorized support can read your requests and attachments. Priority is a triage label, not a guaranteed response time.",
  },
];

const financeRules = [
  {
    title: "Ledger first",
    text:
      "The app derives summaries from records instead of fake static totals. Good finance software starts with trustworthy transactions.",
  },
  {
    title: "Transfers are neutral",
    text:
      "A transfer moves money between accounts. It should not increase income or expense because the user did not earn or spend new money.",
  },
  {
    title: "Debt payments are split",
    text:
      "Principal reduces liability. Interest and fees are expenses. The full payment still reduces the selected account balance.",
  },
  {
    title: "Net worth",
    text:
      "Net worth is calculated from account balances plus savings goals minus outstanding active debt.",
  },
];

const privacyDocs = [
  "Each finance record is attached to the signed-in user id.",
  "Normal users only see their own accounts, transactions, debts, bills, goals, and profile.",
  "Privileged navigation is hidden from normal users and protected routes redirect users without the required role.",
  "Operational platform documentation is only rendered for authorized sessions.",
];

const adminDocs = [
  { title: "Dashboard", text: "Review normal-user totals by Active, Inactive, Invited, and Expired. Inactive means administratively disabled, not simply absent. Signed in this week is a separate activity measure. Growth shows daily account creation and activation in UTC with 7, 30, or 90-day ranges and series filters. Financial balances are not exposed. Deletion feedback shows the latest 30 anonymous submissions." },
  { title: "Users and invitations", text: "Search and filter every account using the paginated user list. Select Invite user and enter name, email, and phone. The server reserves the identity and emails a single-use link that expires exactly 72 hours after creation. The recipient sets a strong password to activate. Expired invitations remain in Users as Expired. Reinvite replaces the previous link and restarts the 72-hour window. Delivery failures are marked and can be retried with Reinvite." },
  { title: "Access management", text: "Update normal users' names and phone numbers from Users. Disable blocks password login, OTP, recovery, and existing sessions while retaining finance data. Enable restores access but does not restore old sessions; an unactivated user still needs a valid invitation. The super admin identity is protected against invitations, disabling, and self-deletion. Email changes use the reviewed Tickets workflow." },
  { title: "Leads", text: "Add prospects with name, email, phone, source, stage, and notes. Update New, Contacted, or Closed leads before invitation. Invite from a lead to link it to a user; invitation sets Invited and password setup sets Converted automatically. Linked identities are subsequently managed in Users. Removing a lead does not remove its associated user." },
  { title: "Tickets", text: "Review user Issue, Query, and Feedback requests with contact details and private attachments. Filter by status, priority, and type, reply, and set Open, In progress, or Resolved. For an approved email-change request, verify the address and apply the change from the ticket. Other users cannot read these requests or admin-only controls." },
  { title: "Profile and Operations", text: "Profile manages the admin's own name, phone, and cropped avatar. Self-deletion is disabled for the admin. Operations reports durable deletion email and media-cleanup jobs without recipient details. Retry processes up to 5 emails and 2 cleanup batches, with up to 5 assets per batch. Continue retrying until empty after correcting provider failures. Pending jobs do not recreate deleted accounts." },
];

const commands = [
  "npm run dev",
  "npm run lint",
  "npm run build",
  "npm run seed:admin",
];

function RequirementBlock({
  how,
  requirement,
  useful,
}: {
  how: string;
  requirement: string;
  useful: string;
}) {
  return (
    <div className="mt-4 grid gap-3 text-sm leading-6">
      <p className="rounded-2xl bg-slate-50 p-4 font-semibold text-slate-600">
        <span className="block text-xs font-black uppercase text-slate-400">
          User requirement
        </span>
        {requirement}
      </p>
      <p className="rounded-2xl bg-white/70 p-4 font-semibold text-slate-600">
        <span className="block text-xs font-black uppercase text-slate-400">
          How it works
        </span>
        {how}
      </p>
      <p className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 font-semibold text-emerald-900">
        <span className="block text-xs font-black uppercase text-emerald-600">
          Why it is useful
        </span>
        {useful}
      </p>
    </div>
  );
}

export default async function DocumentationPage() {
  const user = await requireCurrentUser();
  const isSuperAdmin = user.role === "super_admin";

  return (
    <AppShell title="Documentation" user={user}>
      <section className="grid w-full min-w-0 gap-6 py-8">
        <Card className="overflow-hidden p-0">
          <CardContent className="grid gap-8 p-7 lg:grid-cols-[1.05fr_0.95fr] lg:p-9">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
                <BookOpenText size={17} />
                User guide
              </div>
              <h1 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight text-slate-950 md:text-4xl">
                How to use NiveshFlow for personal finance management.
              </h1>
              <p className="mt-5 max-w-3xl text-lg font-medium leading-8 text-slate-600">
                This guide explains each workflow from the user requirement to
                how the section works and why it matters. The normal guide only
                shows personal finance documentation. Platform operations stay
                hidden unless the signed-in session is authorized.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild>
                  <Link href={isSuperAdmin ? "/admin" : "/dashboard"}>Go to dashboard</Link>
                </Button>
                {!isSuperAdmin ? <Button asChild variant="outline">
                  <Link href="/accounts">Add accounts</Link>
                </Button> : null}
              </div>
            </div>

            <div className="rounded-xl bg-teal-900 p-6 text-white">
              <p className="text-sm font-bold uppercase text-white/50">
                Recommended user flow
              </p>
              <div className="mt-5 grid gap-3">
                {onboardingFlow.map((item, index) => (
                  <div
                    className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                    key={item.title}
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-400 text-sm font-black text-slate-950">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-bold">{item.title}</p>
                      <p className="mt-1 text-sm font-semibold leading-6 text-white/70">
                        {item.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <KeyRound className="text-emerald-600" size={24} />
              Authentication And Account Access
            </CardTitle>
            <CardDescription>
              These flows protect account creation, login, OTP login, and
              password recovery.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            {authDocs.map((item) => (
              <div
                className="rounded-[26px] border border-slate-200/80 bg-white/60 p-5"
                key={item.title}
              >
                <h2 className="text-xl font-semibold">{item.title}</h2>
                <RequirementBlock
                  how={item.how}
                  requirement={item.requirement}
                  useful={item.useful}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Layers3 className="text-emerald-600" size={24} />
              Workspace Sections
            </CardTitle>
            <CardDescription>
              Every section supports a specific finance job. Use them together
              to build a complete view of personal money.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-2">
            {workspaceDocs.map((section) => {
              const Icon = section.icon;

              return (
                <div
                  className="rounded-[26px] border border-slate-200/80 bg-white/60 p-5"
                  key={section.href}
                  id={section.title === "Help Center" ? "help-center-guide" : undefined}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-primary">
                        <Icon size={22} />
                      </span>
                      <h2 className="text-xl font-semibold">{section.title}</h2>
                    </div>
                    {section.title === "Help Center" ? <HelpCenterTrigger size="sm" variant="outline">Open</HelpCenterTrigger> : <Button asChild size="sm" variant="outline">
                      <Link href={section.href}>Open</Link>
                    </Button>}
                  </div>
                  <RequirementBlock
                    how={section.how}
                    requirement={section.requirement}
                    useful={section.useful}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="p-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Banknote className="text-emerald-600" size={24} />
                Financial Logic
              </CardTitle>
              <CardDescription>
                These rules make the application useful for real personal
                finance instead of just storing random entries.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {financeRules.map((rule) => (
                <div
                  className="rounded-3xl border border-slate-200/80 bg-white/60 p-5"
                  key={rule.title}
                >
                  <p className="flex items-center gap-2 font-bold text-slate-950">
                    <CircleCheck className="text-emerald-600" size={18} />
                    {rule.title}
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                    {rule.text}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="p-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <LockKeyhole className="text-emerald-600" size={24} />
                Privacy And Role Boundaries
              </CardTitle>
              <CardDescription>
                Normal users should only receive information required for their
                own personal finance workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {privacyDocs.map((item) => (
                <p
                  className="rounded-3xl border border-slate-200/80 bg-white/60 p-4 text-sm font-semibold leading-6 text-slate-600"
                  key={item}
                >
                  {item}
                </p>
              ))}
            </CardContent>
          </Card>
        </div>

        {isSuperAdmin ? (
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <Card className="p-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <ShieldCheck className="text-emerald-600" size={24} />
                  Admin Operations
                </CardTitle>
                <CardDescription>
                  This section is visible only because the current session has
                  the super admin role.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {adminDocs.map((item) => (
                  <div
                    className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5"
                    key={item.title}
                  >
                    <p className="font-bold text-emerald-950">{item.title}</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-emerald-900">
                      {item.text}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="p-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Settings2 className="text-emerald-600" size={24} />
                  Developer Operations
                </CardTitle>
                <CardDescription>
                  These commands are operational notes for development and admin
                  setup, not normal user instructions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {commands.map((command) => (
                    <code
                      className="rounded-lg border border-teal-800 bg-teal-900 px-4 py-3 text-sm font-bold text-white"
                      key={command}
                    >
                      {command}
                    </code>
                  ))}
                </div>
                <p className="mt-5 text-sm font-semibold leading-6 text-slate-600">
                  The seed command is for preparing the role-gated admin account
                  in development or deployment. Keep these operational details
                  out of normal user documentation.
                </p>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
