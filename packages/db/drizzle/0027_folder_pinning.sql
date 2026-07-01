ALTER TABLE "folders" ADD COLUMN "is_pinned" boolean DEFAULT false NOT NULL;
ALTER TABLE "folders" ADD COLUMN "pinned_at" timestamp;

CREATE INDEX "folders_user_pinned_idx"
  ON "folders" ("user_id", "pinned_at" DESC, "name")
  WHERE "is_pinned" IS TRUE;
