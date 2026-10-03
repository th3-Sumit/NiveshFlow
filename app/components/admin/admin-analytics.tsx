"use client";

import { useState } from "react";
import Link from "next/link";
import { UsersRound, UserCheck, UserX, Mail, Clock, LifeBuoy, ContactRound, MessageSquare } from "lucide-react";
import type { AdminOverview } from "@/app/lib/user-lifecycle";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";

const statuses = [
  { key: "active", label: "Active", color: "#0d9488", icon: UserCheck },
  { key: "inactive", label: "Inactive", color: "#e11d48", icon: UserX },
  { key: "invited", label: "Invited", color: "#2563eb", icon: Mail },
  { key: "expired", label: "Expired", color: "#d97706", icon: Clock },
] as const;
export function AdminAnalytics({ data }: { data: AdminOverview }) {
  const [range, setRange] = useState(30);
  const [metric, setMetric] = useState<"both" | "created" | "activated">("both");
  const series = data.growth.slice(-range);
  const max = Math.max(2, Math.ceil(Math.max(0, ...series.flatMap(point => [point.created, point.activated])) / 2) * 2);
  const points = (key: "created" | "activated") => series.map((point, index) => `${44 + (index / Math.max(1, series.length - 1)) * 700},${200 - point[key] / max * 165}`).join(" ");
  let start = 0;
  const segments = statuses.map(status => {
    const end = start + (data.total ? data.counts[status.key] / data.total * 100 : 0);
    const stop = status.color + " " + start + "% " + end + "%"; start = end; return stop;
  }).join(", ");
  return (
    <div className="grid gap-6">
      <section aria-label="User totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statuses.map(status => <Link href={"/admin/users?status=" + status.key} key={status.key} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white/90 p-4 transition hover:border-teal-300">
          <status.icon className="shrink-0" size={22} style={{ color: status.color }} />
          <div><p className="text-xs font-medium text-slate-500">{status.label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{data.counts[status.key]}</p></div>
        </Link>)}
      </section>
      <section className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card className="rounded-lg">
          <CardHeader><CardTitle className="text-base">User distribution</CardTitle></CardHeader>
          <CardContent className="grid justify-items-center gap-6">
            <div role="img" aria-label={statuses.map(status => status.label + ": " + data.counts[status.key]).join(", ")} className="relative flex size-44 items-center justify-center rounded-full" style={{ background: data.total ? "conic-gradient(" + segments + ")" : "#e2e8f0" }}>
              <div className="flex size-32 flex-col items-center justify-center rounded-full bg-white"><UsersRound size={18} className="mb-1 text-slate-400" /><strong className="text-3xl tabular-nums">{data.total}</strong><span className="text-xs text-slate-500">Total users</span></div>
            </div>
            <div className="grid w-full grid-cols-2 gap-3">{statuses.map(status => <div className="flex items-center gap-2 text-xs" key={status.key}><span className="size-2 rounded-full" style={{ background: status.color }} />{status.label}<strong className="ml-auto">{data.counts[status.key]}</strong></div>)}</div>
          </CardContent>
        </Card>
        <Card className="min-w-0 rounded-lg">
          <CardHeader className="flex flex-wrap items-center justify-between gap-3 sm:flex-row">
            <CardTitle className="text-base">User growth</CardTitle>
            <div className="flex flex-wrap gap-2">
              <select aria-label="Growth series" value={metric} onChange={event => setMetric(event.target.value as typeof metric)} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs"><option value="both">Created & activated</option><option value="created">Created</option><option value="activated">Activated</option></select>
              <select aria-label="Growth period" value={range} onChange={event => setRange(Number(event.target.value))} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs"><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select>
            </div>
          </CardHeader>
          <CardContent>
            <svg viewBox="0 0 780 240" role="img" aria-label={"Daily user growth over " + range + " days"} className="h-auto w-full">
              {[0, 0.5, 1].map(ratio => <g key={ratio}><line x1="44" x2="744" y1={200 - ratio * 165} y2={200 - ratio * 165} stroke="#e2e8f0" /><text x="32" y={204 - ratio * 165} textAnchor="end" fill="#64748b" className="text-[28px] sm:text-[12px]">{Math.round(max * ratio)}</text></g>)}
              {metric !== "activated" ? <polyline points={points("created")} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinejoin="round" /> : null}
              {metric !== "created" ? <polyline points={points("activated")} fill="none" stroke="#0d9488" strokeWidth="3" strokeLinejoin="round" /> : null}
              {series.map((point, index) => <g key={point.date}>
                {(["created", "activated"] as const).filter(key => metric === "both" || metric === key).map(key => <circle key={key} cx={44 + index / Math.max(1, series.length - 1) * 700} cy={200 - point[key] / max * 165} r={range === 90 ? 2 : 4} fill={key === "created" ? "#2563eb" : "#0d9488"}><title>{point.date}: {key} {point[key]}</title></circle>)}
              </g>)}
              <text x="44" y="228" fill="#64748b" className="text-[28px] sm:text-[12px]">{series[0]?.date}</text><text x="744" y="228" textAnchor="end" fill="#64748b" className="text-[28px] sm:text-[12px]">{series.at(-1)?.date}</text>
            </svg>
            <div className="flex flex-wrap gap-5 text-xs text-slate-600"><span className="flex items-center gap-2"><i className="size-2 rounded-full bg-blue-600" />Created: {series.reduce((sum, point) => sum + point.created, 0)}</span><span className="flex items-center gap-2"><i className="size-2 rounded-full bg-teal-600" />Activated: {series.reduce((sum, point) => sum + point.activated, 0)}</span></div>
            <details className="mt-4 text-xs text-slate-500"><summary className="cursor-pointer">View daily values (UTC)</summary><div className="mt-3 max-h-48 overflow-auto"><table className="w-full text-left"><thead><tr><th className="py-2">Date</th><th>Created</th><th>Activated</th></tr></thead><tbody>{series.map(point => <tr key={point.date} className="border-t border-slate-100"><td className="py-1.5">{point.date}</td><td>{point.created}</td><td>{point.activated}</td></tr>)}</tbody></table></div></details>
          </CardContent>
        </Card>
      </section>
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[{ title: "Signed in this week", value: data.recentLogins, icon: UsersRound, href: "/admin/users" }, { title: "Open tickets", value: data.tickets.open, icon: LifeBuoy, href: "/admin/tickets" }, { title: "Leads", value: data.leadCount, icon: ContactRound, href: "/admin/leads" }, { title: "Deletion feedback", value: data.feedbackCount, icon: MessageSquare, href: "#feedback" }].map(item => <Link key={item.title} href={item.href} className="flex items-center gap-3 border-l-2 border-teal-200 py-2 pl-4"><item.icon size={18} className="shrink-0 text-slate-400" /><div><p className="text-xs text-slate-500">{item.title}</p><p className="text-xl font-semibold">{item.value}</p></div></Link>)}
      </section>
    </div>
  );
}
