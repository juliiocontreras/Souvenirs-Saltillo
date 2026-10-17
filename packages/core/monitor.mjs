export const REVIEW_INTERVAL = 4 * 60 * 60 * 1000;

export function monitorRunSummary(run) {
  return {
    status: run.status,
    checked: run.checked || 0,
    remaining: run.remaining || 0,
    added: run.added || 0,
    issues: run.issues?.length || 0,
    searches: run.search?.length || 0,
  };
}

export function webMonitorOptions(env = process.env) {
  return env.MONITOR_WEB_MODE === "light"
    ? {
        batchSize: 1,
        search: async () => ({ status: "scheduled", urls: [] }),
      }
    : {};
}
// GitHub workflow: minute 17 of each UTC hour divisible by four.
export function nextReviewAt(now = Date.now()) {
  return new Date(
    (Math.floor((now - 17 * 60000) / REVIEW_INTERVAL) + 1) * REVIEW_INTERVAL +
      17 * 60000,
  ).toISOString();
}
export function classifySupplierCheck(observed, previousPrice) {
  if (!observed?.ok)
    return { status: observed?.status || "broken", observedPrice: null };
  const price =
    observed.price === null || observed.price === undefined
      ? null
      : Number(observed.price);
  if (price === null || !Number.isFinite(price))
    return { status: "incomplete", observedPrice: null };
  if (
    previousPrice !== null &&
    previousPrice !== undefined &&
    Number.isFinite(Number(previousPrice)) &&
    price !== Number(previousPrice)
  )
    return { status: "changed", observedPrice: price };
  return { status: "ok", observedPrice: price };
}
