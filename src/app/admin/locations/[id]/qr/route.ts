import QRCode from "qrcode";
import { NextResponse, type NextRequest } from "next/server";
import { store } from "@/lib/store";
import { isAdmin } from "@/lib/session";
import { joinUrl } from "@/lib/urls";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdmin()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const loc = await (await store()).getLocation(params.id);
  if (!loc) return NextResponse.json({ error: "not found" }, { status: 404 });

  const url = joinUrl(loc.code);
  const slug = loc.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "location";
  const opts = { errorCorrectionLevel: "M" as const, margin: 2, color: { dark: "#0B0A10", light: "#FFFFFF" } };

  if (req.nextUrl.searchParams.get("format") === "svg") {
    const svg = await QRCode.toString(url, { ...opts, type: "svg" });
    return new NextResponse(svg, {
      headers: { "Content-Type": "image/svg+xml", "Content-Disposition": `attachment; filename="pda-${slug}.svg"` },
    });
  }
  const png = await QRCode.toBuffer(url, { ...opts, type: "png", width: 1200 });
  return new NextResponse(png, {
    headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="pda-${slug}.png"` },
  });
}
