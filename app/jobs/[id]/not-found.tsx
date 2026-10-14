import Link from "next/link";

export default function JobNotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-xs tracking-[0.18em] text-primary uppercase">404</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">没有这条职位</h1>
      <p className="mt-3 text-muted-foreground">它可能已被删掉，或者链接不完整。</p>
      <Link href="/" className="mt-6 inline-block text-primary underline-offset-4 hover:underline">
        返回职位列表
      </Link>
    </div>
  );
}
