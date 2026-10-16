import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Recargas de diamantes y cuentas Free Fire en Colombia";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const asset = async (f: string) => `data:image/png;base64,${(await readFile(path.join(process.cwd(), "public", "brand", f))).toString("base64")}`;

export default async function OgImage() {
  const [mark, word] = await Promise.all([asset("vanta-v.png"), asset("vantagg.png")]);
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mark} width={84} height={84} alt="" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={word} width={300} height={48} alt="VANTAGG" />
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
