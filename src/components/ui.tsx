import clsx from "clsx";
import Link from "next/link";

export function Brand({ href = "/", small = false }: { href?: string; small?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2">
      <span className={clsx("grid place-items-center rounded-xl bg-rose-500 font-display font-bold text-white", small ? "h-7 w-7 text-sm" : "h-9 w-9 text-base")}>
        P
      </span>
      <span className={clsx("font-display font-bold tracking-tight", small ? "text-lg" : "text-xl")}>PDA</span>
    </Link>
  );
}

export function StatusPill({ tone, children }: { tone: "live" | "scheduled" | "ended" | "muted"; children: React.ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone === "live" && "bg-emerald-400/10 text-emerald-300",
        tone === "scheduled" && "bg-citrus-400/10 text-citrus-400",
        tone === "ended" && "bg-white/5 text-haze-500",
        tone === "muted" && "bg-white/5 text-haze-300",
      )}
    >
      {tone === "live" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />}
      {children}
    </span>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "ok"; children: React.ReactNode }) {
  return (
    <div
      className={clsx(
        "rounded-xl border px-4 py-3 text-sm",
        tone === "info" && "border-white/10 bg-white/[.04] text-haze-300",
        tone === "error" && "border-rose-500/40 bg-rose-500/10 text-rose-300",
        tone === "ok" && "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
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
    <div className={clsx(cls, "grid place-items-center bg-gradient-to-br from-rose-500/40 to-night-700 font-display text-5xl font-bold text-white/90")}>
      {(name || "?").slice(0, 1).toUpperCase()}
    </div>
  );
}
