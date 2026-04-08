export function createRequestId() {
  return crypto.randomUUID();
}

export function createActionId() {
  return `act_${crypto.randomUUID()}`;
}
