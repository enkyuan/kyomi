# Active web dependencies

Read `apps/web/package.json` before every framework change. The lockfile and installed declarations
are authoritative for callable APIs; use official documentation matching those versions for usage.

## Framework ownership

| Dependency               | Use in Kyomi                                                                              | Documentation boundary                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `@tanstack/react-start`  | Own SSR, server functions, request/runtime boundaries, and full-stack route composition.  | [TanStack Start](https://tanstack.com/start/latest/docs/framework/react/overview)             |
| `@tanstack/react-router` | Own file-based routes, layouts, loaders, search params, navigation, and route validation. | [TanStack Router](https://tanstack.com/router/latest/docs/framework/react/overview)           |
| `@tanstack/react-query`  | Own client data fetching, query keys, mutation state, cache updates, and invalidation.    | [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview)             |
| `@kyomi/ui`              | Own shared primitives, icons, motion, and styles. Import through public subpaths.         | Read the package exports and nearest existing component before adding or copying a primitive. |

## Documentation-first workflow

Before editing framework-sensitive code:

1. Read the owning web skill, `apps/web/package.json`, the nearest route/module, callers, exports,
   and closest tests.
2. Confirm the resolved package version and inspect the installed `.d.ts` or source declaration for
   the API being called.
3. Fetch only the relevant official page. Use Start for SSR/server functions, Router for route,
   loader, and search behavior, and Query for cache, mutation, and invalidation behavior.
4. Prefer official Markdown or `llms.txt` indexes over broad crawls. Do not commit fetched vendor
   documentation or treat a latest-page example as version proof.
5. Record the page URLs, package/version evidence, applied API rule, Kyomi divergence, and focused
   checks in the completion report.

## Coss UI evaluation boundary

[Coss UI](https://coss.com/ui/docs) is an evaluation-only reference. It is early-development,
copy-and-own software built on Base UI and Tailwind CSS. It is not a Kyomi dependency. Using a Coss
component requires an explicit adoption decision, package/dependency review, and alignment with
`packages/ui`; a feature must not introduce Coss incidentally or bypass existing public UI exports.
