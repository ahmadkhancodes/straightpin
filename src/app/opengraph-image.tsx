import { ImageResponse } from "next/og";
import { product } from "@/config/product";

export const alt = `${product.fullName}: ${product.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#181818",
          color: "#ffffff",
          padding: 80,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 12,
              background: "#ffffff",
              color: "#181818",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              fontWeight: 700,
            }}
          >
            {product.name.charAt(0)}
          </div>
          <div style={{ fontSize: 36, fontWeight: 600 }}>{product.fullName}</div>
        </div>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 600, lineHeight: 1.1, letterSpacing: -2, maxWidth: 1000 }}>
          {product.tagline}
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#9b9b9b" }}>{product.host}</div>
      </div>
    ),
    { ...size },
  );
}
