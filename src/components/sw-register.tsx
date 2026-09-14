"use client";

import { useEffect } from "react";

function isOurWorker(registration: ServiceWorkerRegistration): boolean {
  const script =
    registration.active?.scriptURL ||
    registration.waiting?.scriptURL ||
    registration.installing?.scriptURL ||
    "";
  try {
    const url = new URL(script);
    return url.pathname === "/sw.js";
  } catch {
    return false;
  }
}

export function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    const sync = async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();

      if (process.env.NODE_ENV !== "production") {
        for (const reg of registrations) await reg.unregister();
        return;
      }

      for (const reg of registrations) {
        if (!isOurWorker(reg)) await reg.unregister();
      }

      if (cancelled) return;

      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      await registration.update();
    };

    const run = () => {
      void sync().catch(() => {
        /* PWA is optional in unsupported browsers */
      });
    };

    if (document.readyState === "complete") run();
    else window.addEventListener("load", run, { once: true });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
