CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"parent_id" text,
	"provenance" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_category_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"feed_id" text NOT NULL,
	"category_id" text NOT NULL,
	"provenance" text NOT NULL,
	"confidence" double precision,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_item_category_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"feed_item_id" text NOT NULL,
	"category_id" text NOT NULL,
	"provenance" text NOT NULL,
	"confidence" double precision,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_item_tag_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"feed_item_id" text NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"provenance" text NOT NULL,
	"confidence" double precision,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"kind" text NOT NULL,
	"external_account_id" text,
	"display_name" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"external_id" text,
	"display_name" text,
	"url" text,
	"domain" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "source_kind" text DEFAULT 'rss' NOT NULL;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "source_id" text;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "submitted_url" text;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "site_url" text;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "canonical_feed_url" text;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "discovered_from_url" text;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "discovery_provenance" text;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "catalog_source" text;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "language" text;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "content_type" text;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "quality_score" double precision;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "last_successful_fetch_at" timestamp;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "catalog_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "metadata_provenance" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "source_kind" text DEFAULT 'rss' NOT NULL;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "source_id" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "author_name" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "language" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "media" jsonb;--> statement-breakpoint
ALTER TABLE "feed_category_assignments" ADD CONSTRAINT "feed_category_assignments_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_category_assignments" ADD CONSTRAINT "feed_category_assignments_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_item_category_assignments" ADD CONSTRAINT "feed_item_category_assignments_feed_item_id_feed_items_id_fk" FOREIGN KEY ("feed_item_id") REFERENCES "public"."feed_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_item_category_assignments" ADD CONSTRAINT "feed_item_category_assignments_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_item_tag_assignments" ADD CONSTRAINT "feed_item_tag_assignments_feed_item_id_feed_items_id_fk" FOREIGN KEY ("feed_item_id") REFERENCES "public"."feed_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_accounts" ADD CONSTRAINT "source_accounts_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_unique" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_parent_id_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "feed_category_assignments_feed_category_provenance_unique" ON "feed_category_assignments" USING btree ("feed_id","category_id","provenance");--> statement-breakpoint
CREATE INDEX "feed_category_assignments_category_id_idx" ON "feed_category_assignments" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "feed_item_category_assignments_item_category_provenance_unique" ON "feed_item_category_assignments" USING btree ("feed_item_id","category_id","provenance");--> statement-breakpoint
CREATE INDEX "feed_item_category_assignments_category_id_idx" ON "feed_item_category_assignments" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "feed_item_tag_assignments_item_slug_provenance_unique" ON "feed_item_tag_assignments" USING btree ("feed_item_id","slug","provenance");--> statement-breakpoint
CREATE INDEX "feed_item_tag_assignments_slug_idx" ON "feed_item_tag_assignments" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "source_accounts_source_id_idx" ON "source_accounts" USING btree ("source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_kind_external_id_unique" ON "sources" USING btree ("kind","external_id") WHERE external_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "sources_domain_idx" ON "sources" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "feeds_source_kind_idx" ON "feeds" USING btree ("source_kind","id");