import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PublicShell } from "../../PublicShell";
import { Avatar } from "@/components/ui";
import { loadAttendee } from "@/lib/attendee";
import { store } from "@/lib/store";
import { canSee } from "@/lib/visibility";

export const dynamic = "force-dynamic";

export default async function PersonPage({ params }: { params: { code: string; id: string } }) {
  const { loc, me } = await loadAttendee(params.code);
  if (loc.endedAt || !me || me.status !== "live") redirect(`/l/${params.code}`);

  const p = await (await store()).getProfile(params.id);
  // Strict bucket boundary: a profile from any other location is indistinguishable from a missing one.
  if (!p || p.locationId !== loc.id || p.status !== "live" || !canSee(loc, me, p)) notFound();
  const f = p.fields;
  const facts = [f.height && `${f.height}`, f.pronouns, f.occupation].filter(Boolean) as string[];

  return (
    <PublicShell loc={loc}>
      <Link href={`/l/${loc.code}/people`} className="text-sm text-haze-300 hover:text-white">← Everyone here</Link>
      <div className="mt-4">
        <Avatar name={f.name} photo={p.photo} size="lg" />
      </div>
      <h1 className="mt-5 font-display text-4xl font-bold">{f.name}{f.age ? <span className="font-normal text-haze-300">, {f.age}</span> : null}</h1>
      {facts.length > 0 && <p className="mt-1 text-haze-300">{facts.join(" · ")}</p>}

      {f.bio && <p className="mt-6 whitespace-pre-line text-lg leading-relaxed">{f.bio}</p>}

      {f.lookingFor && (
        <section className="card mt-6 p-4">
          <p className="label">Looking for</p>
          <p>{f.lookingFor}</p>
        </section>
      )}

      {f.hobbies.length > 0 && (
        <section className="mt-6">
          <p className="label">Into</p>
          <div className="flex flex-wrap gap-2">
            {f.hobbies.map((h) => <span key={h} className="chip">{h}</span>)}
          </div>
        </section>
      )}
    </PublicShell>
  );
}
