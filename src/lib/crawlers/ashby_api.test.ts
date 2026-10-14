import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeAshbyPayload } from "@/lib/crawlers/ashby_api";

test("normalizes the committed Linear Ashby fixture", () => {
  const payload = JSON.parse(readFileSync("fixtures/ashby/linear.sample.json", "utf8")) as unknown;
  const jobs = normalizeAshbyPayload(payload, "linear");

  assert.ok(jobs.length >= 2);
  const first = jobs[0];
  assert.match(first.uniqueKey, /^ashby_api:linear:/);
  assert.match(first.officialUrl, /^https:\/\/jobs\.ashbyhq\.com\/linear\//);
  assert.equal(first.officialUrl.endsWith("/application") || first.officialUrl.includes("/linear/"), true);
  assert.ok(first.locations.length > 0);
  assert.equal(first.descriptionHtml?.includes("<script"), false);
  assert.equal(first.descriptionHtml?.includes("onerror"), false);
  assert.ok(first.contentHash.length === 64);
});

test("rejects a payload that cannot be normalized", () => {
  assert.throws(() =>
    normalizeAshbyPayload(
      {
        jobs: [{ id: "x", title: "Missing URL", descriptionHtml: "<p>Hi</p>" }],
      },
      "linear",
    ),
  );
});

test("skips unlisted postings", () => {
  const jobs = normalizeAshbyPayload(
    {
      jobs: [
        {
          id: "hidden",
          title: "Hidden",
          isListed: false,
          applyUrl: "https://jobs.ashbyhq.com/linear/hidden/application",
        },
        {
          id: "open",
          title: "Open Role",
          isListed: true,
          location: "Remote",
          applyUrl: "https://jobs.ashbyhq.com/linear/open/application",
          descriptionHtml: "<p>Hello</p><script>alert(1)</script>",
        },
      ],
    },
    "linear",
  );

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, "Open Role");
  assert.equal(jobs[0].descriptionHtml?.includes("script"), false);
  assert.match(jobs[0].descriptionHtml ?? "", /Hello/);
});
