import assert from "node:assert/strict";
import test from "node:test";
import { createPublicClient, retryAfterMs, withCrawlSettings } from "@/lib/crawlers/public-json";
import { readCrawlSettings } from "@/lib/crawlers/settings";

function clock() {
  let time = 0;
  const waits: number[] = [];
  return { now: () => time, random: () => 0, waits, sleep: async (ms: number) => { waits.push(ms); time += ms; } };
}

test("same-origin requests are serial and respect minimum spacing", async () => {
  const time = clock();
  const starts: number[] = [];
  const client = createPublicClient({ ...time, fetch: async () => { starts.push(time.now()); return Response.json({ ok: true }); } });
  await Promise.all([client.fetchJson("https://careers.example/list"), client.fetchJson("https://careers.example/detail")]);
  assert.deepEqual(starts, [0, 1000]);
});

test("429 respects Retry-After, retains POST body and headers on retry", async () => {
  const time = clock();
  const bodies: unknown[] = [];
  let calls = 0;
  const client = createPublicClient({ ...time, fetch: async (_url, init) => {
    bodies.push(init?.body);
    assert.equal(new Headers(init?.headers).get("x-csrf-token"), "test-token");
    return ++calls === 1 ? new Response("limited", { status: 429, headers: { "retry-after": "3" } }) : Response.json({ jobs: [] });
  } });
  await client.fetchJson("https://careers.example/search", { method: "POST", body: "{}", headers: { "x-csrf-token": "test-token" } });
  assert.deepEqual(time.waits, [3000]);
  assert.deepEqual(bodies, ["{}", "{}"]);
});

test("long Retry-After stops the source without retrying early", async () => {
  const time = clock();
  let calls = 0;
  const client = createPublicClient({ ...time, fetch: async () => { calls += 1; return new Response(null, { status: 429, headers: { "retry-after": "600" } }); } });
  await assert.rejects(client.fetchJson("https://careers.example/list"), /Retry-After/);
  await assert.rejects(client.fetchJson("https://careers.example/list"), /冷却/);
  assert.equal(calls, 1);
});

test("network retries are bounded; permanent errors are not retried", async () => {
  for (const status of [403, 503, 0]) {
    let calls = 0;
    const client = createPublicClient({ ...clock(), fetch: async () => {
      calls += 1;
      if (status === 0) throw new Error("connection refused");
      return new Response(null, { status });
    } });
    await assert.rejects(client.fetchJson("https://careers.example/list"));
    assert.equal(calls, status === 403 ? 1 : 3);
  }
});

test("source-specific request policy applies inside its context", async () => {
  const time = clock();
  const client = createPublicClient({ ...time, fetch: async () => Response.json({}) });
  await withCrawlSettings(readCrawlSettings({ requestDelayMs: 250 }), async () => {
    await client.fetchJson("https://careers.example/list");
    await client.fetchJson("https://careers.example/list");
  });
  assert.deepEqual(time.waits, [250]);
  assert.equal(retryAfterMs("Wed, 21 Oct 2015 07:28:00 GMT", Date.parse("2015-10-21T07:27:59Z")), 1000);
  assert.equal(retryAfterMs("bad"), null);
});
