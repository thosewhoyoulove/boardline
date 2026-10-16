import assert from "node:assert/strict";
import test from "node:test";
import { collectPages, type Page } from "@/lib/crawlers/pagination";

const identify = (item: unknown) => (item as { id: string }).id;
const page = (...ids: string[]): Page => ({ items: ids.map((id) => ({ id })) });

test("continues after short pages and reconciles only after exhaustion", async () => {
  const requested: number[] = [];
  const result = await collectPages({ maxPages: 5, identify, fetchPage: async (index) => {
    requested.push(index);
    return [page("a"), page("b"), page()][index - 1];
  } });
  assert.deepEqual(requested, [1, 2, 3]);
  assert.equal(result.complete, true);
  assert.equal(result.items.length, 2);
});

test("page cap, repeated pages and later failure retain partial results", async () => {
  for (const mode of ["cap", "repeat", "fail"]) {
    const result = await collectPages({ maxPages: mode === "cap" ? 1 : 5, identify, fetchPage: async (index) => {
      if (mode === "fail" && index === 2) throw new Error("timeout");
      return page("a");
    } });
    assert.equal(result.complete, false, mode);
    assert.equal(result.items.length, 1, mode);
  }
});

test("overlapping pages cannot authorize removals even after reaching the end", async () => {
  const result = await collectPages({ maxPages: 5, identify, fetchPage: async (index) => [page("a"), page("a", "b"), page()][index - 1] });
  assert.equal(result.complete, false);
  assert.equal(result.items.length, 2);
});

test("inconsistent totals and unexplained empty first page are non-authoritative", async () => {
  const empty = await collectPages({ maxPages: 5, identify, fetchPage: async () => page() });
  assert.equal(empty.complete, false);
  const changed = await collectPages({ maxPages: 5, identify, fetchPage: async (index) => index === 1
    ? { ...page("a"), total: 3 } : { ...page("b"), total: 2 } });
  assert.equal(changed.complete, false);
  await assert.rejects(collectPages({ maxPages: 5, identify, fetchPage: async () => { throw new Error("offline"); } }), /offline/);
});

test("missing IDs preserve valid rows but disallow reconciliation", async () => {
  const result = await collectPages({ maxPages: 5, identify, fetchPage: async (index) => index === 1
    ? { items: [{ id: "a" }, {}] } : page() });
  assert.equal(result.complete, false);
  assert.equal(result.items.length, 1);
});
