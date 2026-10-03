import * as React from "react";
import { cn } from "@/app/lib/utils";

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<"div"> & {
  orientation?: "horizontal" | "vertical";
}) {
  return (
    <div
      aria-orientation={orientation}
      data-orientation={orientation}
      data-slot="separator"
      role="separator"
      className={cn(
        "shrink-0 bg-slate-200/80",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
