import { cn } from "@/lib/utils";

export function CanalMark({
  className,
  title = "Brugapp",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label={title}
      className={cn("text-canal", className)}
    >
      <title>{title}</title>
      <rect x="2" y="28" width="44" height="12" rx="2" className="fill-canal/20" />
      <path
        d="M4 32c4 4 8 4 12 0s8-4 12 0 8 4 12 0 8-4 12 0"
        className="stroke-canal fill-none"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M8 26h13l3-10h3l3 10h13"
        className="stroke-foreground fill-none"
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="24" cy="26" r="2.2" className="fill-canal" />
    </svg>
  );
}
