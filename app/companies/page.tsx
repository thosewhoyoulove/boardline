import { Suspense } from "react";
import type { Metadata } from "next";

import { CompanyDirectory, CompanyDirectoryFallback } from "@/components/company-directory";

export const metadata: Metadata = {
  title: "公司",
  description: "已接入公开招聘接口的公司。",
};

export default function CompaniesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-16 sm:px-6 sm:pt-10">
      <header className="mb-8 max-w-2xl">
        <p className="text-xs tracking-[0.18em] text-primary uppercase">公司目录</p>
        <h1 className="mt-2 font-display text-4xl leading-tight tracking-tight sm:text-5xl">已接入的招聘方</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          示例数据使用 Ashby 的公开职位接口，不需要登录。停用一家公司后，抓取会跳过它。
        </p>
      </header>
      <Suspense fallback={<CompanyDirectoryFallback />}>
        <CompanyDirectory />
      </Suspense>
    </div>
  );
}
