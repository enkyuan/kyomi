import { describe, expect, test } from "vitest";
import { deriveInboxListHeaderCount } from "../../../../modules/inbox/utils/count-display";

describe("deriveInboxListHeaderCount", () => {
  test("uses API total when view-count succeeded and not read-scoped", () => {
    const result = deriveInboxListHeaderCount({
      filter: "today",
      loadedCount: 3,
      hasNextPage: true,
      viewCountQuery: { isSuccess: true, data: { count: 40 } },
      includeRead: false,
      activeScopeLabel: undefined,
    });
    expect(result).toEqual({ numberPart: "40", unitPart: "today" });
  });

  test("uses loaded cardinality when total query did not run", () => {
    const result = deriveInboxListHeaderCount({
      filter: "recent",
      loadedCount: 12,
      hasNextPage: true,
      viewCountQuery: { isSuccess: false, data: undefined },
      includeRead: false,
      activeScopeLabel: undefined,
    });
    expect(result.numberPart).toBe("12+");
    expect(result.unitPart).toBe("read");
  });

  test("read-scoped today uses loaded cardinality and read unit even if stale success data exists", () => {
    const result = deriveInboxListHeaderCount({
      filter: "today",
      loadedCount: 5,
      hasNextPage: false,
      viewCountQuery: { isSuccess: true, data: { count: 99 } },
      includeRead: true,
      activeScopeLabel: "read",
    });
    expect(result.numberPart).toBe("5");
    expect(result.unitPart).toBe("read");
  });
});
