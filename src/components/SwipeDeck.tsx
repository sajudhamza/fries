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
        <p className="font-display text-3xl leading-none">You&apos;ve seen everyone</p>
        <p className="text-sm text-forest/70">New people show up here as they join the event.</p>
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
      <p className="mb-3 text-right text-sm text-forest/55">{cards.length - index} to go</p>
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
          <span className="pointer-events-none absolute left-5 top-6 -rotate-12 rounded-xl border-[3px] border-cream bg-forest/80 px-3 py-1 font-display text-2xl uppercase text-cream" style={{ opacity: likeOpacity }}>
            {likeLabel}
          </span>
          <span className="pointer-events-none absolute right-5 top-6 rotate-12 rounded-xl border-[3px] border-cream bg-tomato/85 px-3 py-1 font-display text-2xl uppercase text-cream" style={{ opacity: passOpacity }}>
            {passLabel}
          </span>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-6">
        <button
          aria-label={passLabel}
          onClick={() => decide("pass")}
          className="grid h-16 w-16 place-items-center rounded-full border border-forest/15 bg-cream-light text-2xl text-tomato shadow-card transition hover:scale-105 active:scale-95"
        >
          ✕
        </button>
        <button
          aria-label="Details"
          onClick={() => setDetails((d) => !d)}
          className="grid h-11 w-11 place-items-center rounded-full border border-forest/15 bg-cream-light font-serif text-sm font-bold italic text-forest/70 transition hover:scale-105"
        >
          i
        </button>
        <button
          aria-label={likeLabel}
          onClick={() => decide("like")}
          className="grid h-16 w-16 place-items-center rounded-full bg-forest text-2xl text-cream shadow-lift transition hover:scale-105 active:scale-95"
        >
          ♥
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-forest/55">Swipe right to {likeLabel.toLowerCase()}, left to {passLabel.toLowerCase()}. Tap the card for more.</p>

      {match && <MatchOverlay code={code} match={match} title={matchedTitle} onClose={() => setMatch(null)} />}
    </div>
  );
}

function CardFace({ card, details = false, className }: { card: DeckCard; details?: boolean; className?: string }) {
  return (
    <div className={clsx("absolute inset-0 overflow-hidden rounded-3xl bg-forest shadow-lift", className)}>
      {card.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.photo} alt="" draggable={false} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center bg-forest bg-candle font-display text-[150px] text-cream/90">
          {(card.name || "?").slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className={clsx("absolute inset-x-0 bottom-0 bg-gradient-to-t from-forest-ink/95 via-forest-deep/75 to-transparent p-5 pt-24 text-cream transition-all", details && "top-0 overflow-y-auto bg-forest-deep/95 pt-6")}>
        <p className="font-display text-[34px] leading-none">
          {card.name}
          {card.age ? <span className="text-sand">, {card.age}</span> : null}
        </p>
        {card.facts.length > 0 && <p className="mt-2 font-serif text-sm italic text-cream/80">{card.facts.join(" · ")}</p>}
        {details ? (
          <div className="mt-4 space-y-4 text-sm">
            {card.bio && <p className="font-serif text-base leading-relaxed text-cream/95">{card.bio}</p>}
            {card.lookingFor && (
              <div>
                <p className="mb-1 font-serif text-[10px] font-bold uppercase tracking-caps text-sand">Looking for</p>
                <p className="text-cream/90">{card.lookingFor}</p>
              </div>
            )}
            {card.hobbies.length > 0 && (
              <div>
                <p className="mb-1.5 font-serif text-[10px] font-bold uppercase tracking-caps text-sand">Into</p>
                <div className="flex flex-wrap gap-1.5">{card.hobbies.map((h) => <span key={h} className="rounded-full bg-cream/15 px-3 py-1 text-xs text-cream">{h}</span>)}</div>
              </div>
            )}
          </div>
        ) : (
          card.hobbies.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {card.hobbies.slice(0, 3).map((h) => <span key={h} className="rounded-full bg-cream/15 px-3 py-1 text-xs text-cream">{h}</span>)}
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-forest/95 bg-candle p-6 text-cream backdrop-blur" role="dialog" aria-modal="true">
      <div className="w-full max-w-xs text-center">
        <p className="font-display text-5xl leading-none text-cream">{title}</p>
        <p className="mt-3 font-serif italic text-cream/80">You and {match.name} liked each other.</p>
        <div className="mx-auto mt-7 h-44 w-36 -rotate-3 overflow-hidden rounded-2xl border-4 border-cream shadow-lift">
          {match.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={match.photo} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-sand font-display text-6xl text-forest">
              {(match.name || "?").slice(0, 1)}
            </div>
          )}
        </div>
        <p className="mt-6 font-script text-4xl leading-none text-sand">Go say hi in person</p>
        <div className="mt-6 grid gap-2">
          <Link href={`/l/${code}/matches/${match.matchId}`} className="btn-cream py-3.5 text-base">Say hi</Link>
          <button className="btn border border-cream/30 text-cream hover:bg-cream/10" onClick={onClose}>Keep swiping</button>
        </div>
      </div>
    </div>
  );
}
