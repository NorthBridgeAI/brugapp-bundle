"use client";

import dynamic from "next/dynamic";
import type { Catalog, LiveSnapshot } from "@/lib/types";

const DraftAMap = dynamic(
  () => import("@/components/draft-a-map").then((mod) => mod.DraftAMap),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 grid place-items-center bg-[#05080d] font-mono text-sm text-cyan-200">
        Kaart laden…
      </div>
    ),
  },
);

export default function DraftAClient(props: {
  catalog: Catalog;
  initialNow: string;
  initialLive: LiveSnapshot | null;
}) {
  return <DraftAMap {...props} />;
}
