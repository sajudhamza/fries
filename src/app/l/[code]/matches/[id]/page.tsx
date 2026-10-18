import Link from "next/link";
import { redirect } from "next/navigation";
import { PublicShell } from "../../PublicShell";
import { BlockMenu } from "@/components/BlockMenu";
import { Chat } from "@/components/Chat";
import { Avatar } from "@/components/ui";
import { loadAttendee, nextStep } from "@/lib/attendee";
import { canInteract, otherId } from "@/lib/social";
import { blockProfile, unmatch } from "@/lib/social-actions";
import { store } from "@/lib/store";
import { SWIPE_COPY } from "@/lib/types";
import { needsMatchPrefs } from "@/lib/visibility";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chat" };

export default async function ChatPage({ params }: { params: { code: string; id: string } }) {
  const { loc, me } = await loadAttendee(params.code);
  if (loc.endedAt || !me) redirect(`/l/${params.code}`);
  if (me.status !== "live") redirect(nextStep(params.code, me));
  if (needsMatchPrefs(loc, me)) redirect(`/l/${params.code}/me?prefs=1`);

  const s = await store();
  const match = await s.getMatch(params.id);
  if (!match || match.locationId !== loc.id || (match.aId !== me.id && match.bId !== me.id)) redirect(`/l/${loc.code}/matches`);
  const other = await s.getProfile(otherId(match, me.id));
  if (!other || !(await canInteract(loc, me, other))) redirect(`/l/${loc.code}/matches`);
  const messages = await s.listMessages(match.id);

  return (
    <PublicShell loc={loc}>
      <div className="sticky top-0 z-20 -mx-4 mb-3 flex items-center gap-3 border-b border-white/10 bg-night-950/90 px-4 py-3 backdrop-blur">
        <Link href={`/l/${loc.code}/matches`} className="text-xl text-haze-300" aria-label={`Back to ${SWIPE_COPY[loc.eventType].matches}`}>←</Link>
        <Link href={`/l/${loc.code}/people/${other.id}`} className="flex min-w-0 flex-1 items-center gap-3">
          <span className="block w-9 shrink-0 overflow-hidden rounded-full"><Avatar name={other.fields.name} photo={other.photo} /></span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">{other.fields.name}</span>
            <span className="block truncate text-xs text-haze-500">{other.fields.occupation || "View profile"}</span>
          </span>
        </Link>
        <BlockMenu
          name={other.fields.name}
          unmatchAction={unmatch.bind(null, loc.code, match.id)}
          blockAction={blockProfile.bind(null, loc.code, other.id)}
        />
      </div>
      <Chat code={loc.code} matchId={match.id} meId={me.id} otherName={other.fields.name} initial={messages} />
    </PublicShell>
  );
}
