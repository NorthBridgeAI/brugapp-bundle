"use client";

import dynamic from "next/dynamic";
import type { Catalog, LiveSnapshot } from "@/lib/types";

const DraftA3Map = dynamic(
  () => import("@/components/draft-a3-map").then((mod) => mod.DraftA3Map),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 grid place-items-center bg-[#05080d] font-mono text-sm text-cyan-200">
        Kaart laden…
      </div>
    ),
  },
);

export default function DraftA3Client(props: {
  catalog: Catalog;
  initialNow: string;
  initialLive: LiveSnapshot | null;
}) {
  return <DraftA3Map {...props} />;
}
