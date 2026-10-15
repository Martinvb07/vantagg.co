import { ImageResponse } from "next/og";

export const alt = "Recargas de diamantes y cuentas Free Fire en Colombia";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(150deg, #1a1e27 0%, #0f1116 65%)",
          color: "#eef1f5",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "#c8f04f", display: "flex", alignItems: "center", justifyContent: "center", color: "#10140a", fontSize: 34, fontWeight: 800 }}>V</div>
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: 6 }}>VANTA</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>Diamantes a tu ID,</div>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, color: "#a0a8b6" }}>sin vueltas.</div>
          <div style={{ marginTop: 28, fontSize: 28, color: "#a0a8b6" }}>Recargas y cuentas Free Fire · Pagos en pesos colombianos · Seguimiento de cada pedido</div>
        </div>
      </div>
    ),
    size,
  );
}
