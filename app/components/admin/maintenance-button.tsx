"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { retryMaintenanceAction } from "@/app/actions/account-deletion";
import { Button } from "@/app/components/ui/button";

export function MaintenanceButton() {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const router = useRouter();
  return <div className="grid justify-items-start gap-3"><Button disabled={busy} onClick={async () => { setBusy(true); try { const result = await retryMaintenanceAction(); setMessage(result.message); router.refresh(); } catch { setMessage("Retry failed. Please try again."); } finally { setBusy(false); } }}><RotateCw className={busy ? "animate-spin" : ""} />Retry pending jobs</Button>{message ? <p role="status" className="text-sm text-slate-600">{message}</p> : null}</div>;
}
