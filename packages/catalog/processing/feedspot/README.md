# Feedspot Processing

Feedspot scraper utilities used as one input to the optional catalog pipeline.

## Use

Run from `packages/catalog`.

```bash
uv run python processing/feedspot/scraper.py [URL]
```

If `URL` is omitted, the scraper uses Feedspot's technology RSS list.

## Output

The scraper prints a JSON object with:

| Field | Notes |
| --- | --- |
| `category` | Category inferred from the Feedspot page. |
| `feeds` | Feed entries with title, feed URL, website URL, description, and follower counts when available. |

## Notes

- Python dependencies are managed by `packages/catalog/pyproject.toml`.
- Feedspot markup is not an API contract; keep selector changes isolated to the scraper.
