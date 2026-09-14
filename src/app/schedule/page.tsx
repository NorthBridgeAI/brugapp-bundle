import type { Metadata } from "next";
import { ScheduleBoard } from "@/components/schedule-board";
import { loadCatalog } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Schema",
  description:
    "Officiële spitsvrij-vensters van Draaibrug Sluiskil. Sluiskil, Sas van Gent en de Noordzeesluizen op afroep; live stand op Status.",
};

export const dynamic = "force-dynamic";

export default function SchedulePage() {
  const catalog = loadCatalog();
  return (
    <ScheduleBoard catalog={catalog} initialNow={new Date().toISOString()} />
  );
}
