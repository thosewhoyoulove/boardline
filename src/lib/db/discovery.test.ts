import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, unlinkSync, rmdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { getPrisma } from "@/lib/db/client";
import { discoverEmployers } from "@/lib/crawlers/discover";

const directory = mkdtempSync(path.join(os.tmpdir(), "boardline-discovery-"));
const previousUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = `file:${path.join(directory, "test.db").replaceAll("\\", "/")}`;
const prisma = getPrisma();
const realFetch = globalThis.fetch;
let redirect = false;

before(async () => {
  for (const migration of readdirSync("prisma/migrations").filter(name => /^\d/.test(name)).sort()) {
    const sql = readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8");
    for (const statement of sql.split(";").filter(value => value.trim())) await prisma.$executeRawUnsafe(statement);
  }
  globalThis.fetch = async url => {
    if (String(url).includes("jobs.bilibili.com")) return Response.json({code: 0, data: "token"}); // Deliberately broken search response.
    if (String(url).includes("/position/queryPage")) return Response.json({code: 200, data: {list: [{id: 123, name: "前端工程师", workType: "0", requirement: "熟悉 React 与中文需求。", workPlaceNameList: ["杭州"]}], total: 1}});
    const response = new Response("<html>网易招聘</html>");
    Object.defineProperty(response, "url", {value: redirect ? "https://hr.163.com/" : String(url)});
    return response;
  };
});
beforeEach(async () => {
  redirect = false;
  await prisma.job.deleteMany(); await prisma.dataSource.deleteMany(); await prisma.company.deleteMany();
});
after(async () => {
  globalThis.fetch = realFetch;
  await prisma.$disconnect();
  for (const file of readdirSync(directory)) unlinkSync(path.join(directory, file));
  rmdirSync(directory);
  if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
});
test("discovery registers verified jobs once and isolates failed employers", async () => {
  const first = await discoverEmployers();
  assert.equal(first.results[0].status, "added");
  assert.equal(first.results[1].status, "failed");
  assert.equal(await prisma.company.count(), 1);
  assert.equal(await prisma.dataSource.count(), 1);
  assert.equal(await prisma.job.count(), 1);
  assert.equal((await discoverEmployers()).results[0].status, "skipped");
  assert.equal(await prisma.dataSource.count(), 1);
  assert.equal(await prisma.scrapeLease.count(), 0);
});
test("dry run, redirect failure and manual disable never add companies", async () => {
  assert.equal((await discoverEmployers({dryRun: true})).results[0].status, "ready");
  assert.equal(await prisma.company.count(), 0);
  redirect = true;
  assert.equal((await discoverEmployers()).results[0].status, "failed");
  assert.equal(await prisma.company.count(), 0);
  await prisma.company.create({data: {slug: "netease", displayName: "网易", active: false}});
  assert.equal((await discoverEmployers()).results[0].status, "skipped");
  assert.equal(await prisma.job.count(), 0);
});
