/**
 * A random prefix minted once per JS context. Combined with a monotonic counter
 * it yields collision-free, opaque toast ids that are also safe across a
 * fast-refresh: a reloaded context gets a fresh prefix, so it can never collide
 * with ids a stale native overlay might still be holding.
 */
const SESSION_PREFIX = generateSessionPrefix();

let toastCounter = 0;
let actionCounter = 0;

function generateSessionPrefix(): string {
  const hi = Math.floor(Math.random() * 0x7fffffff).toString(36);
  const lo = Math.floor(Math.random() * 0x7fffffff).toString(36);
  return `${hi}${lo}`;
}

/**
 * The per-context session prefix, sent to native in the handshake so the platform
 * side can detect and flush state left over from a previous run.
 */
export const sessionPrefix = SESSION_PREFIX;

/** Mints a globally-unique (within this run) opaque toast id. */
export function nextToastId(): string {
  return `lt_${SESSION_PREFIX}_${String(toastCounter++).padStart(4, "0")}`;
}

/** Mints an action id, unique within the toast it belongs to. */
export function nextActionId(): string {
  return `a${actionCounter++}`;
}
