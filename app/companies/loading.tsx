import { CompanyDirectoryFallback } from "@/components/company-directory";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-16 sm:px-6 sm:pt-10">
      <CompanyDirectoryFallback />
    </div>
  );
}
