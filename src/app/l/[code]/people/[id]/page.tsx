import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PublicShell } from "../../PublicShell";
import { BlockMenu } from "@/components/BlockMenu";
import { Avatar } from "@/components/ui";
import { loadAttendee } from "@/lib/attendee";
import { canInteract, pair } from "@/lib/social";
import { blockProfile } from "@/lib/social-actions";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function PersonPage({ params }: { params: { code: string; id: string } }) {
  const { loc, me } = await loadAttendee(params.code);
  if (loc.endedAt || !me || me.status !== "live") redirect(`/l/${params.code}`);

  const s = await store();
  const p = await s.getProfile(params.id);
  // Strict boundary: other locations, non-matching preferences and blocks all look like "not found".
  if (!p || !(await canInteract(loc, me, p))) notFound();
  const match = await s.findMatch(...pair(me.id, p.id));
  const f = p.fields;
  const business = loc.eventType === "business";
  const facts = (business ? [f.occupation, f.pronouns] : [f.height, f.pronouns, f.occupation]).filter(Boolean);

  return (
    <PublicShell loc={loc}>
      <div className="flex items-center justify-between">
        <Link href={match ? `/l/${loc.code}/matches/${match.id}` : `/l/${loc.code}/people`} className="text-sm text-forest/70 hover:text-forest">
          ← {match ? "Back to chat" : "Back to Discover"}
        </Link>
        <BlockMenu name={f.name} blockAction={blockProfile.bind(null, loc.code, p.id)} />
      </div>
      <div className="mt-4">
        <Avatar name={f.name} photo={p.photo} size="lg" />
      </div>
      <h1 className="mt-5 font-display text-4xl">{f.name}{!business && f.age ? <span className="font-normal text-forest/70">, {f.age}</span> : null}</h1>
      {facts.length > 0 && <p className="mt-1 text-forest/70">{facts.join(" · ")}</p>}

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

      {match && <Link href={`/l/${loc.code}/matches/${match.id}`} className="btn-primary mt-8 w-full py-3.5 text-base">Message {f.name}</Link>}
    </PublicShell>
  );
}
