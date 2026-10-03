import { z } from "zod";

export const passwordRequirements = [
  {
    label: "At least 8 characters",
    test: (value: string) => value.length >= 8,
  },
  {
    label: "One uppercase letter",
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    label: "One lowercase letter",
    test: (value: string) => /[a-z]/.test(value),
  },
  {
    label: "One number",
    test: (value: string) => /\d/.test(value),
  },
  {
    label: "One special character",
    test: (value: string) => /[^A-Za-z0-9]/.test(value),
  },
];

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "").trim();
}

export function getPasswordErrors(password: string) {
  return passwordRequirements
    .filter((rule) => !rule.test(password))
    .map((rule) => rule.label);
}

export function passwordScore(password: string) {
  return passwordRequirements.filter((rule) => rule.test(password)).length;
}

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters."),
    email: z
      .string()
      .trim()
      .email("Enter a valid email.")
      .transform(normalizeEmail),
    phone: z
      .string()
      .trim()
      .transform(normalizePhone)
      .refine((value) => /^\+?\d{7,15}$/.test(value), {
        message: "Enter a valid phone number.",
      }),
    password: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((value, context) => {
    for (const error of getPasswordErrors(value.password)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: error,
      });
    }

    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords must match.",
      });
    }
  });

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email.")
    .transform(normalizeEmail),
  password: z.string().min(1, "Password is required."),
});

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  phone: z
    .string()
    .trim()
    .transform(normalizePhone)
    .refine((value) => /^\+?\d{7,15}$/.test(value), {
      message: "Enter a valid phone number.",
    }),
});

export const identifierSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your email or phone number."),
});

export const otpSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your email or phone number."),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6 digit OTP."),
});

export const resetPasswordSchema = z
  .object({
    resetToken: z.string().trim().min(20, "Reset token is invalid."),
    password: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((value, context) => {
    for (const error of getPasswordErrors(value.password)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: error,
      });
    }

    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords must match.",
      });
    }
  });
