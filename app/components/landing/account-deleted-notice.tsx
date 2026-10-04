"use client";

import { useSearchParams } from "next/navigation";

export function AccountDeletedNotice() {
  const params = useSearchParams();
  if (params.get("accountDeleted") !== "1") return null;

  return (
    <div role="status" className="mt-5 rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
      Your account has been permanently deleted.{" "}
      {params.get("notification") === "sent"
        ? "A confirmation was sent to your email."
        : "Your email confirmation is queued for delivery."}
    </div>
  );
}
