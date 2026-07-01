CREATE TABLE IF NOT EXISTS "favicon_hosts" (
  "origin" text PRIMARY KEY NOT NULL,
  "hostname" text NOT NULL,
  "resolved_url" text,
  "source" text,
  "status" text DEFAULT 'miss' NOT NULL,
  "content_type" text,
  "width" integer,
  "height" integer,
  "expires_at" timestamp,
  "last_checked_at" timestamp,
  "last_failed_at" timestamp,
  "error_code" text,
  "version" text DEFAULT '4' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "favicon_hosts_hostname_idx"
  ON "favicon_hosts" ("hostname");

CREATE INDEX IF NOT EXISTS "favicon_hosts_expires_at_idx"
  ON "favicon_hosts" ("expires_at");
