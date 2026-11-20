const UUID = "9b0f2f26-6d1e-4c36-9d56-0a1c3a8b7e11";

// Each of these re-targets a request when interpolated into `/api/v1/articles/<id>/view`.
export const PATH_ATTACKS = [
  "../auth/sign-out?",
  "..",
  ".",
  "%2e%2e",
  "%2E%2E%2Fauth",
  "../../x",
  "a/b",
  "a?b=1",
  "a#b",
  "a\\b",
  "a b",
  `${UUID}/../../auth/sign-out`,
  `${UUID}?x`,
  `${UUID}#x`,
  `${UUID}\n`,
  ` ${UUID}`,
  "",
  "a".repeat(129),
  null,
  undefined,
  42,
  {},
  [UUID],
];
