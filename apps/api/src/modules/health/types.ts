export type HealthPayload = {
  status: "ok";
  service: string;
  now: string;
  /** Semver from `apps/api/package.json` at process start. */
  version: string;
};

export type ReadinessPayload = {
  ready: boolean;
  service: string;
  now: string;
  version: string;
};

export type QueueHealthSnapshot = {
  streams: Record<
    string,
    {
      length: number;
      /** Read by a consumer and not yet acknowledged. */
      pending: number;
      /** Failed jobs waiting out their retry delay; they are on neither the stream nor pending. */
      scheduled: number;
    }
  >;
};
