import Link from "next/link";
import { Suspense } from "react";
import { LandingMotion } from "@/app/components/landing/landing-motion";
import { AccountDeletedNotice } from "@/app/components/landing/account-deleted-notice";
import { getSiteStructuredData, homeMetadata, serializeStructuredData } from "@/app/lib/seo";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  ChartNoAxesCombined,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";

const flowSteps = [
  {
    title: "Create your workspace",
    text: "Create your account and keep your personal finance records in your own workspace.",
  },
  {
    title: "Track money cleanly",
    text: "Organize accounts, record income and expenses, and explore cash flow charts in your dashboard.",
  },
  {
    title: "Plan your next milestone",
    text: "Keep upcoming bills, debt repayments, and savings goals connected to your everyday money.",
  },
];

const features = [
  "Password and OTP login",
  "Verified account recovery",
  "A private finance workspace",
  "Your personal account history",
  "Secure password protection",
  "Your profile, your details",
];

export const metadata = homeMetadata;

export default function Home() {
  return (
    <LandingMotion>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(getSiteStructuredData()) }} />
    <main className="min-h-screen pt-[116px] text-slate-950 sm:pt-[104px]">
      <header className="fixed inset-x-0 top-6 z-20 px-5 sm:px-8 lg:px-10">
      <nav data-landing-motion="nav" aria-label="Main navigation" className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 rounded-2xl border border-teal-100 bg-white/90 px-3 py-4 shadow-sm backdrop-blur-xl sm:gap-4 sm:px-5">
        <Link href="/" className="group flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
            <WalletCards className="motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-110" size={22} />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-semibold">NiveshFlow</span>
            <span className="block text-xs font-medium text-slate-500">
              Personal finance OS
            </span>
          </span>
        </Link>
        <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          <a className="transition-colors hover:text-teal-700" href="#flow">How it works</a>
          <a className="transition-colors hover:text-teal-700" href="#security">Security</a>
          <a className="transition-colors hover:text-teal-700" href="#workspace">Your workspace</a>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden sm:inline-flex"><Link className="btn btn-ghost" href="/login">Login</Link></span>
          <Link className="group btn btn-dark" href="/signup">
            Start
            <ArrowRight className="motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:translate-x-1 motion-safe:group-focus-visible:translate-x-1" size={17} />
          </Link>
        </div>
      </nav>
      </header>

      <div className="px-5 sm:px-8 lg:px-10">
      <Suspense fallback={null}><AccountDeletedNotice /></Suspense>
      <section aria-label="Personal finance management" className="grid w-full min-w-0 items-center gap-10 pb-16 pt-14 lg:grid-cols-[1.03fr_0.97fr] lg:pb-24 lg:pt-20">
        <div className="max-w-3xl">
          <div data-landing-motion="reveal" data-motion-delay="40" className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/80 px-4 py-2 text-sm font-semibold text-emerald-900 shadow-sm">
            <Sparkles size={16} />
            Your everyday money, in one place
          </div>
          <h1 data-landing-motion="reveal" data-motion-delay="100" className="text-balance text-5xl font-semibold leading-[1.1] tracking-normal text-slate-950 sm:text-6xl">
            NiveshFlow
          </h1>
          <p data-landing-motion="reveal" data-motion-delay="160" className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
            Personal finance management for everyday life. Track income and
            expenses, manage accounts and debt, and plan savings goals with a
            clearer view of your money.
          </p>
          <div data-landing-motion="reveal" data-motion-delay="220" className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link className="group btn btn-dark h-14 px-6 text-base" href="/signup">
              Create account
              <ArrowRight className="motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:translate-x-1 motion-safe:group-focus-visible:translate-x-1" size={18} />
            </Link>
            <Link className="group btn btn-light h-14 px-6 text-base" href="/login-otp">
              Login with OTP
              <Fingerprint className="motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-110" size={18} />
            </Link>
          </div>
          <dl className="mt-10 grid max-w-2xl grid-cols-2 gap-3 min-[480px]:grid-cols-3">
            <div data-landing-motion="reveal" data-motion-delay="280" className="glass-tile motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-1">
              <dt className="text-lg font-semibold text-teal-700">Track</dt>
              <dd className="mt-1 text-xs font-medium text-slate-500">
                Income & expenses
              </dd>
            </div>
            <div data-landing-motion="reveal" data-motion-delay="340" className="glass-tile motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-1">
              <dt className="text-lg font-semibold text-teal-700">Plan</dt>
              <dd className="mt-1 text-xs font-medium text-slate-500">
                Bills & savings
              </dd>
            </div>
            <div data-landing-motion="reveal" data-motion-delay="400" className="glass-tile col-span-2 motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-1 min-[480px]:col-span-1">
              <dt className="text-lg font-semibold text-teal-700">Understand</dt>
              <dd className="mt-1 text-xs font-medium text-slate-500">
                Your financial picture
              </dd>
            </div>
          </dl>
        </div>

        <div data-landing-motion="preview" data-motion-delay="100" className="relative">
          <div className="glass-card p-5 sm:p-6">
            <div className="flex items-center justify-between border-b border-white/60 pb-5">
              <div>
                <h2 className="text-sm font-semibold text-slate-500">
                  Workspace preview
                </h2>
                <p className="mt-1 text-3xl font-semibold">Rs. 84,300</p>
              </div>
              <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
                <ChartNoAxesCombined size={23} />
              </span>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[24px] border border-white/70 bg-white/60 p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Savings</p>
                <p className="mt-3 text-3xl font-semibold">32%</p>
                <div className="mt-5 h-2 rounded-full bg-slate-200">
                  <div data-landing-motion="bar" data-motion-delay="320" className="h-2 w-[68%] origin-left rounded-full bg-emerald-500" />
                </div>
              </div>
              <div className="rounded-[24px] border border-white/70 bg-white/60 p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Cash remaining</p>
                <p className="mt-3 text-3xl font-semibold">Rs. 18,950</p>
                <div className="mt-5 flex gap-2">
                  <span data-landing-motion="bar" data-motion-delay="280" className="h-2 flex-1 origin-left rounded-full bg-rose-400" />
                  <span data-landing-motion="bar" data-motion-delay="340" className="h-2 flex-[1.8] origin-left rounded-full bg-amber-400" />
                  <span data-landing-motion="bar" data-motion-delay="400" className="h-2 flex-[2.2] origin-left rounded-full bg-emerald-500" />
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-teal-800 bg-teal-900 p-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/60">Protected account</p>
                  <p className="mt-1 text-xl font-semibold">OTP recovery ready</p>
                </div>
                <ShieldCheck className="text-emerald-300" size={28} />
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
                <span className="rounded-2xl bg-white/10 px-3 py-3 text-center">
                  Email
                </span>
                <span className="rounded-2xl bg-white/10 px-3 py-3 text-center">
                  Phone
                </span>
                <span className="rounded-2xl bg-white/10 px-3 py-3 text-center">
                  Password
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="flow"
        aria-labelledby="flow-heading"
        className="grid w-full min-w-0 scroll-mt-32 gap-4 py-10 lg:grid-cols-3"
      >
        <h2 id="flow-heading" className="sr-only">How NiveshFlow works</h2>
        {flowSteps.map((item, index) => (
          <article data-landing-motion="reveal" data-motion-delay={index * 70} className="group glass-card p-6 motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-1" key={item.title}>
            <span className="flex size-11 items-center justify-center rounded-2xl bg-white text-sm font-bold shadow-sm">
              0{index + 1}
            </span>
            <h3 className="mt-6 text-2xl font-semibold">{item.title}</h3>
            <p className="mt-3 leading-7 text-slate-600">{item.text}</p>
          </article>
        ))}
      </section>

      <section
        id="security"
        aria-labelledby="security-heading"
        className="grid w-full min-w-0 scroll-mt-32 gap-5 py-10 lg:grid-cols-[0.8fr_1.2fr]"
      >
        <div data-landing-motion="reveal" className="group glass-card p-7">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-lg shadow-rose-500/20 motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:-rotate-6">
            <LockKeyhole size={23} />
          </div>
          <h2 id="security-heading" className="mt-6 text-3xl font-semibold">
            Your finances, in a private workspace.
          </h2>
          <p className="mt-4 leading-7 text-slate-600">
            Sign in with a password or a verification code. Your accounts and
            financial activity stay together in your personal workspace.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((feature, index) => (
            <div
              data-landing-motion="reveal"
              data-motion-delay={index * 45}
              className="group flex items-center gap-3 rounded-[24px] border border-white/70 bg-white/55 p-4 shadow-sm backdrop-blur-xl motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-0.5"
              key={feature}
            >
              <BadgeCheck className="shrink-0 text-emerald-600 motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-110" size={20} />
              <span className="font-semibold text-slate-700">{feature}</span>
            </div>
          ))}
        </div>
      </section>

      <section
        id="workspace"
        aria-labelledby="workspace-heading"
        className="mb-12 grid w-full min-w-0 scroll-mt-32 gap-5 py-10 lg:grid-cols-[1.1fr_0.9fr]"
      >
        <div data-landing-motion="reveal" className="group glass-card p-7 sm:p-9">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-amber-400 text-slate-950">
              <Banknote className="motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:-rotate-6" size={23} />
            </span>
            <span className="text-sm font-bold uppercase text-slate-500">
              Your personal workspace
            </span>
          </div>
          <h2 id="workspace-heading" className="mt-7 max-w-3xl text-3xl font-semibold leading-tight">
            Accounts, transactions, debt, and savings goals.
          </h2>
          <p className="mt-5 max-w-2xl leading-7 text-slate-600">
            Start with the accounts you use most. Record income and expenses,
            plan upcoming payments, and watch your savings goals take shape.
          </p>
        </div>
        <div data-landing-motion="reveal" data-motion-delay="100" className="glass-card p-7">
          <KeyRound className="text-slate-950" size={30} />
          <h3 className="mt-5 text-2xl font-semibold">Ready entry points</h3>
          <div className="mt-6 grid gap-3">
            <Link className="group btn btn-light justify-between" href="/login">
              Login with password
              <ArrowRight className="motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:translate-x-1 motion-safe:group-focus-visible:translate-x-1" size={17} />
            </Link>
            <Link className="group btn btn-light justify-between" href="/login-otp">
              Login with OTP
              <ArrowRight className="motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:translate-x-1 motion-safe:group-focus-visible:translate-x-1" size={17} />
            </Link>
            <Link
              className="group btn btn-light justify-between"
              href="/forgot-password"
            >
              Recover account
              <ArrowRight className="motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:translate-x-1 motion-safe:group-focus-visible:translate-x-1" size={17} />
            </Link>
          </div>
        </div>
      </section>
      </div>
    </main>
    </LandingMotion>
  );
}
