import { headers } from "next/headers";
import { metaPixelInitScript } from "@/domain/meta-pixel";

/** Meta Pixel en la tienda (no en el panel): script inicial en línea con el nonce de la CSP y fbevents.js sin bloquear. */
export async function MetaPixel({ id }: { id: string }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <>
      <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: metaPixelInitScript(id) }} />
      <script nonce={nonce} suppressHydrationWarning async src="https://connect.facebook.net/en_US/fbevents.js" />
    </>
  );
}
