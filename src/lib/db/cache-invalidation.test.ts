import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { authorizeRevalidate, bearerToken, secretsMatch } from "@/lib/revalidate-auth";

test("bearer token accepts only a single token after Bearer", () => {
  assert.equal(bearerToken("Bearer scrape-secret"), "scrape-secret");
  assert.equal(bearerToken("bearer scrape-secret"), "scrape-secret");
  assert.equal(bearerToken("Bearer   scrape-secret  "), "scrape-secret");
  assert.equal(bearerToken("Basic scrape-secret"), null);
  assert.equal(bearerToken(null), null);
  assert.equal(bearerToken("Bearer"), null);
});

test("secret comparison matches equal values and rejects lookalikes", () => {
  assert.equal(secretsMatch("same-secret", "same-secret"), true);
  assert.equal(secretsMatch("same-secret", "same-secret-longer"), false);
  assert.equal(secretsMatch("same-secret", "same-secreT"), false);
  assert.equal(secretsMatch("", "same-secret"), false);
});

test("revalidate authorization fails closed", () => {
  assert.deepEqual(authorizeRevalidate("Bearer right", undefined), { ok: false, status: 503 });
  assert.deepEqual(authorizeRevalidate("Bearer right", ""), { ok: false, status: 503 });
  assert.deepEqual(authorizeRevalidate(null, "right"), { ok: false, status: 401 });
  assert.deepEqual(authorizeRevalidate("Bearer wrong", "right"), { ok: false, status: 401 });
  assert.deepEqual(authorizeRevalidate(`Bearer ${"x".repeat(513)}`, "right"), { ok: false, status: 401 });
  assert.deepEqual(authorizeRevalidate("Bearer right", "right"), { ok: true });
});

test("published board caches share one on-demand tag", () => {
  const queries = readFileSync("src/lib/db/queries.ts", "utf8");
  const layout = readFileSync("app/(board)/layout.tsx", "utf8");
  const invalidate = readFileSync("src/lib/db/invalidate-board.ts", "utf8");
  const route = readFileSync("app/api/revalidate/route.ts", "utf8");
  const scrape = readFileSync(".github/workflows/scrape.yml", "utf8");
  const discover = readFileSync(".github/workflows/discover-employers.yml", "utf8");

  assert.equal(queries.match(/"use cache"/g)?.length, 3);
  assert.equal(queries.match(/cacheTag\(PUBLISHED_JOBS_CACHE_TAG\)/g)?.length, 3);
  assert.match(layout, /cacheTag\(PUBLISHED_JOBS_CACHE_TAG\)/);
  assert.match(invalidate, /revalidateTag\(PUBLISHED_JOBS_CACHE_TAG, \{ expire: 0 \}\)/);
  assert.match(invalidate, /revalidatePath\("\/", "layout"\)/);
  assert.match(invalidate, /revalidatePath\("\/"\)/);
  assert.match(invalidate, /revalidatePath\("\/companies"\)/);
  assert.match(invalidate, /revalidatePath\("\/jobs\/\[id\]", "page"\)/);
  assert.match(route, /authorizeRevalidate/);
  assert.match(route, /invalidatePublishedBoardCache/);
  assert.match(scrape, /scripts\/revalidate-production\.sh/);
  assert.match(scrape, /secrets\.REVALIDATE_SECRET/);
  assert.match(discover, /scripts\/revalidate-production\.sh/);
});

test("revalidate script refuses to run without a secret", () => {
  const result = spawnSync("bash", ["scripts/revalidate-production.sh"], {
    env: { ...process.env, REVALIDATE_SECRET: "" },
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /REVALIDATE_SECRET/);
});

test("revalidate script POSTs the bearer secret and does not print it", async () => {
  const secret = "test-secret-value";
  const seen: { method?: string; authorization?: string | undefined } = {};
  const server = createServer((req, res) => {
    seen.method = req.method;
    seen.authorization = req.headers.authorization;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ revalidated: true }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("expected a TCP port");

  try {
    const result = await new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn("bash", ["scripts/revalidate-production.sh"], {
        env: {
          ...process.env,
          REVALIDATE_SECRET: secret,
          REVALIDATE_URL: `http://127.0.0.1:${address.port}/api/revalidate`,
        },
      });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("error", reject);
      child.on("close", (status) => resolve({ status, stdout, stderr }));
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(seen.method, "POST");
    assert.equal(seen.authorization, `Bearer ${secret}`);
    assert.equal(result.stdout.includes(secret), false);
    assert.match(result.stdout, /"revalidated":true/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
