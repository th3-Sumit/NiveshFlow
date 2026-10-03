import * as React from "react";
import { cn } from "@/app/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        "flex h-12 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-base text-slate-900 shadow-sm outline-none transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-rose-400 aria-invalid:bg-rose-50/50 aria-invalid:focus:ring-rose-500/10 sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
