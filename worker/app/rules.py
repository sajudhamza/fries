"""
Deterministic extraction for the fields a small LLM is most likely to get wrong or invent:
age, height and pronouns. Everything here only fires on an explicit statement in the transcript.

Also holds the "did they actually say it?" checks used to filter the LLM's output.
"""
from __future__ import annotations

import re

_UNITS = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7,
    "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
    "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19,
}
_TENS = {"twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90}

_UNIT_RE = "|".join(sorted(_UNITS, key=len, reverse=True))
_TENS_RE = "|".join(_TENS)
# "29", "twenty nine", "twenty-nine", "thirty", "nineteen"
NUM = rf"(?:\d{{1,3}}|(?:{_TENS_RE})(?:[\s-](?:{_UNIT_RE}))?|{_UNIT_RE})"


def to_int(text: str) -> int | None:
    t = text.strip().lower().replace("-", " ")
    if t.isdigit():
        return int(t)
    parts = t.split()
    if len(parts) == 1:
        return _UNITS.get(parts[0], _TENS.get(parts[0]))
    if len(parts) == 2 and parts[0] in _TENS and parts[1] in _UNITS and _UNITS[parts[1]] < 10:
        return _TENS[parts[0]] + _UNITS[parts[1]]
    return None


# Things that follow "I'm <number>" when it is NOT an age.
_NOT_AGE_AFTER = (
    r"(?!\s*(?:%|percent|minutes?|mins?|hours?|days?|weeks?|months?|kids?|children|times|dollars|bucks|k\b|"
    r"feet|foot|ft|inch|inches|cm|centimet|met(?:er|re)s?|kilos?|kg|pounds|lbs|miles?|km|"
    r"o'?clock|am\b|pm\b|[:'’\"]|\.\d|,\d))"
)


def find_age(text: str) -> int | None:
    t = text.lower()
    patterns = [
        rf"\b(?P<n>{NUM})[\s-]+years?[\s-]+old\b",
        rf"\b(?:i am|i'm|im)\s+(?:a\s+)?(?P<n>{NUM})[\s-]+years?\b",
        rf"\bmy age is\s+(?P<n>{NUM})\b",
        rf"\bi\s+just\s+turned\s+(?P<n>{NUM})\b",
        rf"\b(?:i am|i'm|im)\s+(?P<n>{NUM})\b{_NOT_AGE_AFTER}",
    ]
    for p in patterns:
        for m in re.finditer(p, t):
            n = to_int(m.group("n"))
            if n is not None and 18 <= n <= 99:
                return n
    return None


_FEET_WORDS = {"four": 4, "five": 5, "six": 6, "seven": 7, "4": 4, "5": 5, "6": 6, "7": 7}
_FEET = r"(?:four|five|six|seven|[4-7])"
_INCH = rf"(?:\d{{1,2}}|{_UNIT_RE})"


def _fmt_ft(ft: int, inch: int) -> str | None:
    if 4 <= ft <= 7 and 0 <= inch <= 11:
        return f"{ft}'{inch}\""
    return None


def find_height(text: str) -> str | None:
    t = text.lower().replace("’", "'").replace("”", '"').replace("″", '"').replace("′", "'")

    # 178 cm / 178 centimeters
    m = re.search(r"\b(1[4-9]\d|2[0-2]\d)\s*(?:cm|centimet(?:er|re)s?)\b", t)
    if m:
        return f"{m.group(1)} cm"
    # 1.78 m / 1,78 meters
    m = re.search(r"\b(1)[.,](\d{2})\s*(?:m|met(?:er|re)s?)\b", t)
    if m:
        cm = int(m.group(1)) * 100 + int(m.group(2))
        if 140 <= cm <= 229:
            return f"{cm} cm"
    # 5'7", 5' 7, 5 ft 7 in, five foot seven, six feet, 6 foot 2 inches
    m = re.search(
        rf"\b(?P<ft>{_FEET})\s*(?:'|ft\.?|feet|foot)(?:\s*(?:and\s+)?(?P<in>{_INCH})\s*(?:\"|''|in\.?|inch(?:es)?)?)?(?![\d])",
        t,
    )
    if m:
        ft = _FEET_WORDS.get(m.group("ft"))
        inch = to_int(m.group("in")) if m.group("in") else 0
        if ft is not None and inch is not None:
            return _fmt_ft(ft, inch)
    # Bare "five seven" / "5 7": only right after "I'm / about / around" or right before "tall".
    m = re.search(
        rf"\b(?:i'm|i am|im|about|around|roughly|like)\s+(?:about\s+|around\s+)?(?P<ft>{_FEET})[\s-](?P<in>{_INCH})\b(?!\s*(?:years|year|pm|am|minutes|o'?clock))",
        t,
    ) or re.search(rf"\b(?P<ft>{_FEET})[\s-](?P<in>{_INCH})\s+tall\b", t)
    if m and not re.match(r"\s*(?:ty|teen)", t[m.end("ft"):]):
        ft = _FEET_WORDS.get(m.group("ft"))
        inch = to_int(m.group("in"))
        if ft is not None and inch is not None:
            return _fmt_ft(ft, inch)
    return None


_SUBJ = {"she": "she/her", "he": "he/him", "they": "they/them"}


def find_pronouns(text: str) -> str | None:
    t = text.lower()
    m = re.search(
        r"\b(?:my pronouns are|pronouns are|pronouns|i go by|i use)\s+(she|he|they|xe|ze)\b(?:\s*(?:/|and|slash|,)\s*(her|him|them|hers|his|theirs|xem|zir|they|she|he)\b)?",
        t,
    )
    if m:
        return f"{m.group(1)}/{m.group(2)}" if m.group(2) else _SUBJ.get(m.group(1), m.group(1))
    m = re.search(r"\b(she|he|they)\s*/\s*(her|him|them|they|she|he)\b", t)
    if m:
        return f"{m.group(1)}/{m.group(2)}"
    return None


_NOT_NAMES = {
    "here", "so", "from", "just", "really", "very", "super", "excited", "happy", "glad", "new", "back", "a",
    "an", "the", "not", "currently", "originally", "also", "still", "kind", "pretty", "into", "looking",
    "hoping", "going", "trying", "single", "married", "working", "based", "living", "tired", "good", "fine",
}


def find_name(text: str) -> str | None:
    """High-precision name patterns only. Relies on the transcriber capitalising proper nouns."""
    for p in (
        r"\bmy name(?:'s| is)\s+([A-Z][a-zA-Z'\-]{1,30})",
        r"\b(?:call me|this is|I'm|I am)\s+([A-Z][a-zA-Z'\-]{1,30})\b",
    ):
        for m in re.finditer(p, text):
            name = m.group(1)
            if name.lower() not in _NOT_NAMES and name not in {"I", "I'm"}:
                return name
    return None


# --- "did they actually say it?" ---------------------------------------------------------------

_STOP = set(
    "a an the and or but so to of in on at for with from by as is am are was were be been being i me my mine "
    "you your we our they them their he she him her it its this that these those there here what who whom which "
    "when where why how all any both each few more most other some such no nor not only own same than too very can "
    "will just don should now do does did have has had having about into over under again further then once also "
    "really like yeah um uh well kind sort lot lots love loves loving enjoy enjoys enjoying into".split()
)


def _stem(w: str) -> str:
    for suf in ("ings", "ing", "ers", "er", "ies", "es", "ed", "s"):
        if len(w) > len(suf) + 3 and w.endswith(suf):
            return w[: -len(suf)]
    return w


def words(text: str) -> list[str]:
    return re.findall(r"[a-zà-ÿ0-9']+", text.lower())


def content_stems(text: str) -> set[str]:
    return {_stem(w) for w in words(text) if w not in _STOP and len(w) > 2}


def support(phrase: str, source_stems: set[str]) -> float:
    """Share of the phrase's content words that also occur in the source (1.0 = all said)."""
    stems = content_stems(phrase)
    if not stems:
        return 0.0
    return sum(1 for s in stems if s in source_stems) / len(stems)


def split_sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s.strip()]
