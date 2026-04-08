import sqlite3
import json
import time
import threading
from typing import Optional, Dict, Any, Tuple


class FeedCache:
    """
    Key-Value SQLite cache for storing enriched feed data.
    Schema: url (PK), blob (JSON), last_fetched (REAL), etag (TEXT), last_modified (TEXT), hash (TEXT)
    """

    def __init__(self, db_path: str):
        self.db_path = db_path
        self._local = threading.local()
        self._init_db()

    def _get_conn(self):
        if not hasattr(self._local, "conn"):
            self._local.conn = sqlite3.connect(self.db_path, timeout=30.0)
            self._local.conn.execute("PRAGMA journal_mode=WAL")
            self._local.conn.execute("PRAGMA synchronous=NORMAL")
            self._local.conn.row_factory = sqlite3.Row
        return self._local.conn

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS feed_cache (
                    url TEXT PRIMARY KEY,
                    blob TEXT,
                    last_fetched REAL,
                    etag TEXT,
                    http_last_modified TEXT,
                    content_hash TEXT
                )
            """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_last_fetched ON feed_cache(last_fetched)"
            )

    def get(self, url: str) -> Optional[Dict[str, Any]]:
        """Retrieve full enriched feed object."""
        conn = self._get_conn()
        cur = conn.execute("SELECT blob FROM feed_cache WHERE url = ?", (url,))
        row = cur.fetchone()
        if row:
            try:
                return json.loads(row["blob"])
            except json.JSONDecodeError:
                return None
        return None

    def get_metadata(self, url: str) -> Optional[Dict[str, Any]]:
        """Retrieve just the metadata for conditional fetching."""
        conn = self._get_conn()
        cur = conn.execute(
            "SELECT last_fetched, etag, http_last_modified, content_hash FROM feed_cache WHERE url = ?",
            (url,),
        )
        row = cur.fetchone()
        if row:
            return dict(row)
        return None

    def set(self, url: str, data: Dict[str, Any]):
        """Upsert feed data."""
        conn = self._get_conn()

        # Extract metadata from the enriched payload for quick access columns
        fetch_details = data.get("fetch_details", {})
        etag = fetch_details.get("http_etag")
        last_modified = fetch_details.get("http_last_modified")
        content_hash = fetch_details.get("content_hash")
        fetch_date = fetch_details.get("fetch_date", time.time())

        blob_str = json.dumps(data, ensure_ascii=False)

        conn.execute(
            """
            INSERT OR REPLACE INTO feed_cache (url, blob, last_fetched, etag, http_last_modified, content_hash)
            VALUES (?, ?, ?, ?, ?, ?)
        """,
            (url, blob_str, fetch_date, etag, last_modified, content_hash),
        )
        conn.commit()

    def touch(self, url: str):
        """Update last_fetched timestamp without changing content (for 304s)."""
        conn = self._get_conn()
        now = time.time()
        conn.execute("UPDATE feed_cache SET last_fetched = ? WHERE url = ?", (now, url))
        conn.commit()

    def close(self):
        if hasattr(self._local, "conn"):
            self._local.conn.close()
