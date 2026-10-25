import test from "node:test";
import assert from "node:assert/strict";
import worker, { dispatchMonitor } from "../ops/cloudflare-monitor/worker.mjs";
const env = { MONITOR_URL: "https://store.example/api/supplier/monitor", MONITOR_SECRET: "s".repeat(48) };
const completed = (remaining = 0, checked = 1) => Response.json({ status: "completed", checked, remaining, added: 0, privateCanary: "PRIVATE" });

test("scheduler drains pending batches and emits only counters", async () => {
  let calls = 0;
  const result = await dispatchMonitor(env, { fetcher: async (url, options) => {
    assert.equal(url, env.MONITOR_URL);
    assert.equal(options.headers.Authorization, `Bearer ${env.MONITOR_SECRET}`);
    assert.equal(options.redirect, "error");
    assert.equal(options.method, "POST");
    return completed(++calls < 3 ? 3 - calls : 0);
  }});
  assert.deepEqual(result, { status: "completed", checked: 3, added: 0, remaining: 0, requests: 3 });
  assert.ok(!JSON.stringify(result).includes("PRIVATE"));
});

test("scheduler tolerates cold-start failure but bounds retries and requests", async () => {
  let calls = 0, waits = 0;
  const result = await dispatchMonitor(env, { fetcher: async () => ++calls < 3 ? new Response("private", { status: 503 }) : completed(), sleep: async () => waits++ });
  assert.equal(result.status, "completed");assert.equal(waits, 2);
  calls = 0;
  const unavailable = await dispatchMonitor(env, { fetcher: async () => {calls++;return new Response(null,{status:409});}, sleep:async()=>{} });
  assert.equal(calls, 3);assert.equal(unavailable.status, "incomplete");
  const backlog = await dispatchMonitor(env, { fetcher:async()=>completed(100) });
  assert.equal(backlog.requests, 24);assert.equal(backlog.status, "incomplete");
});

test("scheduler stops on no progress, budget exhaustion and invalid counters", async () => {
  const stalled = await dispatchMonitor(env, {fetcher:async()=>completed(5,0)});
  assert.equal(stalled.requests,1);assert.equal(stalled.status,"incomplete");
  let clock=0;
  const timed = await dispatchMonitor(env, {now:()=>clock,fetcher:async()=>{clock=14*60_000;return completed(2);}});
  assert.equal(timed.requests,1);assert.equal(timed.status,"incomplete");
  await assert.rejects(dispatchMonitor(env,{fetcher:async()=>Response.json({status:'completed',checked:1,remaining:-1,added:0})}), /execution failed/);
});

test("scheduler fails closed on auth, redirect, oversized and malformed responses", async () => {
  for (const response of [new Response(null,{status:401}),new Response(null,{status:302,headers:{Location:'https://elsewhere.example'}}),new Response('x'.repeat(9000)),new Response('not json')]) {
    let calls=0;
    await assert.rejects(dispatchMonitor(env,{fetcher:async()=>{calls++;return response;}}), /execution failed/);
    assert.equal(calls,1);
  }
  for (const url of ['http://store.example/api/supplier/monitor','https://user:password@store.example/api/supplier/monitor','https://store.example/api/supplier/monitor?key=secret','https://store.example/wrong']) {
    await assert.rejects(dispatchMonitor({...env,MONITOR_URL:url}), /configuration/);
  }
  await assert.rejects(dispatchMonitor({...env,MONITOR_SECRET:''}), /secret/);
});

test("manual entrypoint is closed without the secret and cannot expose environment", async () => {
  for (const [path,method,status] of [['/','GET',404],['/run','GET',404],['/run','POST',401]]) {
    const response=await worker.fetch(new Request('https://worker.example'+path,{method}),env);
    assert.equal(response.status,status);assert.ok(!(await response.text()).includes(env.MONITOR_SECRET));
  }
});
