import { redirect } from "next/navigation";
import { PublicShell } from "../PublicShell";
import { ConfirmSubmit } from "@/components/client";
import { Avatar, Notice } from "@/components/ui";
import { GENDERS, INTERESTS, SWIPE_COPY, type Gender, type Interest } from "@/lib/types";
import { SocialTabs } from "@/components/SocialTabs";
import { LateFill } from "@/components/LateFill";
import { workerMode } from "@/lib/worker";
import { loadAttendee } from "@/lib/attendee";
import { leaveLocation, saveProfile } from "@/lib/join-actions";
import type { ProfileFields } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your profile" };

export default async function MePage({ params, searchParams }: { params: { code: string }; searchParams: { error?: string; prefs?: string } }) {
  const { loc, me } = await loadAttendee(params.code);
  if (loc.endedAt || !me) redirect(`/l/${params.code}`);
  if (me.status === "awaiting_video" || me.status === "processing") redirect(`/l/${params.code}/video`);

  const f = me.fields;
  const fromVideo = (k: keyof ProfileFields) =>
    me.extracted.includes(k) ? <span className="ml-2 normal-case tracking-normal text-brass">from your video</span> : null;
  const isLive = me.status === "live";
  const matchmaking = loc.eventType === "matchmaking";
  // The worker hasn't reported back yet (slow run): keep listening for it on this page.
  const waitingForVideo =
    workerMode() !== "off" && me.status === "review" && me.extracted.length === 0 && me.transcript === null && !!me.videoKey &&
    Date.now() - new Date(me.updatedAt).getTime() < 10 * 60_000;

  return (
    <PublicShell loc={loc}>
      <h1 className="mt-2 font-display text-[34px] leading-none">{isLive ? "Edit your profile" : "Check your profile"}</h1>
      <p className="mt-1 text-sm text-forest/70">
        {me.extracted.length > 0
          ? "We filled this in from your intro. Fix anything that's off, then go live."
          : "Fill in anything you'd like people here to know, then go live."}
      </p>

      <form id="profile-form" action={saveProfile.bind(null, loc.code)} className="mt-6 space-y-4">
        {waitingForVideo && <LateFill code={loc.code} formId="profile-form" />}
        {searchParams.error === "name" && <Notice tone="error">Add your name so people know who you are.</Notice>}
        {searchParams.error === "prefs" && <Notice tone="error">Tell us who you are and who you&apos;d like to see.</Notice>}
        {searchParams.prefs && <Notice>The host made this a matchmaking event. Add your preferences below to keep browsing.</Notice>}

        <div className="grid grid-cols-[110px_1fr] items-end gap-4">
          <Avatar name={f.name} photo={me.photo} />
          {me.photo ? (
            <label className="flex gap-2 text-sm text-forest/70">
              <input type="checkbox" name="removePhoto" className="h-4 w-4 accent-forest" /> Don&apos;t show my photo
            </label>
          ) : (
            <p className="text-sm text-forest/55">No photo. People will see your initial.</p>
          )}
        </div>

        <div className="grid grid-cols-[1fr_90px] gap-3">
          <label className="block">
            <span className="label">Name{fromVideo("name")}</span>
            <input name="name" className="input" defaultValue={f.name} maxLength={60} required />
          </label>
          <label className="block">
            <span className="label">Age{fromVideo("age")}</span>
            <input name="age" type="number" min={18} max={119} inputMode="numeric" className="input" defaultValue={f.age ?? ""} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Height{fromVideo("height")}</span>
            <input name="height" className="input" defaultValue={f.height} placeholder={`5'10" / 178 cm`} maxLength={20} />
          </label>
          <label className="block">
            <span className="label">Pronouns{fromVideo("pronouns")}</span>
            <input name="pronouns" className="input" defaultValue={f.pronouns} placeholder="optional" maxLength={30} />
          </label>
        </div>
        {matchmaking && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">I am{fromVideo("gender")}</span>
              <select name="gender" className="input" defaultValue={f.gender} required>
                <option value="" disabled>Choose…</option>
                {(Object.keys(GENDERS) as Gender[]).map((g) => <option key={g} value={g}>{GENDERS[g]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label">Looking for{fromVideo("interestedIn")}</span>
              <select name="interestedIn" className="input" defaultValue={f.interestedIn} required>
                <option value="" disabled>Choose…</option>
                {(Object.keys(INTERESTS) as Interest[]).map((i) => <option key={i} value={i}>{INTERESTS[i]}</option>)}
              </select>
            </label>
            <p className="col-span-2 -mt-1 text-xs text-forest/55">You&apos;ll only see people you&apos;re interested in who are also interested in you.</p>
          </div>
        )}
        <label className="block">
          <span className="label">What you do{fromVideo("occupation")}</span>
          <input name="occupation" className="input" defaultValue={f.occupation} maxLength={80} />
        </label>
        <label className="block">
          <span className="label">About you{fromVideo("bio")}</span>
          <textarea name="bio" rows={3} className="input" defaultValue={f.bio} maxLength={600} />
        </label>
        <label className="block">
          <span className="label">Hobbies{fromVideo("hobbies")}</span>
          <input name="hobbies" className="input" defaultValue={f.hobbies.join(", ")} placeholder="climbing, vinyl, natural wine" maxLength={400} />
          <span className="mt-1 block text-xs text-forest/55">Separate with commas</span>
        </label>
        {!matchmaking && (
          <label className="block">
            <span className="label">Looking for{fromVideo("lookingFor")}</span>
            <textarea
              name="lookingFor"
              rows={2}
              className="input"
              defaultValue={f.lookingFor}
              placeholder={loc.eventType === "business" ? "Co-founders, clients, people in fintech" : "New friends, a dance partner, maybe more"}
              maxLength={300}
            />
          </label>
        )}

        <button className="btn-primary w-full py-3.5 text-base">{isLive ? "Save" : "Go live"}</button>
      </form>

      {isLive && <SocialTabs code={loc.code} active="me" matchesLabel={SWIPE_COPY[loc.eventType].matches} initialCount={0} />}

      <form action={leaveLocation.bind(null, loc.code)} className="mt-8 text-center">
        <ConfirmSubmit className="text-sm text-forest/55 underline hover:text-brass" message="Delete your profile and intro video now? This can't be undone.">
          Delete my profile and video now
        </ConfirmSubmit>
      </form>
    </PublicShell>
  );
}
