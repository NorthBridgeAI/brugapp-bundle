import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-4 py-10">
      <h1 className="font-serif text-3xl text-slate-50">Niet gevonden</h1>
      <p className="text-sm text-slate-400">
        Deze brug of pagina staat niet in Brugapp.
      </p>
      <Link href="/" className="text-sm text-canal hover:underline">
        Terug naar status
      </Link>
    </div>
  );
}
