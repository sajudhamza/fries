/** WebVTT for intro-video captions. */
import type { Caption } from "./types";

function stamp(s: number): string {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3_600_000), m = Math.floor(ms / 60_000) % 60, sec = Math.floor(ms / 1000) % 60, rest = ms % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(sec)}.${p(rest, 3)}`;
}

/** Cue text is plain text: escape markup and anything that could end the cue early. */
const clean = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\s+/g, " ").trim();

export function toVtt(cues: Caption[]): string {
  return "WEBVTT\n\n" + cues.map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${clean(c.text)}\n`).join("\n");
}

