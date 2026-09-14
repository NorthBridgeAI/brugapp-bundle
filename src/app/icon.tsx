import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export function generateImageMetadata() {
  return [
    { contentType: "image/png", size: { width: 192, height: 192 }, id: "192" },
    { contentType: "image/png", size: { width: 512, height: 512 }, id: "512" },
    {
      contentType: "image/png",
      size: { width: 512, height: 512 },
      id: "maskable",
    },
  ];
}

export default function Icon({ id }: { id: string }) {
  const size = id === "192" ? 192 : 512;
  const pad = id === "maskable" ? size * 0.18 : size * 0.16;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#020617",
        }}
      >
        <div
          style={{
            width: size - pad * 2,
            height: size - pad * 2,
            borderRadius: size * 0.22,
            background: "#042f2e",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#5eead4",
            fontSize: size * 0.42,
            fontWeight: 700,
          }}
        >
          B
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
