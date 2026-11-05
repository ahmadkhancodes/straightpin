import { ImageResponse } from "next/og";
import { product } from "@/config/product";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#181818",
          color: "#ffffff",
          fontSize: 120,
          fontWeight: 700,
          borderRadius: 0,
        }}
      >
        {product.name.charAt(0)}
      </div>
    ),
    { ...size },
  );
}
