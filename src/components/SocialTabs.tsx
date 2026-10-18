"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect, useState } from "react";
import { inboxCount } from "@/lib/social-actions";

/** Discover / Matches / You. The badge counts new matches and unread chats, refreshed every few seconds. */
export function SocialTabs({ code, active, matchesLabel, initialCount }: {
  code: string; active: "deck" | "matches" | "me"; matchesLabel: string; initialCount: number;
}) {
  const [count, setCount] = useState(initialCount);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const n = await inboxCount(code);
        if (alive) setCount(n);
      } catch { /* offline for a moment: keep the last count */ }
    };
    const id = setInterval(tick, 8000);
    return () => { alive = false; clearInterval(id); };
  }, [code]);

  const tab = (key: typeof active, href: string, label: string, badge?: number) => (
    <Link
      href={href}
      className={clsx(
        "relative flex-1 rounded-full py-2 text-center text-sm font-semibold transition",
        active === key ? "bg-white/10 text-white" : "text-haze-300 hover:text-white",
      )}
    >
      {label}
      {badge ? <span className="ml-1.5 inline-grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1.5 text-[11px] text-white">{badge}</span> : null}
    </Link>
  );

  return (
    <nav className="sticky bottom-3 z-20 mx-auto mt-6 flex max-w-sm gap-1 rounded-full border border-white/10 bg-night-900/90 p-1 backdrop-blur">
      {tab("deck", `/l/${code}/people`, "Discover")}
      {tab("matches", `/l/${code}/matches`, matchesLabel, count)}
      {tab("me", `/l/${code}/me`, "You")}
    </nav>
  );
}
