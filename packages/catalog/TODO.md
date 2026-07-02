## Catalog Data

### Merge With Original Dataset
- [ ] Compare current catalog against original dataset.
- [ ] Define canonical feed identity:
  - feed URL
  - site URL
  - normalized domain
  - title
- [ ] Deduplicate feeds across both datasets.
- [ ] Preserve existing stable IDs where possible.
- [ ] Add migration script for merging old catalog rows into the current schema.
- [ ] Add validation report:
  - total feeds before merge
  - total feeds after merge
  - duplicate count
  - invalid URL count
  - missing metadata count

### Fill Missing Feed Metadata
- [ ] Find all feeds without `content_type`.
- [ ] Backfill `content_type`.
- [ ] Backfill missing:
  - title
  - description
  - site URL
  - language
  - favicon URL
  - content type
  - last successful fetch timestamp
- [ ] Add catalog health checks for incomplete records.

## Vols.RSS Integration

### Import Existing Data
- [ ] Inspect kyomi feed/article/export schema.
- [ ] Map kyomi fields to kyomi catalog fields.
- [ ] Identify new fields worth adding:
  - source quality score
  - feed category
  - feed content type
  - extraction status
  - enrichment status
  - favicon asset key
  - last enrichment timestamp
- [ ] Add migration/import script.
- [ ] Add dry-run mode for import.
- [ ] Add import summary report.

### UI Display Additions
- [ ] Display feed content type.
- [ ] Display enrichment status.
- [ ] Display favicon source/status.
- [ ] Display last refreshed/enriched time.
- [ ] Add admin/debug view for catalog quality.

## Favicon System

### S3-Based Favicon Serving
- [ ] Build favicon fetch/enrichment worker.
- [ ] Store favicon assets in S3-compatible storage.
- [ ] Save favicon asset key on feed records.
- [ ] Serve favicons through stable API/CDN URL.
- [ ] Add fallback favicon behavior.
- [ ] Add cache headers.
- [ ] Add retry/backoff for failed favicon fetches.
- [ ] Avoid blocking feed preview/import on favicon resolution.

## Enrichment Pipeline

### Carry Over vols Processing Pipeline
- [ ] Port feed enrichment logic from vols feed modules.
- [ ] Switch network fetching to `aiohttp`.
- [ ] Switch AI enrichment to Vertex AI.
- [ ] Define enrichment task types:
  - feed metadata enrichment
  - favicon enrichment
  - content type detection
  - article extraction
  - quality scoring
- [ ] Make enrichment idempotent.
- [ ] Add retry/backoff/dead-letter handling.
- [ ] Store enrichment status per feed.

### OPML Import Integration
- [ ] Convert OPML import into batch task creation.
- [ ] After OPML import, enqueue batch enrichment jobs.
- [ ] Track batch progress:
  - queued
  - running
  - completed
  - failed
- [ ] Show import/enrichment progress in UI.
- [ ] Allow retrying failed feeds.

## Catalog Search and Quality

- [ ] Add normalized search fields.
- [ ] Index catalog for fast search.
- [ ] Add ranking signals:
  - feed freshness
  - successful fetch history
  - article count
  - duplicate confidence
  - metadata completeness
- [ ] Add admin command to recompute catalog quality.
- [ ] Add tests for URL normalization and deduplication.

## Production Readiness

- [ ] Add catalog migration scripts.
- [ ] Add seed/dev dataset separate from full catalog.
- [ ] Add import dry-run mode.
- [ ] Add structured logs for catalog jobs.
- [ ] Add metrics:
  - import duration
  - enrichment duration
  - failed feed count
  - favicon success rate
  - missing metadata count
- [ ] Add rollback strategy for bad imports.
- [ ] Document the full catalog pipeline.
