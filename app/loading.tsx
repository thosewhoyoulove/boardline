export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6" aria-hidden="true">
      <div className="h-8 w-32 rounded bg-muted" />
      <div className="mt-4 h-12 max-w-md animate-pulse rounded bg-muted" />
      <div className="mt-8 h-56 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
