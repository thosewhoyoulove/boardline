import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, unlinkSync, rmdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { withScrapeLease } from "@/lib/crawlers/lease";
import { getPrisma } from "@/lib/db/client";
import { ensureDemoCompanies } from "@/lib/db/seed";
import { upsertNormalizedJobs } from "@/lib/db/upsert";
import { normalizeMeituanJobs } from "@/lib/crawlers/meituan_api";
import { runScrape } from "@/lib/crawlers/run";

const directory = mkdtempSync(path.join(os.tmpdir(), "boardline-test-"));
const oldUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = `file:${path.join(directory, "test.db").replaceAll("\\", "/")}`;
const prisma = getPrisma();

before(async () => {
  for (const migration of readdirSync("prisma/migrations").filter((name) => /^\d/.test(name)).sort()) {
    const sql = readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8");
    for (const statement of sql.split(";").filter((value) => value.trim())) await prisma.$executeRawUnsafe(statement);
  }
});

beforeEach(async () => {
  await prisma.job.deleteMany();
  await prisma.dataSource.deleteMany();
  await prisma.company.deleteMany();
  await prisma.scrapeLease.deleteMany();
});

after(async () => {
  await prisma.$disconnect();
  for (const file of readdirSync(directory)) unlinkSync(path.join(directory, file));
  rmdirSync(directory);
  if (oldUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = oldUrl;
});

test("seeding preserves manual disable switches and custom source configuration", async () => {
  await ensureDemoCompanies();
  const company = await prisma.company.update({ where: { slug: "meituan" }, data: { active: false } });
  const source = await prisma.dataSource.findFirstOrThrow({ where: { companyId: company.id } });
  await prisma.dataSource.update({ where: { id: source.id }, data: { isActive: false, config: { pageSize: 5, maxPages: 2 } } });
  await ensureDemoCompanies();
  assert.equal((await prisma.company.findUniqueOrThrow({ where: { id: company.id } })).active, false);
  const preserved = await prisma.dataSource.findUniqueOrThrow({ where: { id: source.id } });
  assert.equal(preserved.isActive, false);
  assert.deepEqual(preserved.config, { pageSize: 5, maxPages: 2 });
});

test("partial/empty scans never deactivate; full scans respect missing-job grace period", async () => {
  const company = await prisma.company.create({ data: { slug: "test", displayName: "Test" } });
  const source = await prisma.dataSource.create({ data: { companyId: company.id, sourceType: "meituan_api", recruitmentType: "social", config: {} } });
  const makeJob = (id: string) => normalizeMeituanJobs([{ jobUnionId: id, name: "前端工程师", jobRequirement: "熟悉 React，能阅读中文需求。" }])[0];
  const live = makeJob("live"), stale = makeJob("stale"), recent = makeJob("recent");
  const input = { companyId: company.id, sourceId: source.id };
  await upsertNormalizedJobs({ ...input, jobs: [live, stale, recent], authoritative: false });
  await prisma.job.update({ where: { uniqueKey: stale.uniqueKey }, data: { lastSeenAt: new Date(Date.now() - 72 * 3600_000) } });
  await prisma.job.update({ where: { uniqueKey: recent.uniqueKey }, data: { lastSeenAt: new Date(Date.now() - 3600_000) } });
  assert.equal((await upsertNormalizedJobs({ ...input, jobs: [live], authoritative: false })).deactivated, 0);
  assert.equal((await upsertNormalizedJobs({ ...input, jobs: [], authoritative: true })).deactivated, 0);
  assert.equal((await upsertNormalizedJobs({ ...input, jobs: [live], authoritative: true })).deactivated, 1);
  assert.equal((await prisma.job.findUniqueOrThrow({ where: { uniqueKey: stale.uniqueKey } })).isActive, false);
  assert.equal((await prisma.job.findUniqueOrThrow({ where: { uniqueKey: recent.uniqueKey } })).isActive, true);
  const firstSeen = (await prisma.job.findUniqueOrThrow({ where: { uniqueKey: stale.uniqueKey } })).firstSeenAt;
  await upsertNormalizedJobs({ ...input, jobs: [stale], authoritative: false });
  const returned = await prisma.job.findUniqueOrThrow({ where: { uniqueKey: stale.uniqueKey } });
  assert.equal(returned.isActive, true);
  assert.equal(returned.firstSeenAt.getTime(), firstSeen.getTime());
  const refreshedDate = new Date("2026-10-15T00:00:00Z");
  await upsertNormalizedJobs({ ...input, jobs: [{ ...live, publishTime: refreshedDate }], authoritative: false });
  assert.equal((await prisma.job.findUniqueOrThrow({ where: { uniqueKey: live.uniqueKey } })).publishTime?.getTime(), refreshedDate.getTime());
});

test("database lease blocks concurrent runs, releases after failure and recovers expired locks", async () => {
  await withScrapeLease(async (assertHeld) => {
    await assertHeld();
    await assert.rejects(withScrapeLease(async () => {}), /已有抓取任务/);
  });
  assert.equal(await prisma.scrapeLease.count(), 0);
  await assert.rejects(withScrapeLease(async () => { throw new Error("failed"); }), /failed/);
  assert.equal(await prisma.scrapeLease.count(), 0);
  await prisma.scrapeLease.create({ data: { id: "boardline-scrape", owner: "expired", expiresAt: new Date(0) } });
  await withScrapeLease(async (assertHeld) => { await assertHeld(); });
  assert.equal(await prisma.scrapeLease.count(), 0);
});

test("offline scrape runs end-to-end and identifies fixture results", async () => {
  const report = await runScrape({ offline: true });
  assert.equal(report.ok, true);
  assert.equal(report.results.length, 8);
  assert.equal(await prisma.job.count(), 8);
  assert.ok(report.results.every((result) => result.status === "fixture" && !result.authoritative && result.deactivated === 0));
});
