import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Brugapp",
    short_name: "Brugapp",
    description:
      "Oversteekstatus van de Noordzeesluizen, Draaibrug Sluiskil en Draaibrug Sas van Gent.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#020617",
    lang: "nl",
    dir: "ltr",
    orientation: "portrait-primary",
    categories: ["navigation", "utilities"],
    icons: [
      {
        src: "/icon/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon/maskable",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
