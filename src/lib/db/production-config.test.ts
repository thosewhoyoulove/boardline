import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("SQLite and PostgreSQL use the same data models", () => {
  const models = (file: string) => {
    const schema = readFileSync(file, "utf8");
    return schema.slice(schema.indexOf("model ScrapeLease")).replaceAll("\r\n", "\n");
  };
  assert.equal(models("prisma/schema.prisma"), models("prisma/postgres/schema.prisma"));
});

test("production builds reject SQLite before running migrations", () => {
  const result = spawnSync(process.execPath, ["scripts/build-production.mjs"], {
    env: { ...process.env, DATABASE_URL: "file:./dev.db" },
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /persistent PostgreSQL DATABASE_URL/);
});
