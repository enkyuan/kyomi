# @vols.rss/worker

Owns queue contracts and Redis stream consumption.

Responsibilities:
- Define worker job types and payload schemas.
- Serialize and parse Redis stream job fields.
- Ensure and consume worker stream groups.
- Provide the execution shell that calls an app-supplied job handler.

Not responsibilities:
- Feed refresh business rules.
- HTTP routes or API service modules.
- Database-backed ingestion decisions.

Business execution belongs in packages like `@vols.rss/ingestion`; API adapters
publish typed jobs without knowing how workers execute them.

