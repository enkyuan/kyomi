// A stand-in for `@tanstack/react-start`'s `createServerFn` that runs a server function the way the
// server does: its validator first, then its handler. Outside the Start compiler a call skips the
// validator, so a test that calls the function directly would never reach it.
type Validator = ((input: unknown) => unknown) | { parse: (input: unknown) => unknown };

export function createServerFn() {
  let validator: Validator | undefined;

  const builder = {
    validator(next: Validator) {
      validator = next;
      return builder;
    },
    handler(handler: (context: { data: unknown }) => unknown) {
      return async (call?: { data?: unknown }) => {
        const data =
          typeof validator === "function"
            ? await validator(call?.data)
            : validator
              ? await validator.parse(call?.data)
              : call?.data;
        return handler({ data });
      };
    },
  };
  return builder;
}

export const getRequestHeaders = () => new Headers({ cookie: "kyomi.session=victim" });
