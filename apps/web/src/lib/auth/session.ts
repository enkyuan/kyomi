const SESSION_UNAVAILABLE_MESSAGE = "Unable to load your session. Try again.";

/**
 * What the page may hold of the signed-in session. This state is serialized into the HTML document
 * and returned to the browser on every navigation, so it is built from an allowlist: never the
 * IP address or the user agent (and `get-session` no longer returns the session token). Settings
 * reads those from the live session or the sessions list when it needs them.
 */
type AuthenticatedSession = {
  session: {
    id: string;
    expiresAt: string;
    createdAt: string;
    updatedAt: string;
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

/** A complete session record from the API. It carries no token: `get-session` leaves it out. */
function isSessionRecord(
  value: unknown,
): value is AuthenticatedSession["session"] & Record<string, unknown> {
  return (
    isRecord(value) &&
    hasStringFields(value, ["id", "expiresAt", "createdAt", "updatedAt", "userId"])
  );
}

function pickSession(session: AuthenticatedSession["session"]): AuthenticatedSession["session"] {
  return {
    id: session.id,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    userId: session.userId,
  };
}

function pickUser(user: AuthenticatedSession["user"]): AuthenticatedSession["user"] {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    name: user.name,
    ...(user.image === undefined ? {} : { image: user.image }),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
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
        session: pickSession(payload.session),
        user: pickUser(payload.user),
      },
    };
  }

  return unavailableAuthSessionState();
}
