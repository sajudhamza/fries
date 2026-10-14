import Link from "next/link";
import { redirect } from "next/navigation";
import { PublicShell } from "../PublicShell";
import { Avatar } from "@/components/ui";
import { loadAttendee, nextStep } from "@/lib/attendee";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Who's here" };

export default async function PeoplePage({ params }: { params: { code: string } }) {
  const { loc, me } = await loadAttendee(params.code);
  if (loc.endedAt || !me) redirect(`/l/${params.code}`);
  // You see others only once your own profile is live.
  if (me.status !== "live") redirect(nextStep(params.code, me));

  const others = (await (await store()).listProfiles(loc.id, "live")).filter((p) => p.id !== me.id);

  return (
    <PublicShell loc={loc} wide>
      <div className="mt-2 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Who&apos;s here</h1>
          <p className="mt-1 text-sm text-haze-300">{others.length === 0 ? "You're the first one. Others will show up as they join." : `${others.length} ${others.length === 1 ? "person" : "people"} at ${loc.name}`}</p>
        </div>
        <Link href={`/l/${loc.code}/me`} className="flex items-center gap-2 rounded-full border border-white/15 py-1 pl-1 pr-3 text-sm hover:bg-white/5">
          <span className="block w-7 overflow-hidden rounded-full"><Avatar name={me.fields.name} photo={me.photo} /></span>
          You
        </Link>
      </div>

      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {others.map((p) => (
          <li key={p.id}>
            <Link href={`/l/${loc.code}/people/${p.id}`} className="group block">
              <div className="relative">
                <Avatar name={p.fields.name} photo={p.photo} />
                <div className="absolute inset-x-0 bottom-0 rounded-b-2xl bg-gradient-to-t from-black/85 to-transparent p-3 pt-10">
                  <p className="font-semibold leading-tight">{p.fields.name}{p.fields.age ? <span className="font-normal text-white/80">, {p.fields.age}</span> : null}</p>
                  {p.fields.occupation && <p className="truncate text-xs text-white/70">{p.fields.occupation}</p>}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </PublicShell>
  );
}
