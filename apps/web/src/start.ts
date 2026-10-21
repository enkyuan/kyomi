import { createSerializationAdapter } from "@tanstack/react-router";
import { createStart } from "@tanstack/react-start";
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

export const startInstance = createStart(() => ({
  serializationAdapters: [httpStatusErrorAdapter],
}));
