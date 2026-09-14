"use client";

import { useEffect, useState } from "react";

export function useNow(initialIso: string, intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date(initialIso));

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
