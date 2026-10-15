import { redirect } from "next/navigation";
import { PublicShell } from "../PublicShell";
import { VideoCapture } from "@/components/VideoCapture";
import { loadAttendee, nextStep } from "@/lib/attendee";
import { profileFieldsFor } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your intro" };

export default async function VideoPage({ params }: { params: { code: string } }) {
  const { loc, me } = await loadAttendee(params.code);
  if (loc.endedAt || !me) redirect(`/l/${params.code}`);
  if (me.status === "review" || me.status === "live") redirect(nextStep(params.code, me));

  return (
    <PublicShell loc={loc}>
      <h1 className="mb-1 mt-2 font-display text-3xl font-bold">Your intro</h1>
      <p className="mb-6 text-sm text-haze-300">Only used to build your profile. It&apos;s never shown to anyone and is deleted when the event ends.</p>
      <VideoCapture code={loc.code} fields={profileFieldsFor(loc.eventType)} resume={me.status === "processing"} />
    </PublicShell>
  );
}
