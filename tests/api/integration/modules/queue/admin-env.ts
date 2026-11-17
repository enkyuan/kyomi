// Imported first by the route test: the feed-admin guard reads the validated env singleton, which
// is built the first time any module imports `@config/env`.
process.env.FEED_ADMIN_SHARED_SECRET = "queue-test-secret";
