# stage 3: favicon and dedupe

loads enriched feed JSONL into DuckDB, recovers missing favicons, and deduplicates feeds.

## input

the enriched feed JSONL from stage 2. the source can be large, so this stage streams it through DuckDB instead of loading it all into memory.

## use

run from this directory.

```bash
uv sync --dev
uv run python3 main.py --dry-run
uv run python3 main.py --input ../stage-2-fetching/enriched_feeds.jsonl --output stage_3_feeds.parquet
```

## output

a deduplicated Parquet file for later stages.

## notes

- use `--dry-run` for small validation runs before processing the full dataset.
- missing favicons should be recovered from website URLs when possible.
- dedupe prefers stable identity signals: content hash, canonical URL, and title similarity.
