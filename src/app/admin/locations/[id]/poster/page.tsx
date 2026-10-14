import QRCode from "qrcode";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/client";
import { isAdmin } from "@/lib/session";
import { store } from "@/lib/store";
import { joinUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

export default async function Poster({ params }: { params: { id: string } }) {
  if (!isAdmin()) redirect("/admin/login");
  const loc = await (await store()).getLocation(params.id);
  if (!loc) notFound();
  const svg = await QRCode.toString(joinUrl(loc.code), { type: "svg", errorCorrectionLevel: "H", margin: 1 });

  return (
    <main className="min-h-screen bg-white px-6 py-10 text-night-950 print:p-0">
      <div className="mx-auto mb-6 flex max-w-xl justify-between print:hidden">
        <Link href={`/admin/locations/${loc.id}`} className="text-sm text-night-600 underline">← Back</Link>
        <PrintButton />
      </div>
      <div className="mx-auto flex max-w-xl flex-col items-center rounded-3xl border-2 border-night-950 px-10 py-12 text-center print:border-0">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-rose-500 font-display text-2xl font-bold text-white">P</span>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.3em] text-rose-600">Who&apos;s here tonight?</p>
        <h1 className="mt-2 font-display text-5xl font-bold leading-tight">{loc.name}</h1>
        {loc.venue && <p className="mt-2 text-lg text-night-600">{loc.venue}</p>}
        <div className="mt-8 w-72 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <ol className="mt-8 space-y-1 text-left text-lg">
          <li><b>1.</b> Scan with your phone camera</li>
          <li><b>2.</b> Record a 1 to 5 minute intro</li>
          <li><b>3.</b> See who else is here</li>
        </ol>
        <p className="mt-8 text-sm text-night-600">Profiles are only visible to people at this event and are deleted when it ends.</p>
      </div>
    </main>
  );
}
