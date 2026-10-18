"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { swipe } from "@/lib/social-actions";

export interface DeckCard {
  id: string;
  name: string;
  age: number | null;
  photo: string | null;
  facts: string[]; // height, pronouns, occupation…
  bio: string;
  hobbies: string[];
  lookingFor: string;
}

const THRESHOLD = 110; // px of horizontal drag that counts as a decision

export function SwipeDeck({ code, cards, likeLabel, passLabel, matchedTitle, resetAction }: {
  code: string;
  cards: DeckCard[];
  likeLabel: string;
  passLabel: string;
  matchedTitle: string;
  resetAction: () => Promise<void>;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [leaving, setLeaving] = useState<null | "like" | "pass">(null);
  const [details, setDetails] = useState(false);
  const [match, setMatch] = useState<null | { matchId: string; name: string; photo: string | null }>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  // Latest drag offset, read on release. State alone can lag behind a fast flick.
  const offset = useRef({ x: 0, y: 0 });

  const card = cards[index];
  const next = cards[index + 1];

  const decide = useCallback(
    (decision: "like" | "pass") => {
      if (!card || leaving) return;
      setLeaving(decision);
      setDetails(false);
      const target = card;
      setTimeout(() => {
        setIndex((i) => i + 1);
        setLeaving(null);
        setDrag({ x: 0, y: 0, active: false });
      }, 220);
      void swipe(code, target.id, decision).then((r) => {
        if (r.ok && r.matched) setMatch({ matchId: r.matchId, name: r.other.name, photo: r.other.photo });
      });
    },
    [card, code, leaving],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (match) return;
      if (e.key === "ArrowRight") decide("like");
      if (e.key === "ArrowLeft") decide("pass");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide, match]);

  function onPointerDown(e: React.PointerEvent) {
    if (leaving) return;
    start.current = { x: e.clientX, y: e.clientY };
    offset.current = { x: 0, y: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ x: 0, y: 0, active: true });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!start.current) return;
    offset.current = { x: e.clientX - start.current.x, y: e.clientY - start.current.y };
    setDrag({ ...offset.current, active: true });
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!start.current) return;
    // Include the release position itself, in case no move event arrived for it.
    const { x, y } = { x: e.clientX - start.current.x, y: e.clientY - start.current.y };
    const dx = Math.abs(x) > Math.abs(offset.current.x) ? x : offset.current.x;
    const dy = Math.abs(y) > Math.abs(offset.current.y) ? y : offset.current.y;
    start.current = null;
    offset.current = { x: 0, y: 0 };
    if (dx > THRESHOLD) return decide("like");
    if (dx < -THRESHOLD) return decide("pass");
    // Barely moved: treat as a tap and toggle the details.
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) setDetails((d) => !d);
    setDrag({ x: 0, y: 0, active: false });
  }

  if (!card) {
    return (
      <div className="card mx-auto mt-4 grid max-w-sm place-items-center gap-4 px-6 py-14 text-center">
        <p className="font-display text-2xl font-bold">You&apos;ve seen everyone</p>
        <p className="text-sm text-haze-300">New people show up here as they join the event.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn-primary" onClick={() => { setIndex(0); router.refresh(); }}>Check for new people</button>
          <form action={resetAction}>
            <button className="btn-ghost">See skipped people again</button>
          </form>
        </div>
        {match && <MatchOverlay code={code} match={match} title={matchedTitle} onClose={() => setMatch(null)} />}
      </div>
    );
  }

  const x = leaving === "like" ? 600 : leaving === "pass" ? -600 : drag.x;
  const rotate = x / 18;
  const likeOpacity = Math.max(0, Math.min(1, x / THRESHOLD));
  const passOpacity = Math.max(0, Math.min(1, -x / THRESHOLD));

  return (
    <div className="mx-auto mt-1 max-w-sm select-none">
      <p className="mb-3 text-right text-sm text-haze-500">{cards.length - index} to go</p>
      <div className="relative aspect-[3/4] w-full">
        {next && <CardFace card={next} className="scale-[0.96] opacity-70" />}
        <div
          className="absolute inset-0 touch-none"
          style={{
            transform: `translate(${x}px, ${leaving ? drag.y : drag.y * 0.3}px) rotate(${rotate}deg)`,
            transition: drag.active && !leaving ? "none" : "transform 220ms ease-out",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onLostPointerCapture={(e) => start.current && onPointerUp(e)}
        >
          <CardFace card={card} details={details} />
          <span className="pointer-events-none absolute left-5 top-6 -rotate-12 rounded-lg border-4 border-emerald-400 px-3 py-1 text-2xl font-black uppercase text-emerald-400" style={{ opacity: likeOpacity }}>
            {likeLabel}
          </span>
          <span className="pointer-events-none absolute right-5 top-6 rotate-12 rounded-lg border-4 border-rose-400 px-3 py-1 text-2xl font-black uppercase text-rose-400" style={{ opacity: passOpacity }}>
            {passLabel}
          </span>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-6">
        <button
          aria-label={passLabel}
          onClick={() => decide("pass")}
          className="grid h-16 w-16 place-items-center rounded-full border border-white/15 bg-night-800 text-2xl text-rose-300 transition hover:scale-105 active:scale-95"
        >
          ✕
        </button>
        <button
          aria-label="Details"
          onClick={() => setDetails((d) => !d)}
          className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-night-800 text-sm font-bold text-haze-300 transition hover:scale-105"
        >
          i
        </button>
        <button
          aria-label={likeLabel}
          onClick={() => decide("like")}
          className="grid h-16 w-16 place-items-center rounded-full bg-rose-500 text-2xl text-white shadow-lg shadow-rose-500/30 transition hover:scale-105 active:scale-95"
        >
          ♥
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-haze-500">Swipe right to {likeLabel.toLowerCase()}, left to {passLabel.toLowerCase()}. Tap the card for more.</p>

      {match && <MatchOverlay code={code} match={match} title={matchedTitle} onClose={() => setMatch(null)} />}
    </div>
  );
}

function CardFace({ card, details = false, className }: { card: DeckCard; details?: boolean; className?: string }) {
  return (
    <div className={clsx("absolute inset-0 overflow-hidden rounded-3xl border border-white/10 bg-night-800 shadow-2xl", className)}>
      {card.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.photo} alt="" draggable={false} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center bg-gradient-to-br from-rose-500/40 to-night-700 font-display text-8xl font-bold text-white/90">
          {(card.name || "?").slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className={clsx("absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-5 pt-20 transition-all", details && "top-0 overflow-y-auto bg-black/85 pt-6")}>
        <p className="font-display text-3xl font-bold leading-tight">
          {card.name}
          {card.age ? <span className="font-normal text-white/80">, {card.age}</span> : null}
        </p>
        {card.facts.length > 0 && <p className="mt-1 text-sm text-white/75">{card.facts.join(" · ")}</p>}
        {details ? (
          <div className="mt-4 space-y-4 text-sm">
            {card.bio && <p className="leading-relaxed text-white/90">{card.bio}</p>}
            {card.lookingFor && (
              <div>
                <p className="label">Looking for</p>
                <p className="text-white/90">{card.lookingFor}</p>
              </div>
            )}
            {card.hobbies.length > 0 && (
              <div>
                <p className="label">Into</p>
                <div className="flex flex-wrap gap-1.5">{card.hobbies.map((h) => <span key={h} className="chip">{h}</span>)}</div>
              </div>
            )}
          </div>
        ) : (
          card.hobbies.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {card.hobbies.slice(0, 3).map((h) => <span key={h} className="chip bg-white/15">{h}</span>)}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function MatchOverlay({ code, match, title, onClose }: {
  code: string; match: { matchId: string; name: string; photo: string | null }; title: string; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-night-950/90 p-6 backdrop-blur" role="dialog" aria-modal="true">
      <div className="w-full max-w-xs text-center">
        <p className="font-display text-4xl font-bold text-rose-300">{title}</p>
        <p className="mt-2 text-haze-300">You and {match.name} liked each other.</p>
        <div className="mx-auto mt-6 h-40 w-32 overflow-hidden rounded-2xl border-2 border-rose-400">
          {match.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={match.photo} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-gradient-to-br from-rose-500/40 to-night-700 font-display text-5xl font-bold">
              {(match.name || "?").slice(0, 1)}
            </div>
          )}
        </div>
        <div className="mt-8 grid gap-2">
          <Link href={`/l/${code}/matches/${match.matchId}`} className="btn-primary py-3.5 text-base">Say hi</Link>
          <button className="btn-ghost" onClick={onClose}>Keep swiping</button>
        </div>
      </div>
    </div>
  );
}
