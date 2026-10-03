import * as React from "react";
import { cn } from "@/app/lib/utils";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "mb-2 block text-[13px] font-semibold text-slate-700",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
