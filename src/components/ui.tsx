import clsx from "clsx";
import Link from "next/link";

/**
 * Brand marks, set in Caprasimo to match the Fries for the Table logo.
 *  - wordmark: "Fries" (headers)
 *  - lockup:   "Fries / for the / Table" with the two taglines (hero, poster)
 *  - icon:     cream "F" on a green rounded square (app icon)
 */
export function Logo({ tone = "forest", className }: { tone?: "forest" | "cream"; className?: string }) {
  return (
    <span className={clsx("font-display leading-none", tone === "cream" ? "text-cream" : "text-forest", className)}>
      Fries<sup className="ml-0.5 align-super font-sans text-[0.25em] font-semibold">™</sup>
    </span>
  );
}

export function LogoLockup({ tone = "forest", taglines = true, className }: { tone?: "forest" | "cream"; taglines?: boolean; className?: string }) {
  const color = tone === "cream" ? "text-cream" : "text-forest";
  const rule = tone === "cream" ? "bg-cream/50" : "bg-forest/40";
  return (
    <div className={clsx("inline-flex flex-col items-center text-center", color, className)}>
      {taglines && (
        <p className="mb-[0.35em] flex items-center gap-3 font-serif text-[0.14em] font-bold uppercase tracking-caps">
          <span className={clsx("h-px w-[3em]", rule)} />The human connection app<span className={clsx("h-px w-[3em]", rule)} />
        </p>
      )}
      <p className="font-display text-[1em] leading-[0.82]">Fries</p>
      <p className="-my-[0.06em] font-display text-[0.42em] leading-none">for the</p>
      <p className="font-display text-[1em] leading-[0.82]">
        Table<sup className="ml-1 align-top font-sans text-[0.12em] font-semibold">™</sup>
      </p>
      {taglines && <p className="mt-[0.45em] font-serif text-[0.16em] font-bold uppercase tracking-[0.3em]">Swipe in person™</p>}
    </div>
  );
}

export function AppIcon({ className }: { className?: string }) {
  return (
    <span className={clsx("grid place-items-center rounded-[22%] bg-forest font-display text-cream", className)} aria-hidden>
      F
    </span>
  );
}

export function Brand({ href = "/", small = false, tone = "forest" }: { href?: string; small?: boolean; tone?: "forest" | "cream" }) {
  return (
    <Link href={href} className="inline-flex items-baseline" aria-label="Fries home">
      <Logo tone={tone} className={small ? "text-[26px]" : "text-[34px]"} />
    </Link>
  );
}

/** The brand checkerboard as a thin divider strip. */
export function Checker({ className }: { className?: string }) {
  return <div className={clsx("h-3 w-full bg-checker bg-checker opacity-90", className)} aria-hidden />;
}

export function StatusPill({ tone, children }: { tone: "live" | "scheduled" | "ended" | "muted"; children: React.ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
        tone === "live" && "bg-forest text-cream",
        tone === "scheduled" && "bg-brass/15 text-brass",
        tone === "ended" && "bg-forest/5 text-forest/50",
        tone === "muted" && "border border-forest/15 text-forest/70",
      )}
    >
      {tone === "live" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sand" />}
      {children}
    </span>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "ok"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={clsx(
        "rounded-xl border px-4 py-3 text-sm",
        tone === "info" && "border-forest/15 bg-cream-light text-forest/80",
        tone === "error" && "border-tomato/40 bg-tomato/10 text-tomato",
        tone === "ok" && "border-forest/20 bg-forest/10 text-forest",
      )}
    >
      {children}
    </div>
  );
}

export function Avatar({ name, photo, size = "md" }: { name: string; photo: string | null; size?: "md" | "lg" }) {
  const cls = size === "lg" ? "aspect-[4/5] w-full rounded-3xl" : "aspect-[4/5] w-full rounded-2xl";
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt={name} className={clsx(cls, "object-cover")} />;
  }
  return (
    <div className={clsx(cls, "grid place-items-center bg-forest font-display text-5xl text-cream")}>
      {(name || "?").slice(0, 1).toUpperCase()}
    </div>
  );
}
