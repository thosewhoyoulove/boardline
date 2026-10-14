import { Suspense } from "react";
import type { Metadata } from "next";

import { JobArticle, JobArticleFallback } from "@/components/job-article";
import { getJobDetail, listStaticJobIds } from "@/lib/db/queries";

type JobPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateStaticParams() {
  const ids = await listStaticJobIds();
  return ids.map((id) => ({ id }));
}

export async function generateMetadata({ params }: JobPageProps): Promise<Metadata> {
  const { id } = await params;
  const job = await getJobDetail(id);
  if (!job) return { title: "没有这条职位" };
  return {
    title: `${job.title} · ${job.companyName}`,
    description: (job.descriptionText ?? `${job.companyName} 的公开职位`).slice(0, 140),
  };
}

export default function JobPage({ params }: JobPageProps) {
  return (
    <Suspense fallback={<JobArticleFallback />}>
      <JobArticle params={params} />
    </Suspense>
  );
}
