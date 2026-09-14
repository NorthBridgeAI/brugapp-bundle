"use client";

import dynamic from "next/dynamic";
import type { Catalog, LiveSnapshot } from "@/lib/types";

const DraftA6Map = dynamic(
  () => import("@/components/draft-a6-map").then((mod) => mod.DraftA6Map),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 grid place-items-center bg-[#071018] font-mono text-sm text-cyan-200">
        Kaart laden…
      </div>
    ),
  },
);

export default function DraftA6Client(props: {
  catalog: Catalog;
  initialNow: string;
  initialLive: LiveSnapshot | null;
}) {
  return <DraftA6Map {...props} />;
}
