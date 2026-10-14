import Link from "next/link";
import QRCode from "qrcode";
import { notFound, redirect } from "next/navigation";
import { AdminHeader } from "../../AdminHeader";
import { ConfirmSubmit, CopyButton, DateTimeField, LocalTime } from "@/components/client";
import { Notice, StatusPill } from "@/components/ui";
import { deleteLocation, endEventNow, updateLocation } from "@/lib/admin-actions";
import { ensureFresh } from "@/lib/lifecycle";
import { isAdmin } from "@/lib/session";
import { store } from "@/lib/store";
import type { ProfileStatus } from "@/lib/types";
import { joinUrl } from "@/lib/urls";
import { locationState } from "@/lib/util";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<ProfileStatus, string> = {
  awaiting_video: "Joined, no video yet",
  processing: "Processing video",
  review: "Reviewing details",
  live: "Live",
};

export default async function LocationAdmin({ params, searchParams }: { params: { id: string }; searchParams: { saved?: string; purged?: string } }) {
  if (!isAdmin()) redirect("/admin/login");
  const s = await store();
  const found = await s.getLocation(params.id);
  if (!found) notFound();
  const loc = await ensureFresh(found);
  const profiles = await s.listProfiles(loc.id);
  const url = joinUrl(loc.code);
  const svg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#0B0A10", light: "#FFFFFF" } });
  const state = locationState(loc);
  const live = profiles.filter((p) => p.status === "live").length;
  const [purgedProfiles, purgedVideos] = (searchParams.purged ?? "").split("-");

  return (
    <>
      <AdminHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link href="/admin" className="text-sm text-haze-300 hover:text-white">← All locations</Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold">{loc.name}</h1>
          <StatusPill tone={state}>{state === "live" ? "Live" : state === "scheduled" ? "Scheduled" : "Ended"}</StatusPill>
        </div>
        <p className="mt-1 text-sm text-haze-300">
          {loc.venue || "No venue set"} · {state === "ended" ? <>ended <LocalTime iso={loc.endedAt ?? loc.endsAt} /></> : <>data deletes <LocalTime iso={loc.endsAt} /> (<LocalTime iso={loc.endsAt} mode="relative" />)</>}
        </p>

        <div className="mt-6 space-y-3">
          {searchParams.saved && <Notice tone="ok">Saved.</Notice>}
          {searchParams.purged && <Notice tone="ok">Event closed. Deleted {purgedProfiles} profiles and {purgedVideos} videos.</Notice>}
          {state === "ended" && <Notice>This event has ended and its profiles and videos were deleted. Set a new end time below to reopen it with the same QR code.</Notice>}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
          <section className="card p-5">
            <div className="rounded-2xl bg-white p-4 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
            <p className="mt-4 break-all rounded-lg bg-night-800 px-3 py-2 font-mono text-xs text-haze-300">{url}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`/admin/locations/${loc.id}/qr?format=png`} className="btn-primary">Download PNG</a>
              <a href={`/admin/locations/${loc.id}/qr?format=svg`} className="btn-ghost">SVG</a>
              <CopyButton text={url} />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link href={`/admin/locations/${loc.id}/poster`} className="btn-ghost">Printable poster</Link>
              <a href={url} target="_blank" className="btn-ghost">Open public page ↗</a>
            </div>
            {url.includes("localhost") && (
              <p className="mt-4 text-xs text-haze-500">This QR points at localhost, so phones can&apos;t open it. Set NEXT_PUBLIC_APP_URL to your LAN IP or deployed domain.</p>
            )}
          </section>

          <div className="space-y-6">
            <section className="card p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-xl font-bold">People at this location</h2>
                <span className="text-sm text-haze-300">{live} live · {profiles.length} total</span>
              </div>
              {profiles.length === 0 ? (
                <p className="mt-3 text-sm text-haze-500">Nobody has scanned this code yet.</p>
              ) : (
                <ul className="mt-3 divide-y divide-white/5">
                  {profiles.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="truncate">{p.fields.name || <span className="text-haze-500">Unnamed</span>}</span>
                      <span className="flex shrink-0 items-center gap-3 text-haze-500">
                        <StatusPill tone={p.status === "live" ? "live" : "muted"}>{STATUS_LABEL[p.status]}</StatusPill>
                        <LocalTime iso={p.createdAt} mode="time" />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <form action={updateLocation.bind(null, loc.id)} className="card grid gap-4 p-5 sm:grid-cols-2">
              <h2 className="font-display text-xl font-bold sm:col-span-2">Details</h2>
              <label className="block">
                <span className="label">Name</span>
                <input name="name" className="input" defaultValue={loc.name} required maxLength={80} />
              </label>
              <label className="block">
                <span className="label">Venue / address</span>
                <input name="venue" className="input" defaultValue={loc.venue} maxLength={120} />
              </label>
              <DateTimeField name="startsAt" label="Starts (optional)" defaultValue={loc.startsAt} />
              <DateTimeField name="endsAt" label="Ends (data is deleted at this time)" defaultValue={loc.endsAt} required />
              <div className="sm:col-span-2">
                <button className="btn-primary">{state === "ended" ? "Save & reopen" : "Save changes"}</button>
              </div>
            </form>

            <section className="card border-rose-500/20 p-5">
              <h2 className="font-display text-xl font-bold">Danger zone</h2>
              <p className="mt-1 text-sm text-haze-300">Closing the event permanently deletes every intro video and profile at this location. This can&apos;t be undone.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {state !== "ended" && (
                  <form action={endEventNow.bind(null, loc.id)}>
                    <ConfirmSubmit className="btn-danger" message={`End "${loc.name}" now and delete all ${profiles.length} profiles and their videos?`}>
                      End event & delete data now
                    </ConfirmSubmit>
                  </form>
                )}
                <form action={deleteLocation.bind(null, loc.id)}>
                  <ConfirmSubmit className="btn-danger" message={`Delete "${loc.name}" and its QR code permanently? The printed QR will stop working.`}>
                    Delete location
                  </ConfirmSubmit>
                </form>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
