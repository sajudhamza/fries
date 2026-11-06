import QRCode from "qrcode";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/client";
import { Checker, LogoLockup } from "@/components/ui";
import { isAdmin } from "@/lib/session";
import { store } from "@/lib/store";
import { joinUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

export default async function Poster({ params }: { params: { id: string } }) {
  if (!isAdmin()) redirect("/admin/login");
  const loc = await (await store()).getLocation(params.id);
  if (!loc) notFound();
  const svg = await QRCode.toString(joinUrl(loc.code), {
    type: "svg", errorCorrectionLevel: "H", margin: 1, color: { dark: "#1E3A2B", light: "#FBF6EB" },
  });

  return (
    <main className="min-h-screen bg-cream px-6 py-10 text-forest print:bg-cream print:p-0">
      <div className="mx-auto mb-6 flex max-w-xl justify-between print:hidden">
        <Link href={`/admin/locations/${loc.id}`} className="text-sm text-forest/70 underline">← Back</Link>
        <PrintButton />
      </div>
      <div className="mx-auto max-w-xl overflow-hidden rounded-3xl border-2 border-forest bg-cream-light text-center print:rounded-none">
        <Checker />
        <div className="flex flex-col items-center px-10 pb-10 pt-9">
          <LogoLockup className="text-[92px]" />
          <p className="mt-8 font-display text-3xl leading-tight">Same table. Different people.</p>
          <div className="mt-6 rounded-3xl border-2 border-forest bg-cream-light p-4">
            <div className="w-64 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          </div>
          <p className="mt-6 font-serif text-sm font-bold uppercase tracking-caps">{loc.name}</p>
          {loc.venue && <p className="font-serif italic text-forest/70">{loc.venue}</p>}
          <ol className="mt-7 grid w-full grid-cols-3 gap-3 text-sm">
            {["Scan with your camera", "Record a 15 to 60 second intro", "Swipe, match, meet up"].map((t, i) => (
              <li key={t} className="flex flex-col items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-forest font-display text-lg text-cream">{i + 1}</span>
                <span className="leading-snug">{t}</span>
              </li>
            ))}
          </ol>
          <p className="mt-8 font-script text-5xl leading-none text-brass">Swipe in person</p>
          <p className="mt-4 text-xs text-forest/60">Profiles are only visible to people at this event and are deleted when it ends.</p>
        </div>
        <Checker />
      </div>
    </main>
  );
}
