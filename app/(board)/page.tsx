import type { Metadata } from "next";

import { JobBoard } from "@/components/job-board";
import { getPublishedBoard } from "@/lib/db/queries";

export const metadata: Metadata = {
  title: "职位",
  description: "按关键词、公司和地点筛选中国大陆公司的前端与 AI 前端社会招聘。",
};

export default async function HomePage() {
  const board = await getPublishedBoard();
  return <JobBoard jobs={board.jobs} companies={board.companies} />;
}
