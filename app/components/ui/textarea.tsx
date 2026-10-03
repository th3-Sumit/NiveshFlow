import type { ComponentProps } from "react";
import { cn } from "@/app/lib/utils";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn("min-h-28 w-full resize-y rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-base text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-rose-400 sm:text-sm", className)} {...props} />;
}
