import { createSerializationAdapter } from "@tanstack/react-router";
import { createCsrfMiddleware, createStart } from "@tanstack/react-start";
import { HttpStatusError } from "@lib/status";

// The router serializes an error as its message alone, which would drop the status the error page
// picks its copy from once the page hydrates or a server function throws.
const httpStatusErrorAdapter = createSerializationAdapter({
  key: "HttpStatusError",
  test: (value: unknown): value is HttpStatusError => value instanceof HttpStatusError,
  toSerializable: (error: HttpStatusError) => ({ status: error.status, message: error.message }),
  fromSerializable: ({ status, message }: { status: number; message: string }) =>
    new HttpStatusError(status, message),
});

// Start protects server functions from cross-site requests by default, but only while the app has no
// start instance. Defining one drops that, so it is installed here again: a server function request
// must be provably same-origin (`Sec-Fetch-Site`, else `Origin`, else `Referer`), which also refuses
// a same-site sibling or a link click from another page, where SameSite=Lax alone would not.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
  serializationAdapters: [httpStatusErrorAdapter],
}));
