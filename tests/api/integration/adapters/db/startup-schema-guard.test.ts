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
    "fitag_item_slug_prov_uidx",
    "fcat_feed_cat_prov_uidx",
    "fcat_feed_cat_prov_model_uidx",
    "ficat_item_cat_prov_uidx",
    "ficat_item_cat_prov_model_uidx",
  ];

  test("returns missing feed-refresh sentinel indexes", () => {
    expect(
      findMissingRequiredIndexes([
        "categories_slug_unique",
        "feed_items_feed_id_canonical_url_unique",
      ]),
    ).toEqual([
      "fitag_item_slug_prov_uidx",
      "fcat_feed_cat_prov_uidx",
      "fcat_feed_cat_prov_model_uidx",
      "ficat_item_cat_prov_uidx",
      "ficat_item_cat_prov_model_uidx",
    ]);
  });

  test("returns an empty list when all sentinel indexes are present", () => {
    expect(findMissingRequiredIndexes(requiredFeedRefreshIndexes)).toEqual([]);
  });

  test("keeps assignment index identifiers within the local 32-character limit", () => {
    const assignmentIndexes = requiredFeedRefreshIndexes.filter(
      (indexName) => indexName.endsWith("_uidx") && indexName !== "categories_slug_unique",
    );

    expect(
      assignmentIndexes.filter((indexName) => Buffer.byteLength(indexName, "utf8") > 32),
    ).toEqual([]);
  });
});
