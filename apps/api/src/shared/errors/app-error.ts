export class AppError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    options?: {
      status?: number;
      code?: string;
      details?: Record<string, unknown>;
      cause?: unknown;
    },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.status = options?.status ?? 500;
    this.code = options?.code ?? "INTERNAL_ERROR";
    this.details = options?.details;
  }
}
