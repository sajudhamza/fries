import Link from "next/link";
import { Brand } from "@/components/ui";

export default function Home() {
  return (
    <main className="min-h-screen bg-glow px-4">
      <div className="mx-auto max-w-2xl py-20">
        <Brand />
        <h1 className="mt-10 font-display text-5xl font-bold leading-tight">Meet the people in the room.</h1>
        <p className="mt-5 text-lg text-haze-300">
          Every venue gets its own QR code. Guests scan it, record a short intro, and instantly see who else is there.
          Nothing outlives the night: profiles and videos are deleted when the event ends.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/admin" className="btn-primary">Open admin console</Link>
        </div>
      </div>
    </main>
  );
}
