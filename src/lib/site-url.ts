import { headers } from "next/headers";

const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0|::1)(:\d+)?$/i;

function firstHeader(value: string | null | undefined): string {
  return (value ?? "").split(",")[0]?.trim() ?? "";
}

function isLoopbackHost(host: string): boolean {
  return LOOPBACK.test(host);
}

export function resolveMetadataBase({
  explicit,
  host,
  proto,
  nodeEnv,
  vercel,
}: {
  explicit?: string | null;
  host?: string | null;
  proto?: string | null;
  nodeEnv: string;
  vercel?: string | null;
}): URL | undefined {
  const trimmed = explicit?.trim();
  if (trimmed) {
    const url = new URL(trimmed);
    if (nodeEnv !== "production" || !isLoopbackHost(url.host)) return url;
  }

  const cleanHost = firstHeader(host);
  const cleanProto = firstHeader(proto) || "https";

  if (cleanHost) {
    const loopback = isLoopbackHost(cleanHost);
    if (!loopback) return new URL(`${cleanProto}://${cleanHost}`);
    if (nodeEnv !== "production") {
      return new URL(`http://${cleanHost}`);
    }
  }

  const vercelHost = vercel?.replace(/^https?:\/\//, "").trim();
  if (vercelHost && !isLoopbackHost(vercelHost)) {
    return new URL(`https://${vercelHost}`);
  }

  return undefined;
}

/**
 * Request-time site origin for Metadata / Open Graph.
 * Never falls back to 127.0.0.1 in production HTML.
 */
export async function metadataBaseUrl(): Promise<URL | undefined> {
  const h = await headers();
  return resolveMetadataBase({
    explicit: process.env.NEXT_PUBLIC_SITE_URL,
    host: h.get("x-forwarded-host") ?? h.get("host"),
    proto: h.get("x-forwarded-proto"),
    nodeEnv: process.env.NODE_ENV ?? "development",
    vercel:
      process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL,
  });
}
