"use client";

import dynamic from "next/dynamic";
import type { Catalog, LiveSnapshot } from "@/lib/types";

const DraftA5Map = dynamic(
  () => import("@/components/draft-a5-map").then((mod) => mod.DraftA5Map),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 grid place-items-center bg-[#071018] font-mono text-sm text-cyan-200">
        Kaart laden…
      </div>
    ),
  },
);

export default function DraftA5Client(props: {
  catalog: Catalog;
  initialNow: string;
  initialLive: LiveSnapshot | null;
}) {
  return <DraftA5Map {...props} />;
}
