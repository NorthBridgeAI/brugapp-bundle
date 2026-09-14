import { ImageResponse } from "next/og";

export const alt = "Brugapp — kun je oversteken?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#020617",
          padding: 72,
          color: "#f8fafc",
        }}
      >
        <div style={{ display: "flex", color: "#5eead4", fontSize: 28, letterSpacing: 6 }}>
          BRUGAPP
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 72, lineHeight: 1.05 }}>Kun je oversteken?</div>
          <div style={{ fontSize: 32, color: "#94a3b8" }}>
            Sluiskil · Sas van Gent · Noordzeesluizen
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 24, color: "#5eead4" }}>
          Kanaal Gent–Terneuzen
        </div>
      </div>
    ),
    size,
  );
}
