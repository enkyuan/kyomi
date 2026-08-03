# Catalog package

Use `packages/catalog` for the optional offline Python pipeline that produces seeded feed catalog
data.

## Structure

```text
feed/                         Importable Python enrichment helpers
processing/
  stage-*/                    Ordered source-processing stages
  export_catalog_for_kyomi.py Canonical JSONL export
  exports/                    Generated, ignored output
inputs/                       Source datasets
category_map/                 Mapping data
pyproject.toml                Python dependencies and ty configuration
uv.lock                       Locked environment
```

## Rules

- Keep the Python import root as `feed`; use `from feed...` rather than a repository-qualified
  package name.
- Use snake_case for Python files, functions, and variables.
- Keep dependencies in `pyproject.toml` and refresh `uv.lock` through uv. Never hand-edit the lock.
- Keep generated exports, databases, Parquet files, caches, and virtual environments out of source
  organization and commits.
- Preserve the JSONL export contract consumed by `scripts/catalog/import.ts`.
- Keep normal app development independent of uv, Poetry, and catalog synchronization.
- Keep the scheduled wrapper in `scripts/catalog/sync.ts`; preserve its lock and log behavior.

## Tests and checks

- Run `bun run catalog:install` after dependency changes.
- Run `bun run --cwd packages/catalog typecheck`.
- Run `bun run catalog:export`, `catalog:import`, and `catalog:smoke` only when the changed stage or
  export contract requires the end-to-end offline pipeline and its infrastructure is available.
- If Python tests are introduced, name them `test_*.py`, choose one canonical pytest location, and
  wire it through the package script and `$testing` rather than scattering tests beside stages.
