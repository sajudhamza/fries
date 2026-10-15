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
        <div className="mt-16 text-center">
          <p className="font-display text-3xl font-bold">This event has ended</p>
          <p className="mt-3 text-haze-300">Every intro video and profile from {loc.name} has been deleted. See you at the next one.</p>
        </div>
      </PublicShell>
    );
  }
  if (me) redirect(nextStep(params.code, me));

  return (
    <PublicShell loc={loc}>
      <section className="mt-6">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-rose-400">You&apos;re at</p>
        <h1 className="mt-2 font-display text-4xl font-bold leading-tight">{loc.name}</h1>
        {loc.venue && <p className="mt-1 text-haze-300">{loc.venue}</p>}
        <p className="mt-6 text-lg text-haze-100">Record a quick 15 to 60 second intro. We&apos;ll turn it into your profile so you can see who else is here tonight.</p>
      </section>

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
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rose-500/15 font-semibold text-rose-300">{i + 1}</span>
            <div>
              <p className="font-semibold">{t}</p>
              <p className="text-sm text-haze-300">{d}</p>
            </div>
          </li>
        ))}
      </ol>

      <form action={joinLocation.bind(null, loc.code)} className="mt-8 space-y-4">
        {searchParams.left && <Notice tone="ok">Your profile and video were deleted.</Notice>}
        {searchParams.error && <Notice tone="error">Please tick both boxes to continue.</Notice>}
        <label className="flex gap-3 text-sm text-haze-300">
          <input type="checkbox" name="adult" className="mt-0.5 h-4 w-4 accent-rose-500" required />
          I&apos;m 18 or older.
        </label>
        <label className="flex gap-3 text-sm text-haze-300">
          <input type="checkbox" name="consent" className="mt-0.5 h-4 w-4 accent-rose-500" required />
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
