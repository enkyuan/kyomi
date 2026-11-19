export type DeadLetterItem = {
  id: string;
  type: string;
  attempts: number;
  error: string | null;
  failedAt: string | null;
  originalStreamId: string | null;
  payload: string;
};
