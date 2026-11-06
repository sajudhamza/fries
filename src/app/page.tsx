import Link from "next/link";
import { Checker, Logo, LogoLockup } from "@/components/ui";
import { IconCheers, IconPeople, IconTable, IconVideo } from "@/components/icons/BrandIcons";

const STEPS = [
  { icon: IconVideo, title: "Sign up", body: "Scan the code at the venue and leave a short video intro." },
  { icon: IconPeople, title: "We match", body: "See the people at this event, and only this event." },
  { icon: IconCheers, title: "Meet up", body: "Match, say hi, and pick a spot. In real life." },
  { icon: IconTable, title: "Good people", body: "Better plans. Same table, different people." },
];

export default function Home() {
  return (
    <main>
      {/* Hero: candlelit heritage green, like the brand's evening photography */}
      <section className="relative overflow-hidden bg-forest bg-candle text-cream">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <Logo tone="cream" className="text-3xl" />
          <Link href="/admin" className="text-sm font-semibold text-cream/80 hover:text-cream">Host an event</Link>
        </div>
        <div className="mx-auto max-w-5xl px-5 pb-20 pt-10 text-center sm:pt-16">
          <LogoLockup tone="cream" className="text-[clamp(84px,19vw,190px)]" />
          <p className="mx-auto mt-10 max-w-xl font-serif text-2xl leading-snug text-cream sm:text-3xl">
            You were both there. <span className="italic text-sand">You just didn&apos;t know it.</span>
          </p>
          <p className="mx-auto mt-4 max-w-md text-cream/75">
            Scan the code at your table, record a quick intro, and meet the people in the room tonight.
          </p>
        </div>
      </section>
      <Checker />

      <section className="mx-auto max-w-5xl px-5 py-16">
        <p className="eyebrow text-center">How it works</p>
        <h2 className="mt-3 text-center font-display text-5xl sm:text-6xl">Good people. Better plans.</h2>
        <ol className="mt-12 grid gap-4 sm:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="card p-5 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-forest/20 text-forest">
                <Icon className="h-7 w-7" />
              </span>
              <p className="mt-4 font-serif text-xs font-bold uppercase tracking-caps text-brass">Step {i + 1}</p>
              <p className="mt-1 font-display text-2xl">{title}</p>
              <p className="mt-2 text-sm text-forest/70">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-cream-dark/60">
        <div className="mx-auto grid max-w-5xl gap-10 px-5 py-16 sm:grid-cols-2 sm:items-center">
          <div>
            <p className="eyebrow">Real people. Better conversations. Offline.</p>
            <h2 className="mt-3 font-serif text-4xl leading-tight">The best connections happen during the worst speeches.</h2>
            <p className="mt-4 text-forest/75">
              Every venue gets its own code. Only the people who scanned it can see each other, and every profile and
              video is deleted when the night ends.
            </p>
            <p className="mt-6 font-script text-5xl text-brass">Swipe in person</p>
          </div>
          <div className="card-dark mx-auto w-full max-w-xs p-6 text-center">
            <p className="font-display text-2xl">Fries</p>
            <p className="mt-6 font-serif text-3xl leading-tight">Your people are here.</p>
            <div className="mt-6 flex justify-center -space-x-3">
              {["M", "J", "A", "S"].map((l, i) => (
                <span key={l} className={`grid h-12 w-12 place-items-center rounded-full border-2 border-forest font-display text-lg ${["bg-sand text-forest", "bg-cream text-forest", "bg-brass text-cream", "bg-tomato text-cream"][i]}`}>{l}</span>
              ))}
            </div>
            <span className="btn-cream mt-7 w-full">Meet tonight</span>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-5 py-12 text-center">
        <p className="font-display text-4xl">Same table. Different people.</p>
        <Link href="/admin" className="btn-primary mt-4">Host an event</Link>
        <p className="mt-6 text-xs text-forest/55">Fries for the Table™ · Swipe in person™</p>
      </footer>
    </main>
  );
}
