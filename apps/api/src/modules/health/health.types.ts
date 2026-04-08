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
