export const SESSION_UNAVAILABLE_MESSAGE = "Unable to load your session. Try again.";

export type AuthenticatedSession = {
  session: {
    id: string;
    expiresAt: string;
    token: string;
    createdAt: string;
    updatedAt: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    userId: string;
  };
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    name: string;
    image?: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

export type AuthSession = AuthenticatedSession | { session: null; user: null } | null;

export type AuthSessionState =
  | { status: "authenticated"; session: AuthenticatedSession }
  | { status: "anonymous"; session: null }
  | { status: "unavailable"; session: null; message: string };

export type AvailableAuthSessionState = Exclude<AuthSessionState, { status: "unavailable" }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function hasStringFields(record: Record<string, unknown>, fields: string[]) {
  return fields.every((field) => typeof record[field] === "string");
}

function isSessionRecord(value: unknown): value is AuthenticatedSession["session"] {
  return (
    isRecord(value) &&
    hasStringFields(value, ["id", "expiresAt", "token", "createdAt", "updatedAt", "userId"])
  );
}

function isUserRecord(value: unknown): value is AuthenticatedSession["user"] {
  return (
    isRecord(value) &&
    hasStringFields(value, ["id", "email", "name", "createdAt", "updatedAt"]) &&
    typeof value.emailVerified === "boolean"
  );
}

export function unavailableAuthSessionState(
  message = SESSION_UNAVAILABLE_MESSAGE,
): Extract<AuthSessionState, { status: "unavailable" }> {
  return { status: "unavailable", session: null, message };
}

export function classifyAuthSessionPayload(payload: unknown): AuthSessionState {
  if (payload === null) {
    return { status: "anonymous", session: null };
  }

  if (!isRecord(payload)) {
    return unavailableAuthSessionState();
  }

  if (payload.session === null && payload.user === null) {
    return { status: "anonymous", session: null };
  }

  if (isSessionRecord(payload.session) && isUserRecord(payload.user)) {
    return {
      status: "authenticated",
      session: {
        session: payload.session,
        user: payload.user,
      },
    };
  }

  return unavailableAuthSessionState();
}
