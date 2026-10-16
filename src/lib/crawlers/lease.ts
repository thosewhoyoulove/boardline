import { randomUUID } from "node:crypto";
import { getPrisma } from "@/lib/db/client";

const LEASE_ID = "boardline-scrape";
const TTL_MS = 120_000;

/** Database lease prevents overlapping CLI/worker runs, including across hosts. */
export async function withScrapeLease<T>(task: (assertHeld: () => Promise<void>) => Promise<T>): Promise<T> {
  const prisma = getPrisma();
  const owner = randomUUID();
  const expiresAt = () => new Date(Date.now() + TTL_MS);
  const takeover = await prisma.scrapeLease.updateMany({
    where: { id: LEASE_ID, expiresAt: { lte: new Date() } },
    data: { owner, expiresAt: expiresAt() },
  });
  if (takeover.count === 0) {
    try { await prisma.scrapeLease.create({ data: { id: LEASE_ID, owner, expiresAt: expiresAt() } }); }
    catch (error) {
      if ((error as { code?: string }).code === "P2002") throw new Error("已有抓取任务运行，跳过本轮");
      throw error;
    }
  }
  let lost = false;
  let pending = Promise.resolve();
  const timer = setInterval(() => {
    pending = pending.then(async () => {
      const result = await prisma.scrapeLease.updateMany({
        where: { id: LEASE_ID, owner, expiresAt: { gt: new Date() } },
        data: { expiresAt: expiresAt() },
      });
      if (result.count !== 1) lost = true;
    }).catch(() => { lost = true; });
  }, 30_000);
  timer.unref();
  const assertHeld = async () => {
    if (lost || !await prisma.scrapeLease.findFirst({ where: { id: LEASE_ID, owner, expiresAt: { gt: new Date() } } })) {
      throw new Error("抓取锁已失效，停止写入");
    }
  };
  try { return await task(assertHeld); }
  finally {
    clearInterval(timer);
    await pending;
    await prisma.scrapeLease.deleteMany({ where: { id: LEASE_ID, owner } });
  }
}
