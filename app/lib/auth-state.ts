export type AuthFieldErrors = Record<string, string[] | undefined>;

export type AuthFormState = {
  status: "idle" | "error" | "success";
  stage?: "request" | "verify" | "reset" | "complete";
  message?: string;
  errors?: AuthFieldErrors;
  identifier?: string;
  maskedDestination?: string;
  resetToken?: string;
};

export const idleAuthState: AuthFormState = {
  status: "idle",
};
