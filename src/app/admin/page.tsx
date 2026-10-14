import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminHeader } from "./AdminHeader";
import { DateTimeField, LocalTime } from "@/components/client";
import { Notice, StatusPill } from "@/components/ui";
import { createLocation } from "@/lib/admin-actions";
import { purgeExpired } from "@/lib/lifecycle";
import { isAdmin } from "@/lib/session";
import { store } from "@/lib/store";
import { locationState } from "@/lib/util";

export const dynamic = "force-dynamic";
export const metadata = { title: "Locations" };

const ERRORS: Record<string, string> = {
  missing: "Give the location a name and an end time.",
  past: "The end time has to be in the future.",
};

export default async function AdminHome({ searchParams }: { searchParams: { error?: string } }) {
  if (!isAdmin()) redirect("/admin/login");
  await purgeExpired();
  const s = await store();
  const [locations, counts] = await Promise.all([s.listLocations(), s.countProfiles()]);

  return (
    <>
      <AdminHeader />
      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px]">
        <section>
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold">Locations</h1>
              <p className="mt-1 text-sm text-haze-300">Each location has its own QR code. People only see others who joined through the same code.</p>
            </div>
          </div>
          {locations.length === 0 ? (
            <div className="card grid place-items-center px-6 py-16 text-center">
              <p className="font-display text-xl">No locations yet</p>
              <p className="mt-1 max-w-xs text-sm text-haze-300">Add your first venue or event on the right to generate its QR code.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {locations.map((l) => {
                const state = locationState(l);
                const c = counts[l.id];
                return (
                  <li key={l.id}>
                    <Link href={`/admin/locations/${l.id}`} className="card flex items-center gap-4 p-4 transition hover:border-white/25">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-semibold">{l.name}</span>
                          <StatusPill tone={state}>{state === "live" ? "Live" : state === "scheduled" ? "Scheduled" : "Ended"}</StatusPill>
                        </div>
                        <p className="mt-0.5 truncate text-sm text-haze-500">
                          {l.venue || "No venue set"} · {state === "ended" ? "ended" : "ends"} <LocalTime iso={l.endedAt ?? l.endsAt} />
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-2xl font-bold">{c?.live ?? 0}</div>
                        <div className="text-xs text-haze-500">live profiles</div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside>
          <form action={createLocation} className="card space-y-4 p-5 lg:sticky lg:top-6">
            <h2 className="font-display text-xl font-bold">Add a location</h2>
            {searchParams.error && <Notice tone="error">{ERRORS[searchParams.error] ?? "Something went wrong."}</Notice>}
            <label className="block">
              <span className="label">Name</span>
              <input name="name" className="input" placeholder="Friday Rooftop Social" required maxLength={80} />
            </label>
            <label className="block">
              <span className="label">Venue / address</span>
              <input name="venue" className="input" placeholder="PHD Terrace, Dream Midtown" maxLength={120} />
            </label>
            <DateTimeField name="startsAt" label="Starts (optional)" />
            <DateTimeField name="endsAt" label="Ends (data is deleted at this time)" required />
            <button className="btn-primary w-full">Create & generate QR</button>
          </form>
        </aside>
      </main>
    </>
  );
}
