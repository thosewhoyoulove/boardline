import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-xs tracking-[0.18em] text-primary uppercase">404</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">这个页面不存在</h1>
      <Link href="/" className="mt-6 inline-block text-primary underline-offset-4 hover:underline">
        返回职位列表
      </Link>
    </div>
  );
}
