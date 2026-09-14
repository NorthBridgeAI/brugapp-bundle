"use client";

import dynamic from "next/dynamic";
import type { Catalog, LiveSnapshot } from "@/lib/types";

const DraftCOrbit = dynamic(
  () => import("@/components/draft-c-orbit").then((mod) => mod.DraftCOrbit),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 grid place-items-center bg-[#05080d] font-mono text-sm text-cyan-200">
        3D laden…
      </div>
    ),
  },
);

export default function DraftCClient(props: {
  catalog: Catalog;
  initialNow: string;
  initialLive: LiveSnapshot | null;
}) {
  return <DraftCOrbit {...props} />;
}
