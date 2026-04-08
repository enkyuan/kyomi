import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import {
  loginFormSchema,
  registerFormSchema,
} from "@pages/auth/auth-form.shared";

type SessionData =
  Awaited<ReturnType<Awaited<ReturnType<typeof getAuth>>["api"]["getSession"]>>;

type SessionGetter = {
  getSession: (args: { headers: Headers }) => Promise<SessionData>;
};

type LoginInput = {
  email: string;
  password: string;
};

type RegisterInput = {
  email: string;
  password: string;
  confirmPassword: string;
};

type AuthActionResult = {
  error: string | null;
};

async function getAuth() {
  const module = await import("@lib/auth");
  return module.auth;
}

export async function fetchSessionFromHeaders(
  headers: Headers,
  sessionGetter?: SessionGetter,
) {
  const auth = await getAuth();
  return (sessionGetter ?? auth.api).getSession({ headers });
}

export const getSession = createServerFn({ method: "POST" }).handler(async () => {
  const headers = getRequestHeaders();
  return fetchSessionFromHeaders(headers);
});

export const ensureSession = createServerFn({ method: "POST" }).handler(async () => {
  const session = await getSession();

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  return session;
});

function getAuthErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export const signInWithEmail = createServerFn({ method: "POST" })
  .inputValidator((input: LoginInput) => loginFormSchema.parse(input))
  .handler(async ({ data }): Promise<AuthActionResult> => {
    const headers = getRequestHeaders();
    const auth = await getAuth();

    try {
      await auth.api.signInEmail({
        body: {
          email: data.email,
          password: data.password,
        },
        headers,
      });

      return { error: null };
    } catch (error) {
      return {
        error: getAuthErrorMessage(error, "Invalid email or password"),
      };
    }
  });

export const signUpWithEmail = createServerFn({ method: "POST" })
  .inputValidator((input: RegisterInput) => registerFormSchema.parse(input))
  .handler(async ({ data }): Promise<AuthActionResult> => {
    const headers = getRequestHeaders();
    const auth = await getAuth();

    try {
      await auth.api.signUpEmail({
        body: {
          email: data.email,
          password: data.password,
          name: data.email.split("@")[0] || "User",
        },
        headers,
      });

      return { error: null };
    } catch (error) {
      return {
        error: getAuthErrorMessage(error, "An error occurred during sign up"),
      };
    }
  });
