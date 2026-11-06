"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { fetchMessages, sendMessage } from "@/lib/social-actions";
import { MEET_SPOTS, MESSAGE_MAX_LENGTH, type Message } from "@/lib/types";

const POLL_MS = 2500;

export function Chat({ code, matchId, meId, otherName, initial }: {
  code: string; matchId: string; meId: string; otherName: string; initial: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initial);
  const [text, setText] = useState("");
  const [meetOpen, setMeetOpen] = useState(false);
  const [spot, setSpot] = useState("");
  const [wearing, setWearing] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastRef = useRef<string | null>(initial.at(-1)?.createdAt ?? null);

  function merge(incoming: Message[]) {
    if (!incoming.length) return;
    setMessages((cur) => {
      const ids = new Set(cur.map((m) => m.id));
      const added = incoming.filter((m) => !ids.has(m.id));
      if (!added.length) return cur;
      const all = [...cur, ...added].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      lastRef.current = all.at(-1)!.createdAt;
      return all;
    });
  }

  // Poll for new messages (also marks the chat as read).
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const fresh = await fetchMessages(code, matchId, lastRef.current);
        if (alive) merge(fresh);
      } catch { /* network blip: try again next tick */ }
    };
    void tick();
    const id = setInterval(tick, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, [code, matchId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  async function send(kind: "text" | "meet", body: string) {
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      const r = await sendMessage(code, matchId, kind, body);
      if (r.ok && r.message) merge([r.message]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="min-h-[50vh] space-y-2 pb-4">
        {messages.length === 0 && (
          <p className="py-10 text-center font-serif text-lg italic text-forest/70">
            You matched with {otherName}. Say hi, or suggest a spot to meet here at the event.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.fromId === meId;
          if (m.kind === "meet") {
            const [where, ...rest] = m.body.split("\n");
            return (
              <div key={m.id} className={clsx("flex", mine ? "justify-end" : "justify-start")}>
                <div className="max-w-[82%] overflow-hidden rounded-2xl bg-forest text-cream shadow-card">
                  <div className="h-2 bg-checker bg-[length:12px_12px]" />
                  <div className="px-4 py-3">
                    <p className="font-serif text-[10px] font-bold uppercase tracking-caps text-sand">{mine ? "You suggested meeting" : `${otherName} wants to meet`}</p>
                    <p className="mt-1 font-display text-2xl leading-tight">{where}</p>
                    {rest.map((r) => <p key={r} className="mt-1 font-serif text-sm italic text-cream/80">{r}</p>)}
                  </div>
                </div>
              </div>
            );
          }
          return (
            <div key={m.id} className={clsx("flex", mine ? "justify-end" : "justify-start")}>
              <p className={clsx("max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[15px]", mine ? "rounded-br-md bg-forest text-cream" : "rounded-bl-md border border-forest/10 bg-cream-light text-forest")}>
                {m.body}
              </p>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {meetOpen && (
        <div className="card mb-3 space-y-3 p-4">
          <p className="font-display text-2xl leading-none">Where should you meet?</p>
          <div className="flex flex-wrap gap-2">
            {MEET_SPOTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpot(s)}
                className={clsx("rounded-full border px-3 py-1.5 text-sm", spot === s ? "border-forest bg-forest text-cream" : "border-forest/20 text-forest/80")}
              >
                {s}
              </button>
            ))}
          </div>
          <input className="input" placeholder="Or type a spot, e.g. the booth by the window" value={MEET_SPOTS.includes(spot) ? "" : spot} onChange={(e) => setSpot(e.target.value)} maxLength={80} />
          <input className="input" placeholder="I'm wearing… (optional)" value={wearing} onChange={(e) => setWearing(e.target.value)} maxLength={80} />
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={!spot.trim() || sending}
              onClick={async () => {
                await send("meet", `${spot.trim()}${wearing.trim() ? `\nI'm wearing ${wearing.trim()}` : ""}`);
                setMeetOpen(false);
                setSpot("");
                setWearing("");
              }}
            >
              Send
            </button>
            <button type="button" className="btn-ghost" onClick={() => setMeetOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      <form
        className="sticky bottom-3 flex items-end gap-2 rounded-2xl border border-forest/10 bg-cream-light/95 p-2 backdrop-blur"
        onSubmit={(e) => {
          e.preventDefault();
          const body = text;
          setText("");
          void send("text", body);
        }}
      >
        <button type="button" aria-label="Suggest a place to meet" onClick={() => setMeetOpen((o) => !o)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-forest/10 text-lg">
          📍
        </button>
        <textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              (e.currentTarget.form as HTMLFormElement).requestSubmit();
            }
          }}
          maxLength={MESSAGE_MAX_LENGTH}
          placeholder={`Message ${otherName}`}
          className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] text-forest placeholder:text-forest/40 focus:outline-none"
        />
        <button className="btn-primary h-10 px-4" disabled={!text.trim() || sending}>Send</button>
      </form>
    </div>
  );
}
