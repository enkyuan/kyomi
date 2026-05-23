export type ErrorResponseDto = {
  error: {
    message: string;
    code: string;
    requestId?: string;
    details?: Record<string, unknown>;
  };
};
