import { redirect } from "next/navigation";
import { PublicShell } from "../PublicShell";
import { SocialTabs } from "@/components/SocialTabs";
import { SwipeDeck, type DeckCard } from "@/components/SwipeDeck";
import { loadAttendee, nextStep } from "@/lib/attendee";
import { deckFor, matchesFor } from "@/lib/social";
import { resetPasses } from "@/lib/social-actions";
import { SWIPE_COPY, type Profile } from "@/lib/types";
import { needsMatchPrefs } from "@/lib/visibility";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discover" };

function toCard(p: Profile, business: boolean): DeckCard {
  const f = p.fields;
  // At business events lead with what people do; elsewhere with height and pronouns.
  const facts = (business ? [f.occupation, f.pronouns] : [f.height, f.pronouns, f.occupation]).filter(Boolean);
  return { id: p.id, name: f.name, age: business ? null : f.age, photo: p.photo, facts, bio: f.bio, hobbies: f.hobbies, lookingFor: f.lookingFor };
}

export default async function DiscoverPage({ params }: { params: { code: string } }) {
  const { loc, me } = await loadAttendee(params.code);
  if (loc.endedAt || !me) redirect(`/l/${params.code}`);
  // You can swipe only once your own profile is live.
  if (me.status !== "live") redirect(nextStep(params.code, me));
  if (needsMatchPrefs(loc, me)) redirect(`/l/${params.code}/me?prefs=1`);

  const copy = SWIPE_COPY[loc.eventType];
  const [deck, matches] = await Promise.all([deckFor(loc, me), matchesFor(loc, me)]);

  return (
    <PublicShell loc={loc}>
      <h1 className="mt-2 font-display text-3xl font-bold">{copy.deck}</h1>
      <SwipeDeck
        key={deck.map((p) => p.id).join(",")}
        code={loc.code}
        cards={deck.map((p) => toCard(p, loc.eventType === "business"))}
        likeLabel={copy.like}
        passLabel={copy.pass}
        matchedTitle={copy.matched}
        resetAction={resetPasses.bind(null, loc.code)}
      />
      <SocialTabs code={loc.code} active="deck" matchesLabel={copy.matches} initialCount={matches.filter((m) => m.unread).length} />
    </PublicShell>
  );
}
