import { redirect } from "next/navigation";
import { PublicShell } from "./PublicShell";
import { LocalTime } from "@/components/client";
import { Notice } from "@/components/ui";
import { loadAttendee, nextStep } from "@/lib/attendee";
import { joinLocation } from "@/lib/join-actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { code: string } }) {
  const { loc } = await loadAttendee(params.code);
  return { title: loc.name };
}

export default async function JoinPage({ params, searchParams }: { params: { code: string }; searchParams: { error?: string; left?: string } }) {
  const { loc, me } = await loadAttendee(params.code);

  if (loc.endedAt) {
    return (
      <PublicShell loc={loc}>
        <div className="card-dark mt-10 bg-candle px-6 py-14 text-center">
          <p className="font-display text-4xl">That&apos;s a wrap.</p>
          <p className="mt-3 text-cream/80">Every intro video and profile from {loc.name} has been deleted.</p>
          <p className="mt-6 font-script text-4xl text-sand">See you at the next table</p>
        </div>
      </PublicShell>
    );
  }
  if (me) redirect(nextStep(params.code, me));

  return (
    <PublicShell loc={loc}>
      <section className="card-dark mt-4 overflow-hidden bg-candle px-6 pb-7 pt-6 text-center">
        <p className="flex items-center justify-center gap-3 font-serif text-[11px] font-bold uppercase tracking-caps text-cream/80">
          <span className="h-px w-8 bg-cream/40" />You&apos;re at<span className="h-px w-8 bg-cream/40" />
        </p>
        <h1 className="mt-3 font-display text-[44px] leading-[0.95] text-cream">{loc.name}</h1>
        {loc.venue && <p className="mt-2 font-serif italic text-sand">{loc.venue}</p>}
        <p className="mt-5 font-script text-4xl leading-none text-sand">Swipe in person</p>
      </section>
      <p className="mt-6 font-serif text-xl leading-snug">
        Record a quick 15 to 60 second intro. We&apos;ll turn it into your profile so you can meet the people here tonight.
      </p>

      <ol className="mt-8 space-y-3">
        {[
          ["Record your intro", "Name, what you do, what you love, what you're looking for."],
          ["Check your profile", "We fill it in from your video. You fix anything we got wrong."],
          loc.eventType === "matchmaking"
            ? ["See your matches", "Say who you're interested in. Only people at this event who match see each other."]
            : loc.eventType === "business"
              ? ["Meet people here", "Everyone who scanned this code can see each other's profiles. Great for networking."]
              : ["Meet people here", "Only people who scanned this same code can see you."],
        ].map(([t, d], i) => (
          <li key={t} className="card flex gap-4 p-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest font-display text-lg text-cream">{i + 1}</span>
            <div>
              <p className="font-display text-xl leading-tight">{t}</p>
              <p className="text-sm text-forest/70">{d}</p>
            </div>
          </li>
        ))}
      </ol>

      <form action={joinLocation.bind(null, loc.code)} className="mt-8 space-y-4">
        {searchParams.left && <Notice tone="ok">Your profile and video were deleted.</Notice>}
        {searchParams.error && <Notice tone="error">Please tick both boxes to continue.</Notice>}
        <label className="flex gap-3 text-sm text-forest/70">
          <input type="checkbox" name="adult" className="mt-0.5 h-4 w-4 accent-forest" required />
          I&apos;m 18 or older.
        </label>
        <label className="flex gap-3 text-sm text-forest/70">
          <input type="checkbox" name="consent" className="mt-0.5 h-4 w-4 accent-forest" required />
          <span>
            I agree that my intro video is processed to create my profile, that my profile is shown only to people at this event,
            and that both are deleted when the event ends (<LocalTime iso={loc.endsAt} />).
          </span>
        </label>
        <button className="btn-primary w-full py-3.5 text-base">Let&apos;s go</button>
      </form>
    </PublicShell>
  );
}
