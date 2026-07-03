# Stage 3: Favicon And Dedupe

Catalog pipeline stage for loading enriched feed JSONL into DuckDB, recovering missing favicons, and deduplicating feeds.

## Input

Stage 3 consumes the enriched feed JSONL produced by stage 2. The source data can be large, so this stage should process it through DuckDB instead of loading it all into memory.

## Use

Run from this directory.

```bash
uv sync --dev
uv run python3 main.py --dry-run
uv run python3 main.py --input ../stage-2-fetching/enriched_feeds.jsonl --output stage_3_feeds.parquet
```

## Output

The full run writes a deduplicated Parquet file for later enrichment stages.

## Notes

- Use `--dry-run` for small validation runs before processing the full dataset.
- Missing favicons should be recovered from website URLs when possible.
- Dedupe should prefer stable feed identity signals such as content hash, canonical URL, and title similarity.
