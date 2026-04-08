declare module "pg" {
  export class Pool {
    constructor(config: { connectionString: string });
    end(): Promise<void>;
  }
}
