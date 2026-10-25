// The Worker only dispatches work. Extraction, Tavily quotas and leases live in
// the store's existing backend. No database, customer or supplier data is copied.
const MAX_REQUESTS = 24;
const MAX_TIME = 14 * 60_000;
const REQUEST_TIMEOUT = 120_000;
const RESPONSE_LIMIT = 8192;
const RETRYABLE = new Set([409, 429, 502, 503, 504]);

function configuration(env) {
  const url = new URL(env.MONITOR_URL);
  if (url.protocol !== "https:" || url.username || url.password || url.search ||
      url.hash || url.pathname !== "/api/supplier/monitor") {
    throw new Error("Invalid monitor configuration");
  }
  if (typeof env.MONITOR_SECRET !== "string" || env.MONITOR_SECRET.length < 32) {
    throw new Error("Missing monitor secret");
  }
  return url.href;
}

async function readSummary(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing monitor response");
  const decoder = new TextDecoder();
  let text = "", size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > RESPONSE_LIMIT) throw new Error("Monitor response too large");
      text += decoder.decode(value, { stream: true });
    }
    const result = JSON.parse(text + decoder.decode());
    if (result.status !== "completed" ||
        ![result.checked, result.remaining, result.added].every(v => Number.isSafeInteger(v) && v >= 0)) {
      throw new Error("Invalid monitor result");
    }
    return { checked: result.checked, remaining: result.remaining, added: result.added };
  } finally {
    await reader.cancel().catch(() => {});
  }
}

export async function dispatchMonitor(env, {
  fetcher = fetch,
  now = Date.now,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  const url = configuration(env), deadline = now() + MAX_TIME;
  let failures = 0;
  const total = { status: "incomplete", checked: 0, added: 0, remaining: null, requests: 0 };
  for (let index = 0; index < MAX_REQUESTS && now() < deadline; index++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(REQUEST_TIMEOUT, deadline - now()));
    let retry = false;
    try {
      total.requests++;
      const response = await fetcher(url, {
        method: "POST", redirect: "error", signal: controller.signal,
        headers: { Authorization: `Bearer ${env.MONITOR_SECRET}` },
      });
      if (RETRYABLE.has(response.status)) {
        await response.body?.cancel();
        retry = true;
      } else if (!response.ok) {
        await response.body?.cancel();
        // Never retry authentication, redirects or configuration errors.
        throw new Error("Monitor request rejected");
      } else {
        const result = await readSummary(response);
        total.checked += result.checked;
        total.added += result.added;
        total.remaining = result.remaining;
        failures = 0;
        if (!result.remaining) return { ...total, status: "completed" };
        if (!result.checked) return total; // no progress: do not spin
      }
    } catch (error) {
      // Network/timeout retries are bounded. Do not log upstream errors: they
      // can contain credentials, private URLs or untrusted supplier content.
      if (error.name === "AbortError" || error instanceof TypeError) retry = true;
      else throw new Error("Monitor execution failed");
    } finally {
      clearTimeout(timer);
    }
    if (retry) {
      if (++failures > 2 || now() + 20_000 >= deadline) return total;
      await sleep(20_000);
    }
  }
  return total;
}

function authorized(request, env) {
  const secret = env.MONITOR_SECRET;
  if (typeof secret !== "string" || secret.length < 32) return false;
  const expected = `Bearer ${secret}`, actual = request.headers.get("Authorization") || "";
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

export default {
  async scheduled(_event, env) {
    const result = await dispatchMonitor(env);
    console.log(JSON.stringify(result));
    if (result.status !== "completed") throw new Error("Supplier monitor has pending work");
  },
  async fetch(request, env) {
    // Authenticated manual validation uses exactly the same dispatch path as cron.
    if (new URL(request.url).pathname !== "/run" || request.method !== "POST")
      return new Response("Not found", { status: 404 });
    if (!authorized(request, env)) return new Response("Unauthorized", { status: 401 });
    try {
      const result = await dispatchMonitor(env);
      return Response.json(result, {
        status: result.status === "completed" ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
      });
    } catch {
      return Response.json({ status: "failed" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  },
};
