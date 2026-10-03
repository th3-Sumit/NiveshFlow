"use client";

import type { ComponentProps } from "react";
import { Button } from "@/app/components/ui/button";
import { HELP_CENTER_EVENT } from "@/app/lib/support";

export function HelpCenterTrigger({ subject, ...props }: Omit<ComponentProps<typeof Button>, "onClick"> & { subject?: string }) {
  return <Button {...props} type="button" onClick={() => window.dispatchEvent(new CustomEvent(HELP_CENTER_EVENT, { detail: subject ? { subject, type: "query" } : undefined }))} />;
}
