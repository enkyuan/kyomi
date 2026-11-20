import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { Clock, Context, Effect, Layer } from "effect";
import { imageAssets } from "@kyomi/db";
import { AppConfig } from "@config/env/service";
import { Db } from "@adapters/db/service";
import { AppLogger } from "@adapters/logger/service";

type Asset = { contentType: string; bytes: Uint8Array<ArrayBuffer> };
type Validators = { etag: string | null; lastModified: string | null };
type AssetStore = {
  get: (source: string, limit: number) => Effect.Effect<(Asset & { ttl: number }) | null>;
  put: (source: string, asset: Asset, ttl: number, validators: Validators) => Effect.Effect<void>;
};
const disabled: AssetStore = { get: () => Effect.succeed(null), put: () => Effect.void };
export const Assets = Context.Reference<AssetStore>("kyomi/Assets", {
  defaultValue: () => disabled,
});
const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

export const GarageAssets = Layer.effect(
  Assets,
  Effect.gen(function* () {
    const config = yield* AppConfig;
    if (!config.GARAGE_S3_ENDPOINT) return disabled;
    const db = yield* Db;
    const log = yield* AppLogger;
    const s3 = new Bun.S3Client({
      endpoint: config.GARAGE_S3_ENDPOINT,
      region: "garage",
      bucket: config.GARAGE_S3_BUCKET,
      accessKeyId: config.GARAGE_S3_ACCESS_KEY,
      secretAccessKey: config.GARAGE_S3_SECRET_KEY,
      virtualHostedStyle: false,
    });
    const get: AssetStore["get"] = (source, limit) =>
      Effect.gen(function* () {
        const [row] = yield* db.use("assets.lookup", (client) =>
          client
            .select()
            .from(imageAssets)
            .where(eq(imageAssets.sourceKey, digest(source)))
            .limit(1),
        );
        const now = yield* Clock.currentTimeMillis;
        if (!row || row.expiresAt.getTime() <= now || row.size > limit || row.size < 1) return null;
        const bytes = yield* Effect.tryPromise(
          async () => new Uint8Array(await s3.file(row.objectKey).slice(0, row.size).arrayBuffer()),
        );
        if (bytes.length !== row.size || `sha256/${digest(bytes)}` !== row.objectKey) return null;
        return {
          contentType: row.contentType,
          bytes,
          ttl: Math.max(0, Math.floor((row.expiresAt.getTime() - now) / 1000)),
        };
      }).pipe(
        Effect.timeout("750 millis"),
        Effect.catch(() => log.warn("assets.read_failed").pipe(Effect.as(null))),
      );
    const put: AssetStore["put"] = (source, asset, ttl, validators) =>
      Effect.gen(function* () {
        if (ttl <= 0 || !asset.bytes.length) return;
        const objectKey = `sha256/${digest(asset.bytes)}`;
        const started = yield* Clock.currentTimeMillis;
        yield* Effect.tryPromise(() =>
          s3.file(objectKey).write(asset.bytes, { type: asset.contentType }),
        );
        const metadata = {
          objectKey,
          contentType: asset.contentType,
          size: asset.bytes.length,
          etag: validators.etag,
          lastModified: validators.lastModified,
          expiresAt: new Date(started + ttl * 1000),
        };
        yield* db.use("assets.store", (client) =>
          client
            .insert(imageAssets)
            .values({ sourceKey: digest(source), ...metadata })
            .onConflictDoUpdate({ target: imageAssets.sourceKey, set: metadata }),
        );
      }).pipe(
        Effect.timeout("750 millis"),
        Effect.catch(() => log.warn("assets.write_failed")),
      );
    return { get, put };
  }),
);
