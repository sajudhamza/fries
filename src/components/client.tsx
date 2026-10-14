"use client";

import { useEffect, useState } from "react";

/** Shows a timestamp in the viewer's own timezone (the server doesn't know it). */
export function LocalTime({ iso, mode = "datetime" }: { iso: string; mode?: "datetime" | "time" | "relative" }) {
  const [text, setText] = useState("");
  useEffect(() => {
    const d = new Date(iso);
    if (mode === "time") setText(d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    else if (mode === "relative") {
      const mins = Math.round((d.getTime() - Date.now()) / 60_000);
      const abs = Math.abs(mins);
      const span = abs < 60 ? `${abs} min` : abs < 48 * 60 ? `${Math.round(abs / 60)} h` : `${Math.round(abs / 1440)} days`;
      setText(mins >= 0 ? `in ${span}` : `${span} ago`);
    } else setText(d.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }));
  }, [iso, mode]);
  return <time dateTime={iso} suppressHydrationWarning>{text || " "}</time>;
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local has no timezone, so we submit the ISO instant computed in the admin's browser. */
export function DateTimeField({ name, label, defaultValue, required }: { name: string; label: string; defaultValue?: string | null; required?: boolean }) {
  const [local, setLocal] = useState("");
  useEffect(() => setLocal(toLocalInput(defaultValue)), [defaultValue]);
  const iso = local ? new Date(local).toISOString() : "";
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input type="datetime-local" className="input" value={local} onChange={(e) => setLocal(e.target.value)} required={required} />
      <input type="hidden" name={name} value={iso} />
    </label>
  );
}

export function CopyButton({ text, label = "Copy link" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}

/** Submit button that asks for confirmation first (for destructive actions). */
export function ConfirmSubmit({ message, className, children }: { message: string; className?: string; children: React.ReactNode }) {
  return (
    <button type="submit" className={className} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}

export function PrintButton() {
  return <button type="button" className="btn-primary print:hidden" onClick={() => window.print()}>Print poster</button>;
}
