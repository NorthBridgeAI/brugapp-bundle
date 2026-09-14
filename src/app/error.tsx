"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="space-y-4 py-10">
      <h1 className="font-serif text-3xl text-slate-50">Iets ging mis</h1>
      <p className="text-sm text-slate-400">
        De stand kon niet geladen worden. Probeer opnieuw, of open de JSON later.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset} className="bg-canal text-slate-950">
          Opnieuw
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Naar status</Link>
        </Button>
      </div>
    </div>
  );
}
