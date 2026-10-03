"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/app/lib/utils";

export function Modal({ open, onClose, title, children, busy = false, className, footer }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; busy?: boolean; className?: string; footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} aria-labelledby={id} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={event => { if (event.target === ref.current && !busy) onClose(); }}
      className={cn("m-auto w-[calc(100%_-_2rem)] max-w-lg overflow-hidden rounded-xl border border-teal-100 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/40 backdrop:backdrop-blur-sm", className)}>
      <div className="flex max-h-[85dvh] flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <h2 id={id} className="text-lg font-semibold">{title}</h2>
          <Button aria-label="Close dialog" title="Close" variant="ghost" size="icon" disabled={busy} onClick={onClose}><X /></Button>
        </header>
        <div className="min-h-0 overflow-y-auto p-6">{children}</div>
        {footer ? <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4">{footer}</footer> : null}
      </div>
    </dialog>
  );
}
