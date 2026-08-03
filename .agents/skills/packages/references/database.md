# Database package

Use `packages/db` for Drizzle schema modules, generated migrations, and shared schema exports.

## Structure

```text
packages/db/
  src/
    schema/<domain>.ts     Tables and relations grouped by product domain
    schema/index.ts        Schema composition surface
    schema.ts              Public schema entrypoint
    index.ts               Package entrypoint
  drizzle/                 Generated SQL migrations
  drizzle/meta/            Generated snapshots and journal
  drizzle.config.ts        Environment-backed generator configuration
```

## Rules

- Add tables, columns, relations, and indexes to the owning domain file under `src/schema`.
- Compose new domain schema modules through `src/schema/index.ts` and the declared package exports.
- Keep product queries, authorization, and request behavior in `apps/api/src/modules/<domain>`.
- Generate durable changes with `bun run db:generate`; do not hand-author snapshots or the journal.
- Inspect generated SQL for destructive operations, defaults, nullability, locks, index cost, and
  rollback implications.
- Commit schema, generated SQL, snapshot, journal, behavior, and tests as one coherent checkpoint.
- Use `db:push` only for a disposable local database, never as a substitute for a committed
  migration.
- Keep environment loading in `drizzle.config.ts` compatible with `docker/.env` and `apps/api/.env`.

## Tests and checks

- Put schema and migration behavior under `tests/api/integration/db`.
- Put business query behavior under the owning `tests/api/integration/modules/<domain>` tree.
- Run the focused Bun tests, `bun run --cwd packages/db typecheck`, and
  `bun scripts/ci/drizzle-drift.ts`.
