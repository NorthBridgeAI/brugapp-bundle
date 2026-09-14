import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { metadataBaseUrl } from "@/lib/site-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const dynamic = "force-dynamic";

const ogImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Brugapp — kun je oversteken?",
};

export async function generateMetadata(): Promise<Metadata> {
  const metadataBase = await metadataBaseUrl();

  return {
    title: {
      default: "Brugapp — brugstatus Zeeland",
      template: "%s · Brugapp",
    },
    description:
      "Persoonlijke PWA voor de oversteekstatus van de Noordzeesluizen, Draaibrug Sluiskil en Draaibrug Sas van Gent op het Kanaal Gent–Terneuzen.",
    applicationName: "Brugapp",
    ...(metadataBase ? { metadataBase } : {}),
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "Brugapp",
    },
    formatDetection: {
      telephone: false,
    },
    openGraph: {
      type: "website",
      locale: "nl_NL",
      siteName: "Brugapp",
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      images: [ogImage.url],
    },
    other: {
      "mobile-web-app-capable": "yes",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#020617",
  colorScheme: "dark",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="nl"
      className={`dark ${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background font-sans text-foreground">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
