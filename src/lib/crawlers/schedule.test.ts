import assert from "node:assert/strict";
import test from "node:test";
import { nextScrapeDelay, readScrapeArguments } from "@/lib/crawlers/schedule";

test("scheduler validates intervals and refuses repeated fixture imports", () => {
  assert.equal(readScrapeArguments([]).intervalMs, 360 * 60_000);
  assert.deepEqual(readScrapeArguments(["--company", "meituan,tencent"]).companies, ["meituan", "tencent"]);
  assert.equal(readScrapeArguments(["--watch", "--interval-minutes", "60"]).watch, true);
  for (const args of [["--interval-minutes", "0"], ["--interval-minutes"], ["--watch", "--offline"], ["--company", ""], ["--unknown"]]) {
    assert.throws(() => readScrapeArguments(args));
  }
});

test("long-running jobs skip missed slots instead of immediately catching up", () => {
  assert.equal(nextScrapeDelay(0, 20, 100), 80);
  assert.equal(nextScrapeDelay(0, 220, 100), 80);
  assert.equal(nextScrapeDelay(0, 200, 100), 100);
});
