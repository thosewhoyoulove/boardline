"use client";

import Image from "next/image";
import { useState } from "react";

const logos: Record<string, string> = {
  tencent: "/company-logos/tencent.ico",
  bytedance: "/company-logos/bytedance.ico",
  alibaba: "/company-logos/alibaba.ico",
  meituan: "/company-logos/meituan.ico",
  jd: "/company-logos/jd.ico",
  xiaomi: "/company-logos/xiaomi.ico",
  didi: "/company-logos/didi.ico",
  ctrip: "/company-logos/ctrip.ico",
  netease: "/company-logos/netease.ico",
  bilibili: "/company-logos/bilibili.ico",
};

export function CompanyLogo({ slug, name, className = "" }: { slug: string; name: string; className?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = logos[slug];
  return (
    <span className={`company-monogram company-logo ${className}`} data-company={slug} aria-hidden="true">
      {src && failedSrc !== src ? (
        <Image src={src} width={32} height={32} alt="" unoptimized onError={() => setFailedSrc(src)} />
      ) : name.slice(0, 1)}
    </span>
  );
}
