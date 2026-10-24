import { expect, test } from "bun:test";
import { shouldFetchEmptyPage } from "../../../../../../apps/mobile/src/modules/inbox/hooks/use-empty-page";

const ready = {
  hasNextPage: true,
  isLoading: false,
  isFetchingNextPage: false,
  isRefetching: false,
  isError: false,
};
test("continues past a filtered-out page, but not past exhaustion or a failed request", () => {
  expect(shouldFetchEmptyPage(0, ready)).toBe(true);
  expect(shouldFetchEmptyPage(1, ready)).toBe(false);
  expect(shouldFetchEmptyPage(0, { ...ready, hasNextPage: false })).toBe(false);
  for (const flag of ["isLoading", "isFetchingNextPage", "isRefetching", "isError"] as const) {
    expect(shouldFetchEmptyPage(0, { ...ready, [flag]: true })).toBe(false);
  }
});
