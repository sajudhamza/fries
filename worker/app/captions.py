"""Turns Whisper's timed words into short caption cues people can read over the intro video."""

MAX_WORDS = 8  # per cue: one or two short lines on a phone
MAX_SECONDS = 3.5  # per cue
MAX_CUES = 200  # a 60-second intro needs ~25


def cues(segments: list[dict]) -> list[dict]:
    """segments: [{"start", "end", "text", "words": [{"start", "end", "word"}]}] -> [{"start", "end", "text"}].

    Cues break at sentence ends, after MAX_WORDS words, or after MAX_SECONDS. Segments without word
    timings become one cue each.
    """
    out: list[dict] = []
    for seg in segments:
        words = [w for w in seg.get("words") or [] if str(w.get("word", "")).strip()]
        if not words:
            text = str(seg.get("text", "")).strip()
            if text:
                out.append({"start": float(seg["start"]), "end": float(seg["end"]), "text": text})
            continue
        cur: list[dict] = []
        for w in words:
            if cur and (len(cur) >= MAX_WORDS or float(w["end"]) - float(cur[0]["start"]) > MAX_SECONDS):
                out.append(_cue(cur))
                cur = []
            cur.append(w)
            if str(w["word"]).strip()[-1:] in ".?!":
                out.append(_cue(cur))
                cur = []
        if cur:
            out.append(_cue(cur))
    # Never let a cue run into the next one.
    for a, b in zip(out, out[1:]):
        a["end"] = min(a["end"], b["start"])
    return [c for c in out if c["end"] > c["start"]][:MAX_CUES]


def _cue(words: list[dict]) -> dict:
    return {
        "start": round(float(words[0]["start"]), 2),
        "end": round(float(words[-1]["end"]), 2),
        "text": " ".join(str(w["word"]).strip() for w in words),
    }
