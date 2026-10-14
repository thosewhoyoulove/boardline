"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-xs tracking-[0.18em] text-primary uppercase">出错了</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">页面没有加载出来</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        如果刚克隆仓库，先执行 <code className="font-mono text-foreground">npx prisma migrate dev</code> 再刷新。
        {error.digest ? ` 错误编号 ${error.digest}。` : ""}
      </p>
      <Button type="button" className="mt-6" onClick={() => reset()}>
        重试
      </Button>
    </div>
  );
}
