import { Suspense } from "react";
import type { Metadata } from "next";

import { JobBoard } from "@/components/job-board";
import { JobListSkeleton } from "@/components/job-skeletons";

export const metadata: Metadata = {
  title: "职位",
  description: "按关键词、公司和地点筛选中国大陆公司的前端与 AI 前端社会招聘。",
};

export default function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<JobListSkeleton />}>
      <JobBoard searchParams={searchParams} />
    </Suspense>
  );
}
