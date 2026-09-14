"use client";

import dynamic from "next/dynamic";
import type { Catalog, LiveSnapshot } from "@/lib/types";

const DraftA2Map = dynamic(
  () => import("@/components/draft-a2-map").then((mod) => mod.DraftA2Map),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 grid place-items-center bg-[#05080d] font-mono text-sm text-cyan-200">
        Kaart laden…
      </div>
    ),
  },
);

export default function DraftA2Client(props: {
  catalog: Catalog;
  initialNow: string;
  initialLive: LiveSnapshot | null;
}) {
  return <DraftA2Map {...props} />;
}
