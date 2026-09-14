import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import bridgesFile from "@/data/bridges.json";

const slugs = new Set(bridgesFile.bridges.map((bridge) => bridge.slug));

/**
 * Unknown /brug/[slug] must be HTTP 404. App Router `notFound()` cannot
 * change the status after `loading.tsx` / metadata streaming has begun.
 */
export function proxy(request: NextRequest) {
  const slug = request.nextUrl.pathname.split("/").filter(Boolean)[1];
  if (slug === "terneuzen") {
    return NextResponse.redirect(new URL("/terneuzen", request.url));
  }
  if (!slug || slugs.has(decodeURIComponent(slug))) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/_not-found";
  return NextResponse.rewrite(url, { status: 404 });
}

export const config = {
  matcher: "/brug/:slug",
};
