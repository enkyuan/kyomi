import { z } from "zod";

type ValidationErrorLike = {
  message?: string;
};

export type LoginFormValues = {
  email: string;
  password: string;
};

export type RegisterFormValues = LoginFormValues & {
  confirmPassword: string;
};

export type ForgotPasswordFormValues = {
  email: string;
};

export type ResetPasswordFormValues = {
  password: string;
  confirmPassword: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getEmailError(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return "Email is required";
  }
  if (!EMAIL_PATTERN.test(normalized)) {
    return "Enter a valid email address";
  }
  return null;
}

export function isValidEmail(value: string): boolean {
  return getEmailError(value) === null;
}

function getPasswordError(value: string) {
  return value.length > 0 ? null : "Password is required";
}

function getRegisterPasswordError(value: string) {
  return value.length >= 8 ? null : "Password must be at least 8 characters long";
}

function getConfirmPasswordError(password: string, confirmPassword: string) {
  if (!confirmPassword.length) {
    return "Please confirm your password";
  }
  if (password !== confirmPassword) {
    return "Passwords don't match";
  }
  return null;
}

export function loginFormValidator({ value }: { value: LoginFormValues }) {
  const errors: Partial<Record<keyof LoginFormValues, string>> = {};
  const emailError = getEmailError(value.email);
  const passwordError = getPasswordError(value.password);

  if (emailError) {
    errors.email = emailError;
  }
  if (passwordError) {
    errors.password = passwordError;
  }

  return Object.keys(errors).length ? { fields: errors } : undefined;
}

export function registerFormValidator({ value }: { value: RegisterFormValues }) {
  const errors: Partial<Record<keyof RegisterFormValues, string>> = {};
  const emailError = getEmailError(value.email);
  const passwordError = getRegisterPasswordError(value.password);
  const confirmPasswordError = getConfirmPasswordError(value.password, value.confirmPassword);

  if (emailError) {
    errors.email = emailError;
  }
  if (passwordError) {
    errors.password = passwordError;
  }
  if (confirmPasswordError) {
    errors.confirmPassword = confirmPasswordError;
  }

  return Object.keys(errors).length ? { fields: errors } : undefined;
}

export function forgotPasswordFormValidator({ value }: { value: ForgotPasswordFormValues }) {
  const emailError = getEmailError(value.email);
  return emailError ? { fields: { email: emailError } } : undefined;
}

export function resetPasswordFormValidator({ value }: { value: ResetPasswordFormValues }) {
  const errors: Partial<Record<keyof ResetPasswordFormValues, string>> = {};
  const passwordError = getRegisterPasswordError(value.password);
  const confirmPasswordError = getConfirmPasswordError(value.password, value.confirmPassword);

  if (passwordError) {
    errors.password = passwordError;
  }
  if (confirmPasswordError) {
    errors.confirmPassword = confirmPasswordError;
  }

  return Object.keys(errors).length ? { fields: errors } : undefined;
}

export const loginDefaultValues: LoginFormValues = {
  email: "",
  password: "",
};

export const registerDefaultValues: RegisterFormValues = {
  email: "",
  password: "",
  confirmPassword: "",
};

export const forgotPasswordDefaultValues: ForgotPasswordFormValues = {
  email: "",
};

export const resetPasswordDefaultValues: ResetPasswordFormValues = {
  password: "",
  confirmPassword: "",
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

export const authSessionListRowSchema = z.object({
  id: z.string(),
  token: z.string(),
  ipAddress: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  userAgent: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  updatedAt: z.string(),
  expiresAt: z.string(),
  locationLabel: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  locationCity: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  locationRegion: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  locationCountry: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
});

export const authSessionListSchema = z.array(authSessionListRowSchema);
