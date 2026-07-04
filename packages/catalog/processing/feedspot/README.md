# feedspot

Feedspot scraper. one of the inputs to the catalog pipeline.

## use

run from `packages/catalog`.

```bash
uv run python processing/feedspot/scraper.py [URL]
```

if `URL` is omitted, the scraper uses Feedspot's technology RSS list.

## output

a JSON object with:

| field | notes |
| --- | --- |
| `category` | category inferred from the Feedspot page. |
| `feeds` | title, feed URL, website URL, description, and follower counts when available. |

## notes

- Python dependencies come from `packages/catalog/pyproject.toml`.
- Feedspot markup is not an API contract. keep selector changes isolated to the scraper.
