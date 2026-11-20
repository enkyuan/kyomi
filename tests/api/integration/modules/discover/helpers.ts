/** A Drizzle select chain that resolves to `rows` however it is filtered, joined or ordered. */
function selectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  for (const step of ["from", "where", "innerJoin", "leftJoin", "orderBy", "limit", "groupBy"]) {
    chain[step] = () => chain;
  }
  chain.then = (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(rows).then(resolve, reject);
  return chain;
}

/** A fake Drizzle `select` that answers its Nth call with the Nth entry of `results`. */
export function selectsReturning(...results: unknown[][]) {
  let calls = 0;
  return {
    select: () => selectChain(results[calls++] ?? []),
    get calls() {
      return calls;
    },
  };
}
