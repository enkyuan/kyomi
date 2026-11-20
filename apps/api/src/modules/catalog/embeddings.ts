import { Context, Effect, Layer } from "effect";
import { classifyFeedEmbedding, classifyItemEmbeddings, embedItemVectors } from "@kyomi/ingest";
import { UpstreamError } from "@shared/effect/errors";

type FeedInput = Parameters<typeof classifyFeedEmbedding>[0];
type ItemInputs = Parameters<typeof classifyItemEmbeddings>[0];
type VectorInputs = Parameters<typeof embedItemVectors>[0];
type Config = Parameters<typeof classifyFeedEmbedding>[1];

/**
 * The embeddings Worker as a service. `@kyomi/ingest` calls it with the global `fetch`, so this is
 * the seam: operator scripts depend on `Embeddings`, tests provide a fake Layer, and every
 * failure arrives as a typed `UpstreamError`.
 */
export type EmbeddingsShape = {
  readonly classifyFeed: (
    input: FeedInput,
    config: Config,
  ) => Effect.Effect<Awaited<ReturnType<typeof classifyFeedEmbedding>>, UpstreamError>;
  /** Classifies items in bounded requests; items in a failed request are absent from the map. */
  readonly classifyItems: (
    inputs: ItemInputs,
    config: Config,
  ) => Effect.Effect<Awaited<ReturnType<typeof classifyItemEmbeddings>>, UpstreamError>;
  /** One vector per article id; articles in a failed request are absent from the map. */
  readonly embedItems: (
    inputs: VectorInputs,
    config: Config,
  ) => Effect.Effect<Awaited<ReturnType<typeof embedItemVectors>>, UpstreamError>;
};

const upstream = (operation: string) => (cause: unknown) => new UpstreamError({ operation, cause });

export class Embeddings extends Context.Service<Embeddings, EmbeddingsShape>()("kyomi/Embeddings") {
  static readonly layer = Layer.succeed(
    Embeddings,
    Embeddings.of({
      classifyFeed: (input, config) =>
        Effect.tryPromise({
          try: () => classifyFeedEmbedding(input, config),
          catch: upstream("embeddings.classifyFeed"),
        }),
      classifyItems: (inputs, config) =>
        Effect.tryPromise({
          try: () => classifyItemEmbeddings(inputs, config),
          catch: upstream("embeddings.classifyItems"),
        }),
      embedItems: (inputs, config) =>
        Effect.tryPromise({
          try: () => embedItemVectors(inputs, config),
          catch: upstream("embeddings.embedItems"),
        }),
    }),
  );
}
