# @vols.rss/sanitization

Owns shared HTML sanitization configuration.

Responsibilities:
- Export article-safe DOMPurify configuration.
- Register sanitization hooks for article HTML.
- Keep sanitization rules framework-agnostic.

Not responsibilities:
- API route handling.
- Database reads or writes.
- Feed parsing, extraction, or worker jobs.

This package should stay dependency-light and must not import app modules.

