import z from "zod";

const _emailFormatSchema = z.email({ error: "Enter a valid email address" });

/** Trimmed, non-empty email for auth and account forms. */
const authEmailSchema = z.string().trim().min(1, "Email is required").pipe(_emailFormatSchema);

export function isValidEmail(value: string): boolean {
  return authEmailSchema.safeParse(value).success;
}

export const loginFormSchema = z.object({
  email: authEmailSchema,
  password: z.string().min(1, "Password is required"),
});

export const registerFormSchema = z
  .object({
    email: authEmailSchema,
    password: z.string().min(8, "Password must be at least 8 characters long"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });

export const loginDefaultValues = {
  email: "",
  password: "",
} satisfies z.input<typeof loginFormSchema>;

export const registerDefaultValues = {
  email: "",
  password: "",
  confirmPassword: "",
} satisfies z.input<typeof registerFormSchema>;

type ValidationErrorLike = {
  message?: string;
};

export function getFieldErrorMessage(errors: readonly unknown[], canShow: boolean) {
  if (!canShow) {
    return null;
  }

  const firstError = errors[0] as string | ValidationErrorLike | undefined;

  if (!firstError) {
    return null;
  }

  return typeof firstError === "string" ? firstError : (firstError.message ?? null);
}
