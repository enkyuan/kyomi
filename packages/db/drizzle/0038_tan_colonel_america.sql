CREATE TABLE "opml_import_items" (
	"id" text PRIMARY KEY NOT NULL,
	"import_id" text NOT NULL,
	"position" integer NOT NULL,
	"original_url" text NOT NULL,
	"normalized_url" text NOT NULL,
	"title" text,
	"folder_name" text NOT NULL,
	"folder_id" text,
	"feed_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp DEFAULT now() NOT NULL,
	"lease_token" text,
	"lease_expires_at" timestamp,
	"error_code" text,
	"error_message" text,
	"outcome_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opml_imports" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"filename" text NOT NULL,
	"source_url" text,
	"source_xml" text,
	"source_byte_length" integer NOT NULL,
	"opml_title" text,
	"opml_author" text,
	"status" text DEFAULT 'accepted' NOT NULL,
	"total_items" integer DEFAULT 0 NOT NULL,
	"completed_items" integer DEFAULT 0 NOT NULL,
	"subscribed_items" integer DEFAULT 0 NOT NULL,
	"already_subscribed_items" integer DEFAULT 0 NOT NULL,
	"failed_items" integer DEFAULT 0 NOT NULL,
	"cancelled_items" integer DEFAULT 0 NOT NULL,
	"prepare_wakeup_at" timestamp,
	"cancel_requested_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"last_heartbeat_at" timestamp,
	"last_error_code" text,
	"last_error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "opml_import_items" ADD CONSTRAINT "opml_import_items_import_id_opml_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."opml_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opml_import_items" ADD CONSTRAINT "opml_import_items_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opml_import_items" ADD CONSTRAINT "opml_import_items_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opml_imports" ADD CONSTRAINT "opml_imports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "opml_import_items_import_url_uidx" ON "opml_import_items" USING btree ("import_id","normalized_url");--> statement-breakpoint
CREATE UNIQUE INDEX "opml_import_items_import_position_uidx" ON "opml_import_items" USING btree ("import_id","position");--> statement-breakpoint
CREATE INDEX "opml_import_items_dispatch_idx" ON "opml_import_items" USING btree ("import_id","status","available_at","position","id");--> statement-breakpoint
CREATE INDEX "opml_import_items_lease_expiry_idx" ON "opml_import_items" USING btree ("status","lease_expires_at","id");--> statement-breakpoint
CREATE INDEX "opml_import_items_failure_page_idx" ON "opml_import_items" USING btree ("import_id","status","position","id");--> statement-breakpoint
CREATE UNIQUE INDEX "opml_imports_one_active_per_user_uidx" ON "opml_imports" USING btree ("user_id") WHERE status IN ('accepted','parsing','dispatching','running','cancelling');--> statement-breakpoint
CREATE INDEX "opml_imports_user_created_idx" ON "opml_imports" USING btree ("user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "opml_imports_reconcile_idx" ON "opml_imports" USING btree ("status","updated_at","id");--> statement-breakpoint
CREATE INDEX "opml_imports_retention_idx" ON "opml_imports" USING btree ("completed_at","id");