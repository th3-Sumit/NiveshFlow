import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/app/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-colors [&_svg]:size-3.5",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default:
          "border-slate-200 bg-white/75 text-slate-700 shadow-sm",
        emerald:
          "border-teal-200 bg-white/80 text-teal-700 shadow-sm",
        muted: "border-white/70 bg-white/55 text-slate-600",
      },
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ className, variant }))}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
