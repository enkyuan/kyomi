import duckdb

JSONL_FILE = "/home/kamui/rss-r-us/processing/stage-5-final/feeds_articles.jsonl"
DB_FILE = "/home/kamui/rss-r-us/processing/stage-5-final/feeds_articles.db"


def build_db():
    print(f"Building DuckDB from {JSONL_FILE}...")
    con = duckdb.connect(DB_FILE)

    # 1. Create table with explicit schema
    # We use 'epoch_ms' or similar conversion if published_at is float
    # But read_json_auto is smart. Let's try to define schema closely.
    # published_at in JSONL is likely float (unix timestamp).
    # To store as TIMESTAMP in DuckDB, we can ingest as DOUBLE then ALTER or create structured.
    # Easiest: Load as is, then use 'to_timestamp' if needed or just keep as DOUBLE.
    # USER REQUEST: "published at should be timestamp"

    con.execute("DROP TABLE IF EXISTS articles")

    # We can use read_json to infer, but explicit is better for the TIMESTAMP conversion.
    # If published_at is float in JSON, DuckDB reads it as DOUBLE.
    # We can use a generated column or transformation.

    print("Importing JSONL...")
    # Using read_json to load data directly into a table
    # We can cast strictly during selection

    query = """
    CREATE TABLE articles AS 
    SELECT 
        feed_url,
        title,
        link,
        to_timestamp(published_at) as published_at,
        summary,
        content_html,
        author,
        guid,
        image_url,
        tags
    FROM read_json_auto(?, columns={
        feed_url: 'VARCHAR',
        title: 'VARCHAR',
        link: 'VARCHAR',
        published_at: 'DOUBLE', 
        summary: 'VARCHAR',
        content_html: 'VARCHAR',
        author: 'VARCHAR',
        guid: 'VARCHAR',
        image_url: 'VARCHAR',
        tags: 'VARCHAR[]'
    })
    """

    con.execute(query, [JSONL_FILE])

    print("Creating indexes...")
    con.execute("CREATE INDEX idx_feed_date ON articles(feed_url, published_at DESC)")

    count = con.execute("SELECT count(*) FROM articles").fetchone()[0]
    print(f"Successfully created database with {count} articles.")
    con.close()


if __name__ == "__main__":
    build_db()
