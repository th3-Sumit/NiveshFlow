"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useForm, useWatch, type UseFormSetError } from "react-hook-form";
import {
  ArrowRight,
  BarChart3,
  Camera,
  CheckCircle2,
  Crop,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  Phone,
  PiggyBank,
  ShieldCheck,
  Upload,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import {
  loginAction,
  requestLoginOtpAction,
  requestPasswordResetOtpAction,
  resetPasswordAction,
  signupAction,
  verifyLoginOtpAction,
  verifyPasswordResetOtpAction,
} from "@/app/actions/auth";
import type { AuthFormState } from "@/app/lib/auth-state";
import { idleAuthState } from "@/app/lib/auth-state";
import { cn } from "@/app/lib/utils";
import { getPasswordErrors, passwordRequirements, passwordScore } from "@/app/lib/validation";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Separator } from "@/app/components/ui/separator";
import { FinanceBackdrop } from "@/app/components/auth/finance-backdrop";

type AuthMode = "signup" | "login" | "otp-login" | "forgot-password";

type SignupValues = {
  name: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type LoginValues = {
  email: string;
  password: string;
};

type IdentifierValues = {
  identifier: string;
};

type OtpValues = {
  code: string;
};

type ResetPasswordValues = {
  password: string;
  confirmPassword: string;
};

const modeContent = {
  signup: {
    badge: "A fresh start for your finances",
    title: "Make room for",
    accent: "your next money goal.",
    text: "Bring your accounts, everyday spending, and savings goals together. A little clarity today goes a long way tomorrow.",
    formTitle: "Create your workspace",
    formText: "Your money, your goals, your own space.",
    icon: UserRound,
  },
  login: {
    badge: "Personal finance, connected",
    title: "Every money decision,",
    accent: "a little clearer.",
    text: "From your first coffee to your next big milestone, NiveshFlow brings your money into focus. Pick up right where you left off.",
    formTitle: "Sign in to your workspace",
    formText: "Welcome back. Your financial picture awaits.",
    icon: LockKeyhole,
  },
  "otp-login": {
    badge: "A simpler way back in",
    title: "Your money overview,",
    accent: "one code away.",
    text: "A fresh verification code brings you back to your accounts, spending, and goals. Keep moving toward what matters to you.",
    formTitle: "Sign in with a code",
    formText: "Use the email or phone linked to your account.",
    icon: Fingerprint,
  },
  "forgot-password": {
    badge: "Account recovery",
    title: "A fresh password.",
    accent: "The same possibilities.",
    text: "Get back to your financial plans with a verified password reset. Your accounts, history, and goals will be here when you return.",
    formTitle: "Reset your password",
    formText: "We'll send a code to verify it's you.",
    icon: KeyRound,
  },
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?\d{7,15}$/;
const otpPattern = /^\d{6}$/;
const errorClass = "mt-1.5 text-[12px] font-bold text-rose-600";
const inputIconClass =
  "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400";

function isValidIdentifier(value: string) {
  const trimmed = value.trim();
  const normalizedPhone = trimmed.replace(/[^\d+]/g, "");

  return emailPattern.test(trimmed) || phonePattern.test(normalizedPhone);
}

function firstError(errors?: string[]) {
  return errors?.find(Boolean);
}

function setServerErrors<T extends Record<string, unknown>>(
  state: AuthFormState,
  setError: UseFormSetError<T>,
) {
  if (!state.errors) {
    return;
  }

  for (const [field, messages] of Object.entries(state.errors)) {
    const message = firstError(messages);

    if (message) {
      setError(field as Parameters<UseFormSetError<T>>[0], {
        type: "server",
        message,
      });
    }
  }
}

function createFormData(values: Record<string, string | undefined>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    formData.append(key, value ?? "");
  }

  return formData;
}

function StatusMessage({ state }: { state: AuthFormState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      className={cn(
        "rounded-lg border px-4 py-3 text-sm font-medium",
        state.status === "error"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-800",
      )}
    >
      {state.message}
    </p>
  );
}

function SubmitButton({
  children,
  pending,
}: {
  children: React.ReactNode;
  pending: boolean;
}) {
  return (
    <Button
      className="w-full"
      disabled={pending}
      size="lg"
      type="submit"
    >
      {pending ? <Loader2 className="animate-spin" size={18} /> : children}
    </Button>
  );
}

function PasswordInput({
  autoComplete = "new-password",
  id,
  label,
  error,
  registration,
  onChangeValue,
}: {
  autoComplete?: "current-password" | "new-password";
  id: string;
  label: string;
  error?: string;
  registration: ReturnType<ReturnType<typeof useForm>["register"]>;
  onChangeValue?: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <Label htmlFor={id}>
        {label}
      </Label>
      <div className="relative">
        <LockKeyhole className={inputIconClass} size={18} />
        <Input
          {...registration}
          aria-invalid={Boolean(error)}
          autoComplete={autoComplete}
          className="pl-12 pr-12"
          id={id}
          placeholder="****"
          onChange={(event) => {
            registration.onChange(event);
            onChangeValue?.(event.target.value);
          }}
          type={visible ? "text" : "password"}
        />
        <Button
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:-translate-y-1/2"
          onClick={() => setVisible((current) => !current)}
          size="icon"
          type="button"
          variant="ghost"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </Button>
      </div>
      {error ? <p className={errorClass}>{error}</p> : null}
    </div>
  );
}

function PasswordMeter({ password }: { password: string }) {
  const score = passwordScore(password);

  return (
    <div className="rounded-lg bg-slate-50/80 p-3">
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <span
            className={`h-2 rounded-full transition ${
              index < score ? "bg-emerald-500" : "bg-slate-200"
            }`}
            key={index}
          />
        ))}
      </div>
      <ul className="mt-2 grid gap-1 text-[11px] font-medium leading-4 text-slate-500 sm:grid-cols-2">
        {passwordRequirements.map((rule) => (
          <li
            className={`flex items-center gap-1.5 ${
              rule.test(password) ? "text-emerald-700" : ""
            }`}
            key={rule.label}
          >
            <CheckCircle2 size={13} />
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className={errorClass}>{message}</p> : null;
}

function drawCropPreview({
  canvas,
  image,
  zoom,
  offsetX,
  offsetY,
}: {
  canvas: HTMLCanvasElement;
  image: HTMLImageElement;
  zoom: number;
  offsetX: number;
  offsetY: number;
}) {
  const size = 512;
  const cropSize = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
  const maxX = Math.max((image.naturalWidth - cropSize) / 2, 0);
  const maxY = Math.max((image.naturalHeight - cropSize) / 2, 0);
  const cropX =
    (image.naturalWidth - cropSize) / 2 + (offsetX / 100) * maxX;
  const cropY =
    (image.naturalHeight - cropSize) / 2 + (offsetY / 100) * maxY;
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  canvas.width = size;
  canvas.height = size;
  context.clearRect(0, 0, size, size);
  context.drawImage(image, cropX, cropY, cropSize, cropSize, 0, 0, size, size);
}

function ProfileImageUploader({
  value,
  onChange,
  onError,
}: {
  value: File | null;
  onChange: (file: File | null) => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceImageRef = useRef<HTMLImageElement | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [cropOpen, setCropOpen] = useState(false);
  const [zoom, setZoom] = useState(1.15);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  useEffect(() => {
    if (!sourceUrl) {
      return;
    }

    const image = new Image();
    image.onload = () => {
      sourceImageRef.current = image;
      if (canvasRef.current) {
        drawCropPreview({
          canvas: canvasRef.current,
          image,
          zoom,
          offsetX,
          offsetY,
        });
      }
    };
    image.src = sourceUrl;
  }, [sourceUrl, zoom, offsetX, offsetY]);

  useEffect(() => {
    const image = sourceImageRef.current;

    if (image && canvasRef.current) {
      drawCropPreview({
        canvas: canvasRef.current,
        image,
        zoom,
        offsetX,
        offsetY,
      });
    }
  }, [zoom, offsetX, offsetY]);

  useEffect(() => {
    return () => {
      if (sourceUrl) {
        URL.revokeObjectURL(sourceUrl);
      }
    };
  }, [sourceUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function commitFile(file: File | null) {
    setPreviewUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }

      return file ? URL.createObjectURL(file) : "";
    });
    onChange(file);
  }

  function chooseFile(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      onError("Choose an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      onError("Choose an image smaller than 5MB.");
      return;
    }

    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
    }

    setFileName(file.name);
    setZoom(1.15);
    setOffsetX(0);
    setOffsetY(0);
    setSourceUrl(URL.createObjectURL(file));
    setCropOpen(true);
  }

  async function applyCrop() {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );

    if (!blob) {
      onError("Could not crop the selected image.");
      return;
    }

    const croppedFile = new File([blob], "profile-image.jpg", {
      type: "image/jpeg",
    });

    commitFile(croppedFile);
    setCropOpen(false);
  }

  return (
    <div className="rounded-lg border border-teal-100 bg-teal-50/40 p-3">
      <input
        accept="image/*"
        className="sr-only"
        onChange={(event) => chooseFile(event.target.files?.[0])}
        ref={inputRef}
        type="file"
      />
      <div className="flex items-center gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-teal-100 bg-white text-teal-600">
          {value && previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt="Profile preview"
              className="size-full object-cover"
              src={previewUrl}
            />
          ) : (
            <Camera size={24} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">
            Profile photo <span className="font-normal text-slate-400">(optional)</span>
          </p>
          <p className="mt-1 truncate text-xs font-semibold text-slate-500">
            {value ? fileName || "Cropped image ready" : "Choose an image up to 5 MB"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {value ? (
            <Button
              aria-label="Remove selected profile image"
              onClick={() => commitFile(null)}
              size="icon"
              type="button"
              variant="outline"
            >
              <X size={17} />
            </Button>
          ) : null}
          <Button
            onClick={() => inputRef.current?.click()}
            size="sm"
            type="button"
            variant="outline"
          >
            <Upload size={15} />
            {value ? "Change" : "Choose"}
          </Button>
        </div>
      </div>

      {cropOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/65 p-5 backdrop-blur-md">
          <Card role="dialog" aria-modal="true" aria-label="Crop profile image" className="scrollbar-none max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto bg-white p-0 shadow-2xl">
            <CardHeader className="flex flex-row items-start justify-between gap-4 p-5 pb-0">
              <div>
                <p className="text-sm font-bold uppercase text-emerald-600">
                  Crop profile image
                </p>
                <CardTitle className="mt-1 text-2xl">
                  Preview before upload
                </CardTitle>
              </div>
              <Button
                aria-label="Close crop dialog"
                onClick={() => setCropOpen(false)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X size={18} />
              </Button>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid gap-5 sm:grid-cols-[220px_1fr]">
                <div className="grid place-items-center">
                  <canvas
                    className="size-[220px] rounded-full border-8 border-slate-100 bg-slate-100 object-cover shadow-inner"
                    ref={canvasRef}
                  />
                </div>
                <div className="grid content-center gap-4">
                  <Label className="grid gap-2">
                    Zoom
                    <input
                      className="accent-teal-600"
                      max="3"
                      min="1"
                      onChange={(event) => setZoom(Number(event.target.value))}
                      step="0.05"
                      type="range"
                      value={zoom}
                    />
                  </Label>
                  <Label className="grid gap-2">
                    Horizontal position
                    <input
                      className="accent-teal-600"
                      max="100"
                      min="-100"
                      onChange={(event) =>
                        setOffsetX(Number(event.target.value))
                      }
                      type="range"
                      value={offsetX}
                    />
                  </Label>
                  <Label className="grid gap-2">
                    Vertical position
                    <input
                      className="accent-teal-600"
                      max="100"
                      min="-100"
                      onChange={(event) =>
                        setOffsetY(Number(event.target.value))
                      }
                      type="range"
                      value={offsetY}
                    />
                  </Label>
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button
                  className="flex-1"
                  onClick={() => inputRef.current?.click()}
                  size="lg"
                  type="button"
                  variant="outline"
                >
                  Pick another
                </Button>
                <Button
                  className="flex-1"
                  onClick={applyCrop}
                  size="lg"
                  type="button"
                >
                  <Crop size={17} />
                  Use cropped image
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function AuthHero({ mode }: { mode: AuthMode }) {
  const content = modeContent[mode];
  const benefits = [
    {
      icon: WalletCards,
      title: "All your accounts, together",
      text: "A clear view of your bank accounts, wallets, and cash.",
    },
    {
      icon: BarChart3,
      title: "Know where your money goes",
      text: "Connect everyday spending to your bigger picture.",
    },
    {
      icon: PiggyBank,
      title: "Make progress on what matters",
      text: "Keep savings goals, bills, and debt in perspective.",
    },
    {
      icon: ShieldCheck,
      title: "A workspace that's just yours",
      text: "Your personal finances stay in your own account.",
    },
  ];

  return (
    <aside className="min-w-0 lg:py-6 lg:pr-6">
      <div>
        <Badge className="max-w-full whitespace-normal px-3 py-1.5 text-xs font-medium motion-safe:animate-content-in" variant="emerald">
          <ShieldCheck size={16} />
          {content.badge}
        </Badge>
        <h1 className="mt-5 max-w-xl text-balance text-3xl font-semibold leading-[1.15] text-slate-900 sm:text-4xl xl:text-5xl">
          <span className="block motion-safe:animate-content-in motion-safe:[animation-delay:70ms]">{content.title}</span>
          <span className="mt-1 block text-primary motion-safe:animate-content-in motion-safe:[animation-delay:150ms]">{content.accent}</span>
        </h1>
        <p className="mt-5 max-w-lg text-sm leading-6 text-slate-600 motion-safe:animate-content-in motion-safe:[animation-delay:220ms] sm:text-base sm:leading-7">
          {content.text}
        </p>
      </div>

      <ul className="mt-8 hidden gap-5 lg:grid">
        {benefits.map(({ icon: Icon, title, text }, index) => (
          <li className="flex items-start gap-3.5 motion-safe:animate-content-in" style={{ animationDelay: `${280 + index * 60}ms` }} key={title}>
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-teal-200/60 bg-white/85 text-primary shadow-sm">
              <Icon size={19} strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">{title}</p>
              <p className="mt-1 text-sm leading-5 text-slate-500">{text}</p>
            </div>
          </li>
        ))}
      </ul>
      <dl className="mt-8 hidden grid-cols-3 gap-5 border-t border-teal-200/60 pt-5 motion-safe:animate-content-in motion-safe:[animation-delay:480ms] lg:grid">
        {[
          ["Accounts", "All in one place"],
          ["Spending", "Clearer choices"],
          ["Goals", "Steady progress"],
        ].map(([label, description]) => (
          <div key={label}>
            <dt className="text-lg font-semibold text-teal-700">{label}</dt>
            <dd className="mt-1 text-xs text-slate-500">{description}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

function SignupForm() {
  const [serverState, setServerState] = useState<AuthFormState>(idleAuthState);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isPending, startSignupTransition] = useTransition();
  const {
    clearErrors,
    control,
    formState: { errors },
    getValues,
    handleSubmit,
    register,
    setError,
  } = useForm<SignupValues>({
    criteriaMode: "all",
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    mode: "onChange",
  });
  const password = useWatch({ control, name: "password" }) ?? "";

  const onSubmit = handleSubmit((values) => {
    const formData = createFormData(values);

    if (avatarFile) {
      formData.append("avatar", avatarFile);
    }

    setServerState(idleAuthState);
    clearErrors();
    startSignupTransition(async () => {
      const result = await signupAction(idleAuthState, formData);

      if (result) {
        setServerState(result);
        setServerErrors(result, setError);
      }
    });
  });

  return (
    <form className="grid gap-3.5" noValidate onSubmit={onSubmit}>
      <StatusMessage state={serverState} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">
            Full name
          </Label>
          <div className="relative">
            <UserRound className={inputIconClass} size={18} />
            <Input
              {...register("name", {
                minLength: {
                  message: "Name must be at least 2 characters.",
                  value: 2,
                },
                required: "Full name is required.",
              })}
              aria-invalid={Boolean(errors.name)}
              autoComplete="name"
              className="pl-12"
              id="name"
              placeholder="Sumit Kumar"
              type="text"
            />
          </div>
          <FieldError message={errors.name?.message} />
        </div>
        <div>
          <Label htmlFor="phone">
            Phone number
          </Label>
          <div className="relative">
            <Phone className={inputIconClass} size={18} />
            <Input
              {...register("phone", {
                required: "Phone number is required.",
                validate: (value) =>
                  phonePattern.test(value.replace(/[^\d+]/g, "")) ||
                  "Enter a valid phone number.",
              })}
              aria-invalid={Boolean(errors.phone)}
              autoComplete="tel"
              className="pl-12"
              id="phone"
              placeholder="+919876543210"
              type="tel"
            />
          </div>
          <FieldError message={errors.phone?.message} />
        </div>
      </div>

      <div>
        <Label htmlFor="email">
          Email
        </Label>
        <div className="relative">
          <Mail className={inputIconClass} size={18} />
          <Input
            {...register("email", {
              pattern: {
                message: "Enter a valid email.",
                value: emailPattern,
              },
              required: "Email is required.",
            })}
            aria-invalid={Boolean(errors.email)}
            autoComplete="email"
            className="pl-12"
            id="email"
            placeholder="you@example.com"
            type="email"
          />
        </div>
        <FieldError message={errors.email?.message} />
      </div>

      <ProfileImageUploader
        onChange={setAvatarFile}
        onError={(message) => setServerState({ status: "error", message })}
        value={avatarFile}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <PasswordInput
          error={errors.password?.message}
          id="password"
          label="Password"
          onChangeValue={() => clearErrors("confirmPassword")}
          registration={register("password", {
            required: "Password is required.",
            validate: (value) => firstError(getPasswordErrors(value)) ?? true,
          })}
        />
        <PasswordInput
          error={errors.confirmPassword?.message}
          id="confirmPassword"
          label="Confirm password"
          registration={register("confirmPassword", {
            required: "Confirm your password.",
            validate: (value) =>
              value === getValues("password") || "Passwords must match.",
          })}
        />
      </div>
      <PasswordMeter password={password} />
      <SubmitButton pending={isPending}>
        Create account
        <ArrowRight size={18} />
      </SubmitButton>
      <p className="text-center text-sm font-bold text-slate-500">
        Already have an account?{" "}
        <Link className="text-primary hover:underline" href="/login">
          Login
        </Link>
      </p>
    </form>
  );
}

function LoginForm() {
  const [serverState, setServerState] = useState<AuthFormState>(idleAuthState);
  const [isPending, startLoginTransition] = useTransition();
  const {
    clearErrors,
    formState: { errors },
    handleSubmit,
    register,
    setError,
  } = useForm<LoginValues>({ mode: "onChange" });

  const onSubmit = handleSubmit((values) => {
    const formData = createFormData(values);

    setServerState(idleAuthState);
    clearErrors();
    startLoginTransition(async () => {
      const result = await loginAction(idleAuthState, formData);

      if (result) {
        setServerState(result);
        setServerErrors(result, setError);
      }
    });
  });

  return (
    <form className="grid gap-5" noValidate onSubmit={onSubmit}>
      <StatusMessage state={serverState} />
      <div>
        <Label htmlFor="email">
          Email address
        </Label>
        <div className="relative">
          <Mail className={inputIconClass} size={18} />
          <Input
            {...register("email", {
              pattern: { message: "Enter a valid email.", value: emailPattern },
              required: "Email is required.",
            })}
            aria-invalid={Boolean(errors.email)}
            autoComplete="username"
            className="pl-12"
            id="email"
            placeholder="you@example.com"
            type="email"
          />
        </div>
        <FieldError message={errors.email?.message} />
      </div>
      <PasswordInput
        autoComplete="current-password"
        error={errors.password?.message}
        id="password"
        label="Password"
        registration={register("password", {
          required: "Password is required.",
        })}
      />
      <div className="-mt-2 flex justify-end text-sm font-medium">
        <Link className="text-primary hover:underline" href="/forgot-password">
          Forgot password?
        </Link>
      </div>
      <SubmitButton pending={isPending}>
        Sign in
        <ArrowRight size={18} />
      </SubmitButton>
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <Separator className="flex-1" />
        <span>or</span>
        <Separator className="flex-1" />
      </div>
      <Button asChild className="w-full" variant="outline">
        <Link href="/login-otp">
          <Fingerprint size={17} />
          Sign in with OTP
        </Link>
      </Button>
      <p className="text-center text-sm text-slate-500">
        New here?{" "}
        <Link className="font-semibold text-primary hover:underline" href="/signup">
          Create account
        </Link>
      </p>
    </form>
  );
}

function OtpLoginForm() {
  const [requestState, setRequestState] = useState<AuthFormState>({
    ...idleAuthState,
    stage: "request",
  });
  const [verifyState, setVerifyState] = useState<AuthFormState>({
    ...idleAuthState,
    stage: "verify",
  });
  const [isPending, startOtpTransition] = useTransition();
  const requestForm = useForm<IdentifierValues>({ mode: "onChange" });
  const verifyForm = useForm<OtpValues>({ mode: "onChange" });

  function submitIdentifier(values: IdentifierValues) {
    const formData = createFormData(values);

    setRequestState({ ...idleAuthState, stage: "request" });
    requestForm.clearErrors();
    startOtpTransition(async () => {
      const result = await requestLoginOtpAction(idleAuthState, formData);

      if (result) {
        setRequestState(result);
        setServerErrors(result, requestForm.setError);
      }
    });
  }

  function submitOtp(values: OtpValues) {
    const formData = createFormData({
      code: values.code,
      identifier: requestState.identifier,
    });

    setVerifyState({ ...idleAuthState, stage: "verify" });
    verifyForm.clearErrors();
    startOtpTransition(async () => {
      const result = await verifyLoginOtpAction(idleAuthState, formData);

      if (result) {
        const nextState = {
          ...result,
          identifier: requestState.identifier,
          maskedDestination: requestState.maskedDestination,
          stage: "verify" as const,
        };
        setVerifyState(nextState);
        setServerErrors(nextState, verifyForm.setError);
      }
    });
  }

  if (requestState.stage === "verify") {
    return (
      <form className="grid gap-4" noValidate onSubmit={verifyForm.handleSubmit(submitOtp)}>
        <StatusMessage state={verifyState} />
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
          Code sent to {requestState.maskedDestination}. It expires in 10
          minutes.
        </p>
        <div>
          <Label htmlFor="code">
            OTP
          </Label>
          <Input
            {...verifyForm.register("code", {
              pattern: { message: "Enter the 6 digit OTP.", value: otpPattern },
              required: "OTP is required.",
            })}
            aria-invalid={Boolean(verifyForm.formState.errors.code)}
            className="text-center text-2xl tracking-normal"
            id="code"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            type="text"
          />
          <FieldError message={verifyForm.formState.errors.code?.message} />
        </div>
        <SubmitButton pending={isPending}>
          Verify and login
          <Fingerprint size={18} />
        </SubmitButton>
      </form>
    );
  }

  return (
    <form className="grid gap-4" noValidate onSubmit={requestForm.handleSubmit(submitIdentifier)}>
      <StatusMessage state={requestState} />
      <div>
        <Label htmlFor="identifier">
          Email or phone
        </Label>
        <Input
          {...requestForm.register("identifier", {
            required: "Email or phone is required.",
            validate: (value) =>
              isValidIdentifier(value) || "Enter a valid email or phone number.",
          })}
          aria-invalid={Boolean(requestForm.formState.errors.identifier)}
          id="identifier"
          placeholder="you@example.com or +919876543210"
          type="text"
        />
        <FieldError message={requestForm.formState.errors.identifier?.message} />
      </div>
      <SubmitButton pending={isPending}>
        Send OTP
        <KeyRound size={18} />
      </SubmitButton>
      <p className="text-center text-sm font-bold text-slate-500">
        Prefer password?{" "}
        <Link className="text-primary hover:underline" href="/login">
          Login
        </Link>
      </p>
    </form>
  );
}

function ForgotPasswordForm() {
  const [requestState, setRequestState] = useState<AuthFormState>({
    ...idleAuthState,
    stage: "request",
  });
  const [verifyState, setVerifyState] = useState<AuthFormState>({
    ...idleAuthState,
    stage: "verify",
  });
  const [resetState, setResetState] = useState<AuthFormState>({
    ...idleAuthState,
    stage: "reset",
  });
  const [newPassword, setNewPassword] = useState("");
  const [isPending, startResetTransition] = useTransition();
  const requestForm = useForm<IdentifierValues>({ mode: "onChange" });
  const verifyForm = useForm<OtpValues>({ mode: "onChange" });
  const passwordForm = useForm<ResetPasswordValues>({ mode: "onChange" });

  function submitIdentifier(values: IdentifierValues) {
    const formData = createFormData(values);

    setRequestState({ ...idleAuthState, stage: "request" });
    requestForm.clearErrors();
    startResetTransition(async () => {
      const result = await requestPasswordResetOtpAction(idleAuthState, formData);

      if (result) {
        setRequestState(result);
        setServerErrors(result, requestForm.setError);
      }
    });
  }

  function submitOtp(values: OtpValues) {
    const formData = createFormData({
      code: values.code,
      identifier: requestState.identifier,
    });

    setVerifyState({ ...idleAuthState, stage: "verify" });
    verifyForm.clearErrors();
    startResetTransition(async () => {
      const result = await verifyPasswordResetOtpAction(idleAuthState, formData);

      if (result) {
        const nextState = {
          ...result,
          identifier: requestState.identifier,
          maskedDestination: requestState.maskedDestination,
          stage: result.stage ?? ("verify" as const),
        };
        setVerifyState(nextState);
        setServerErrors(nextState, verifyForm.setError);
      }
    });
  }

  function submitPassword(values: ResetPasswordValues) {
    const formData = createFormData({
      confirmPassword: values.confirmPassword,
      password: values.password,
      resetToken: verifyState.resetToken,
    });

    setResetState({ ...idleAuthState, stage: "reset" });
    passwordForm.clearErrors();
    startResetTransition(async () => {
      const result = await resetPasswordAction(idleAuthState, formData);

      if (result) {
        setResetState(result);
        setServerErrors(result, passwordForm.setError);
      }
    });
  }

  if (verifyState.stage === "reset" && verifyState.resetToken) {
    return (
      <form className="grid gap-4" noValidate onSubmit={passwordForm.handleSubmit(submitPassword)}>
        <StatusMessage state={resetState.status === "idle" ? verifyState : resetState} />
        <PasswordInput
          error={passwordForm.formState.errors.password?.message}
          id="password"
          label="New password"
          onChangeValue={(value) => {
            setNewPassword(value);
            passwordForm.clearErrors("confirmPassword");
          }}
          registration={passwordForm.register("password", {
            required: "New password is required.",
            validate: (value) => firstError(getPasswordErrors(value)) ?? true,
          })}
        />
        <PasswordInput
          error={passwordForm.formState.errors.confirmPassword?.message}
          id="confirmPassword"
          label="Confirm new password"
          registration={passwordForm.register("confirmPassword", {
            required: "Confirm your password.",
            validate: (value) =>
              value === passwordForm.getValues("password") ||
              "Passwords must match.",
          })}
        />
        <PasswordMeter password={newPassword} />
        <SubmitButton pending={isPending}>
          Save new password
          <ShieldCheck size={18} />
        </SubmitButton>
      </form>
    );
  }

  if (requestState.stage === "verify") {
    return (
      <form className="grid gap-4" noValidate onSubmit={verifyForm.handleSubmit(submitOtp)}>
        <StatusMessage state={verifyState} />
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
          Recovery code sent to {requestState.maskedDestination}.
        </p>
        <div>
          <Label htmlFor="resetCode">
            OTP
          </Label>
          <Input
            {...verifyForm.register("code", {
              pattern: { message: "Enter the 6 digit OTP.", value: otpPattern },
              required: "OTP is required.",
            })}
            aria-invalid={Boolean(verifyForm.formState.errors.code)}
            className="text-center text-2xl tracking-normal"
            id="resetCode"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            type="text"
          />
          <FieldError message={verifyForm.formState.errors.code?.message} />
        </div>
        <SubmitButton pending={isPending}>
          Verify OTP
          <ArrowRight size={18} />
        </SubmitButton>
      </form>
    );
  }

  return (
    <form className="grid gap-4" noValidate onSubmit={requestForm.handleSubmit(submitIdentifier)}>
      <StatusMessage state={requestState} />
      <div>
        <Label htmlFor="identifier">
          Email or phone
        </Label>
        <Input
          {...requestForm.register("identifier", {
            required: "Email or phone is required.",
            validate: (value) =>
              isValidIdentifier(value) || "Enter a valid email or phone number.",
          })}
          aria-invalid={Boolean(requestForm.formState.errors.identifier)}
          id="identifier"
          placeholder="you@example.com or +919876543210"
          type="text"
        />
        <FieldError message={requestForm.formState.errors.identifier?.message} />
      </div>
      <SubmitButton pending={isPending}>
        Send recovery OTP
        <KeyRound size={18} />
      </SubmitButton>
      <p className="text-center text-sm font-bold text-slate-500">
        Remembered it?{" "}
        <Link className="text-primary hover:underline" href="/login">
          Login
        </Link>
      </p>
    </form>
  );
}

export function AuthCard({ mode }: { mode: AuthMode }) {
  const content = modeContent[mode];
  const FormIcon = content.icon;

  return (
    <main className="group/auth relative isolate flex h-[100dvh] flex-col overflow-hidden bg-[linear-gradient(115deg,#e1f8f2_0%,#f2fcf9_46%,#ffffff_100%)] text-slate-950">
      <FinanceBackdrop />
      <header className="relative z-20 shrink-0 border-b border-teal-100/70 bg-white/70 px-5 backdrop-blur-xl sm:px-8">
        <nav aria-label="Main navigation" className="mx-auto flex h-[72px] w-full max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-white shadow-sm shadow-teal-700/15">
              <WalletCards size={21} />
            </span>
            <span>
              <span className="block text-base font-semibold text-slate-900">NiveshFlow</span>
              <span className="block text-[11px] text-slate-500">Personal finance, in focus</span>
            </span>
          </Link>
          <Button asChild size="sm" variant="ghost">
            <Link href="/">Back to home <ArrowRight size={15} /></Link>
          </Button>
        </nav>
      </header>

      <div className="scrollbar-none relative min-h-0 flex-1 overflow-y-auto px-5 sm:px-8">
        <section className="mx-auto grid min-h-full w-full max-w-6xl items-center gap-8 py-8 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
          <AuthHero mode={mode} />
          <div className="w-full min-w-0 max-w-xl justify-self-center lg:justify-self-end">
            <Card className="relative border-teal-200/70 bg-white/95 shadow-[0_20px_70px_rgba(0,125,111,0.10)] motion-safe:animate-none">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-4 top-1.5 h-1 rounded-full bg-primary" />
              <CardHeader className="p-6 pb-0">
                <div className="flex items-start gap-3.5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-white shadow-md shadow-teal-600/20">
                    <FormIcon size={22} strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0">
                    <CardTitle className="text-xl motion-safe:animate-content-in motion-safe:[animation-delay:100ms]">{content.formTitle}</CardTitle>
                    <CardDescription className="mt-1 motion-safe:animate-content-in motion-safe:[animation-delay:170ms]">{content.formText}</CardDescription>
                  </div>
                </div>
                <Separator className="mb-6 mt-5 bg-teal-100/80" />
              </CardHeader>
              <CardContent className="p-6 pt-0">
                {mode === "signup" ? <SignupForm /> : null}
                {mode === "login" ? <LoginForm /> : null}
                {mode === "otp-login" ? <OtpLoginForm /> : null}
                {mode === "forgot-password" ? <ForgotPasswordForm /> : null}
                <div className="mt-5 flex items-center justify-center gap-2 border-t border-teal-100/80 pt-4 text-center text-xs leading-5 text-slate-500 motion-safe:animate-content-in motion-safe:[animation-delay:250ms]">
                  <ShieldCheck className="shrink-0 text-primary" size={14} />
                  Your financial details stay in your workspace.
                </div>
              </CardContent>
            </Card>
            {mode !== "signup" ? (
              <p className="mt-5 text-center text-xs text-slate-400 motion-safe:animate-content-in motion-safe:[animation-delay:320ms]">NiveshFlow. A clearer view of your money.</p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
