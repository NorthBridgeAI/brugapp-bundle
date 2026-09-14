"use client";

import dynamic from "next/dynamic";
import type { Catalog, LiveSnapshot } from "@/lib/types";

const DraftBOps = dynamic(
  () => import("@/components/draft-b-ops").then((mod) => mod.DraftBOps),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 grid place-items-center bg-[#f4f1ea] font-mono text-sm text-slate-700">
        Kaart laden…
      </div>
    ),
  },
);

export default function DraftBClient(props: {
  catalog: Catalog;
  initialNow: string;
  initialLive: LiveSnapshot | null;
}) {
  return <DraftBOps {...props} />;
}
