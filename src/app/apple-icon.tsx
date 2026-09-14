import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
            width: 132,
            height: 132,
            borderRadius: 32,
            background: "#042f2e",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#5eead4",
            fontSize: 72,
            fontWeight: 700,
          }}
        >
          B
        </div>
      </div>
    ),
    size,
  );
}
