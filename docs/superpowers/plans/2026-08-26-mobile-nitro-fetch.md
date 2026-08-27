# Kyomi mobile Nitro Fetch plan

## Goal

Use `react-native-nitro-fetch` for Kyomi-owned authenticated API requests without replacing global fetch or changing Better Auth. Warm the initial inbox after the protected route mounts and warm reader detail data on article-row touch-down.

## Decisions

- Keep Better Auth and third-party fetch behavior on their current transports.
- Do not attempt pre-JavaScript authenticated prefetch: the Better Auth cookie is retrieved from SecureStore by JavaScript.
- Use a stable `prefetchKey` on both the Nitro prefetch and the matching live query request. Nitro removes this internal header before sending the request to the API.
- Let React Query remain the rendering cache and error-state owner. Nitro is a short-lived transport warm cache only.

## Flow

```text
protected route mounts
  -> prefetch initial all-articles GET
  -> useArticles runs with the same prefetch key

article-row touch-down
  -> prefetch detail GET
  -> navigation on press
  -> useReaderArticle runs with the same prefetch key
```

## Implementation

1. Route `fetchMobileApiJson()` through Nitro Fetch and preserve the existing cookie, `Accept`, `credentials: "omit"`, JSON parsing, and `MobileApiError` contract.
2. Add a best-effort GET-only `prefetchMobileApi()` helper with in-flight key deduplication. Prefetch failures are safe diagnostics only and never block UI.
3. Share inbox and reader request path builders so their warmup and query requests use exact matching cache keys.
4. Trigger inbox warmup from the protected route layout and reader warmup from `Item`’s `onPressIn`.
5. Verify the pure cache-key contract, mobile typecheck/lint/format checks, and iOS/Android development builds.

## Out of scope

- Global fetch replacement.
- Native pre-JS authentication handoff, token refresh configuration, or credential duplication.
- Scroll-based prefetching, a second persisted cache, server/API changes, and performance claims without device measurements.
