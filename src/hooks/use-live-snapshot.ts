"use client";

import { useEffect, useState } from "react";
import type { LiveSnapshot } from "@/lib/types";

export function useLiveSnapshot(
  initial: LiveSnapshot | null,
  intervalMs = 30_000,
) {
  const [live, setLive] = useState(initial);

  useEffect(() => {
    const id = window.setInterval(() => {
      void fetch("/api/status", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { live?: LiveSnapshot } | null) => {
          if (data?.live) setLive(data.live);
        })
        .catch(() => {
          /* keep last snapshot */
        });
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return live;
}
