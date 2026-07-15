import { ImageResponse } from "next/og";

export const alt = "GLS TV";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "radial-gradient(circle at 30% 20%, #5b1635, #09090d 62%)",
          color: "white",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div style={{ color: "#ff6b9d", fontSize: 34, letterSpacing: 12 }}>GLS</div>
        <div style={{ fontSize: 110, fontWeight: 800, letterSpacing: -4 }}>TV</div>
        <div style={{ color: "#d6c8cf", fontSize: 28, marginTop: 20 }}>
          Live · Series · Movies
        </div>
      </div>
    ),
    size,
  );
}
