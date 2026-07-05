import { describe, expect, test } from "bun:test";
import { findMissingRequiredIndexes, findMissingRequiredTables } from "@adapters/db/schema-guard";

describe("findMissingRequiredTables", () => {
  test("returns missing sentinel tables", () => {
    expect(findMissingRequiredTables(["users", "feeds"])).toEqual(["sessions", "memberships"]);
  });

  test("returns an empty list when all sentinel tables are present", () => {
    expect(findMissingRequiredTables(["users", "sessions", "feeds", "memberships"])).toEqual([]);
  });
});

describe("findMissingRequiredIndexes", () => {
  const requiredFeedRefreshIndexes = [
    "categories_slug_unique",
    "feed_items_feed_id_canonical_url_unique",
    "feed_item_tag_assignments_item_slug_provenance_unique",
    "feed_category_assignments_feed_category_provenance_unique",
    "feed_category_assignments_feed_category_provenance_model_unique",
    "feed_item_category_assignments_item_category_provenance_unique",
    "feed_item_category_assignments_item_category_prov_model_unique",
  ];

  test("returns missing feed-refresh sentinel indexes", () => {
    expect(
      findMissingRequiredIndexes([
        "categories_slug_unique",
        "feed_items_feed_id_canonical_url_unique",
      ]),
    ).toEqual([
      "feed_item_tag_assignments_item_slug_provenance_unique",
      "feed_category_assignments_feed_category_provenance_unique",
      "feed_category_assignments_feed_category_provenance_model_unique",
      "feed_item_category_assignments_item_category_provenance_unique",
      "feed_item_category_assignments_item_category_prov_model_unique",
    ]);
  });

  test("returns an empty list when all sentinel indexes are present", () => {
    expect(findMissingRequiredIndexes(requiredFeedRefreshIndexes)).toEqual([]);
  });
});
