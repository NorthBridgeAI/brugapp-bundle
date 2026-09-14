import type { Metadata } from "next";
import { Radio, Smartphone, FileJson } from "lucide-react";
import { InstallPrompt } from "@/components/install-prompt";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Over Brugapp",
  description:
    "Persoonlijke brugstatus-app voor het Kanaal Gent–Terneuzen. Geen officieel verkeersbericht.",
};

export default function AboutPage() {
  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-medium tracking-[0.2em] text-canal uppercase">
          Over deze app
        </p>
        <h1 className="font-serif text-3xl text-slate-50">Brugapp</h1>
        <p className="max-w-lg text-sm leading-6 text-slate-400">
          Een stille PWA voor thuis: zie in één oogopslag of je over Sluiskil,
          Sas van Gent of de Noordzeesluizen kunt. Terneuzen heeft een eigen
          ruimte met een kaart van de Buitenhaven. Gebouwd voor de oversteek op
          het Kanaal Gent–Terneuzen in Zeeland.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-serif text-xl text-slate-50">Wat je ziet</h2>
        <ul className="space-y-3 text-sm leading-6 text-slate-300">
          <li>
            <span className="font-medium text-status-clear">Vrij</span> — de weg
            is open, je kunt oversteken.
          </li>
          <li>
            <span className="font-medium text-status-soon">Let op</span> — er
            staat een opening gepland, reken op hinder.
          </li>
          <li>
            <span className="font-medium text-status-wait">Wachten</span> — de
            weg is dicht; de brug of sluis is in bedrijf voor scheepvaart.
          </li>
        </ul>
      </section>

      <section className="grid gap-3">
        <div className="flex gap-3 rounded-2xl border border-white/8 bg-slate-900/50 p-4">
          <FileJson className="mt-0.5 size-5 text-canal" />
          <div>
            <h3 className="font-medium text-slate-100">Live via NDW</h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              De actuele stand van Sluiskil, Sas van Gent en Terneuzen komt uit
              de vrije NDW DATEX-brugopeningenfeed. Openingen op afroep; Schema
              toont alleen echte spitsvrij-vensters van Sluiskil. Handmatige
              overrides in{" "}
              <code className="text-slate-200">src/data/status.json</code> gaan
              altijd voor.
            </p>
          </div>
        </div>
        <div className="flex gap-3 rounded-2xl border border-white/8 bg-slate-900/50 p-4">
          <Radio className="mt-0.5 size-5 text-canal" />
          <div>
            <h3 className="font-medium text-slate-100">Geen officieel bericht</h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Brugapp is geen Rijkswaterstaat-kanaal. Bij twijfel: kijk ter
              plaatse, of bel de brug op VHF 11.
            </p>
          </div>
        </div>
        <div className="flex gap-3 rounded-2xl border border-white/8 bg-slate-900/50 p-4">
          <Smartphone className="mt-0.5 size-5 text-canal" />
          <div className="space-y-3">
            <h3 className="font-medium text-slate-100">Op het beginscherm</h3>
            <InstallPrompt />
          </div>
        </div>
      </section>

      <Separator className="bg-white/8" />

      <p className="text-xs tracking-wide text-slate-400">Fenryx</p>
    </article>
  );
}
