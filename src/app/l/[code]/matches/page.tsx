import Link from "next/link";
import { redirect } from "next/navigation";
import { PublicShell } from "../PublicShell";
import { LocalTime } from "@/components/client";
import { SocialTabs } from "@/components/SocialTabs";
import { Avatar, Notice } from "@/components/ui";
import { loadAttendee, nextStep } from "@/lib/attendee";
import { matchesFor } from "@/lib/social";
import { SWIPE_COPY } from "@/lib/types";
import { needsMatchPrefs } from "@/lib/visibility";

export const dynamic = "force-dynamic";
export const metadata = { title: "Matches" };

export default async function MatchesPage({ params, searchParams }: { params: { code: string }; searchParams: { blocked?: string } }) {
  const { loc, me } = await loadAttendee(params.code);
  if (loc.endedAt || !me) redirect(`/l/${params.code}`);
  if (me.status !== "live") redirect(nextStep(params.code, me));
  if (needsMatchPrefs(loc, me)) redirect(`/l/${params.code}/me?prefs=1`);

  const copy = SWIPE_COPY[loc.eventType];
  const matches = await matchesFor(loc, me);

  return (
    <PublicShell loc={loc}>
      <h1 className="mt-2 font-display text-[34px] leading-none">{copy.matches}</h1>
      {searchParams.blocked && <div className="mt-4"><Notice tone="ok">Blocked. You won&apos;t see each other again at this event.</Notice></div>}
      {matches.length === 0 ? (
        <div className="card mt-6 px-6 py-12 text-center">
          <p className="font-display text-2xl leading-tight">{copy.empty}</p>
          <p className="mt-1 text-sm text-forest/70">When you both swipe right on each other, you can chat here.</p>
          <Link href={`/l/${loc.code}/people`} className="btn-primary mt-5">Start swiping</Link>
        </div>
      ) : (
        <ul className="mt-5 divide-y divide-forest/10">
          {matches.map(({ match, other, last, unread }) => (
            <li key={match.id}>
              <Link href={`/l/${loc.code}/matches/${match.id}`} className="flex items-center gap-3 py-3">
                <span className="block w-14 shrink-0"><Avatar name={other.fields.name} photo={other.photo} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-xl leading-none">{other.fields.name}</span>
                    <span className="shrink-0 text-xs text-forest/55"><LocalTime iso={last?.createdAt ?? match.createdAt} mode="time" /></span>
                  </span>
                  <span className={`block truncate text-sm ${unread ? "font-semibold text-forest" : "text-forest/55"}`}>
                    {last
                      ? `${last.fromId === me.id ? "You: " : ""}${last.kind === "meet" ? `📍 ${last.body.split("\n")[0]}` : last.body}`
                      : "New match! Say hi 👋"}
                  </span>
                </span>
                {unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-tomato" aria-label="new" />}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <SocialTabs code={loc.code} active="matches" matchesLabel={copy.matches} initialCount={matches.filter((m) => m.unread).length} />
    </PublicShell>
  );
}
