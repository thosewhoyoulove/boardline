import { Suspense } from "react";
import type { Metadata } from "next";

import { JobBoard, JobBoardFallback } from "@/components/job-board";

export const metadata: Metadata = {
  title: "职位",
  description: "按关键词、公司和地点筛选公开招聘职位。",
};

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-16 sm:px-6 sm:pt-10">
      <header className="mb-8 max-w-2xl">
        <p className="text-xs tracking-[0.18em] text-primary uppercase">公开职位板</p>
        <h1 className="mt-2 font-display text-4xl leading-tight tracking-tight sm:text-5xl">正在公开招聘的职位</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          数据来自公司自己的公开招聘接口。打开一条职位，申请按钮只指向官方页面。
        </p>
      </header>
      <Suspense fallback={<JobBoardFallback />}>
        <JobBoard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
