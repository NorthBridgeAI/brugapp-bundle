"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/use-install-prompt";

export function InstallPrompt() {
  const { canInstall, installed, install } = useInstallPrompt();

  if (installed) {
    return (
      <p className="text-sm text-slate-400">Brugapp staat op dit apparaat.</p>
    );
  }

  if (!canInstall) {
    return (
      <p className="text-sm leading-6 text-slate-400">
        Op iPhone: deelknop, daarna <strong className="text-slate-200">Zet op beginscherm</strong>.
        Op Android: menu, daarna <strong className="text-slate-200">App installeren</strong>.
      </p>
    );
  }

  return (
    <Button onClick={install} className="bg-canal text-slate-950 hover:bg-canal/90">
      <Download data-icon="inline-start" />
      Installeer Brugapp
    </Button>
  );
}
