CREATE TABLE IF NOT EXISTS "user_preferences" (
  "user_id" text PRIMARY KEY NOT NULL,
  "reader_mode" text DEFAULT 'smart' NOT NULL,
  "theme" text,
  "inbox_density" text,
  "article_open_behavior" text,
  "reader_font_size_px" integer DEFAULT 17 NOT NULL,
  "reader_content_width" text DEFAULT 'medium' NOT NULL,
  "reader_open_links_in_new_tab" boolean DEFAULT true NOT NULL,
  "reader_show_images" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "user_preferences_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE cascade ON UPDATE no action
);
