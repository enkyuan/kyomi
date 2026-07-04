import { describe, expect, test } from "bun:test";
import {
  CANONICAL_CATEGORY_LABELS,
  MISCELLANEOUS_CATEGORY_LABEL,
  canonicalizeCategoryLabels,
  isCanonicalCategoryLabel,
  mapCategoryLabelToCanonical,
} from "@kyomi/db";

describe("category taxonomy", () => {
  test("exposes exactly the documented canonical labels", () => {
    expect(CANONICAL_CATEGORY_LABELS).toEqual([
      "AI & ML",
      "Software Engineering",
      "Security & Privacy",
      "Technology",
      "Science & Research",
      "Business & Startups",
      "Finance & Markets",
      "Politics & Policy",
      "World & Society",
      "Culture & Media",
      "Design & UX",
      "Health & Medicine",
      "Climate & Environment",
      "Education & Work",
      "Sports",
      "Food & Travel",
      "Personal & Essays",
      "Miscellaneous",
    ]);
    expect(MISCELLANEOUS_CATEGORY_LABEL).toBe("Miscellaneous");
  });

  test("maps exact canonical labels to themselves", () => {
    expect(mapCategoryLabelToCanonical("Technology")).toBe("Technology");
    expect(mapCategoryLabelToCanonical("Sports")).toBe("Sports");
  });

  test("maps known aliases case-insensitively", () => {
    expect(mapCategoryLabelToCanonical("javascript")).toBe("Software Engineering");
    expect(mapCategoryLabelToCanonical("JavaScript")).toBe("Software Engineering");
    expect(mapCategoryLabelToCanonical("Machine Learning")).toBe("AI & ML");
    expect(mapCategoryLabelToCanonical("SaaS")).toBe("Business & Startups");
    expect(mapCategoryLabelToCanonical("Podcasts")).toBe("Culture & Media");
  });

  test("returns null for unmapped noisy labels", () => {
    expect(mapCategoryLabelToCanonical("#hottake")).toBeNull();
    expect(mapCategoryLabelToCanonical("2026-07-04")).toBeNull();
    expect(mapCategoryLabelToCanonical("")).toBeNull();
    expect(mapCategoryLabelToCanonical("   ")).toBeNull();
  });

  test("canonicalizeCategoryLabels dedupes and drops unmapped labels", () => {
    expect(
      canonicalizeCategoryLabels(["JavaScript", "Programming", "TypeScript", "#random"]),
    ).toEqual(["Software Engineering"]);
  });

  test("canonicalizeCategoryLabels preserves first-seen order across distinct categories", () => {
    expect(canonicalizeCategoryLabels(["Security", "AI", "javascript"])).toEqual([
      "Security & Privacy",
      "AI & ML",
      "Software Engineering",
    ]);
  });

  test("isCanonicalCategoryLabel only accepts exact canonical labels", () => {
    expect(isCanonicalCategoryLabel("Technology")).toBe(true);
    expect(isCanonicalCategoryLabel("technology")).toBe(false);
    expect(isCanonicalCategoryLabel("Not A Category")).toBe(false);
  });
});
