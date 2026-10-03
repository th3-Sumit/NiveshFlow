"use client";

import { Eye, EyeOff, LockKeyhole, Loader2, ArrowRight, Check } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { acceptInvitationAction } from "@/app/actions/invitations";
import { getPasswordErrors, passwordRequirements } from "@/app/lib/validation";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";

export function InvitationForm({ token }: { token: string }) {
  const [visible, setVisible] = useState(false); const [message, setMessage] = useState(""); const [pending, startTransition] = useTransition();
  const { register, control, handleSubmit, getValues, formState: { errors } } = useForm<{ password: string; confirmPassword: string }>({ mode: "onTouched", defaultValues: { password: "", confirmPassword: "" } });
  const password = useWatch({ control, name: "password" });
  return <form className="grid gap-5" noValidate onSubmit={handleSubmit(values => {
    const data = new FormData(); data.set("token", token); data.set("password", values.password); data.set("confirmPassword", values.confirmPassword);
    startTransition(async () => { try { const result = await acceptInvitationAction(data); if (result) setMessage(result.message); } catch { setMessage("Unable to activate your account. Please try again."); } });
  })}>
    {(["password", "confirmPassword"] as const).map(field => <div key={field}><Label htmlFor={field}>{field === "password" ? "New password" : "Confirm password"}</Label><div className="relative"><LockKeyhole size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><Input id={field} className="pl-12 pr-12" placeholder="****" autoComplete="new-password" type={visible ? "text" : "password"} disabled={pending} aria-invalid={Boolean(errors[field])} {...register(field, { required: "Enter a password.", maxLength: { value: 128, message: "Use at most 128 characters." }, validate: value => field === "password" ? getPasswordErrors(value)[0] || true : value === getValues("password") || "Passwords must match." })} /><Button className="absolute right-1 top-1/2 -translate-y-1/2" aria-label={visible ? "Hide passwords" : "Show passwords"} onClick={() => setVisible(!visible)} type="button" variant="ghost" size="icon">{visible ? <EyeOff size={17} /> : <Eye size={17} />}</Button></div>{errors[field] ? <p role="alert" className="mt-1.5 text-xs text-rose-700">{errors[field]?.message}</p> : null}</div>)}
    <ul className="grid gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 sm:grid-cols-2">{passwordRequirements.map(rule => <li key={rule.label} className={`flex items-center gap-1.5 ${rule.test(password) ? "text-primary" : ""}`}><Check size={13} className={rule.test(password) ? "opacity-100" : "opacity-30"} />{rule.label}</li>)}</ul>
    {message ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{message}</p> : null}
    <Button disabled={pending} type="submit">{pending ? <Loader2 className="animate-spin" size={17} /> : <ArrowRight size={17} />}{pending ? "Activating..." : "Set password and activate"}</Button>
  </form>;
}
