"""Run: python3 -m pytest worker/tests"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))
from captions import MAX_SECONDS, MAX_WORDS, cues  # noqa: E402


def words(text, start=0.0, step=0.4):
    out, t = [], start
    for w in text.split():
        out.append({"start": t, "end": t + step - 0.05, "word": " " + w})
        t += step
    return out


def test_breaks_at_sentence_end():
    seg = {"start": 0, "end": 4, "text": "", "words": words("Hi, I'm Maya. I'm 29.")}
    assert [c["text"] for c in cues([seg])] == ["Hi, I'm Maya.", "I'm 29."]


def test_long_sentence_is_split_into_short_readable_cues():
    text = "so I work as a product designer and I just moved here from Lisbon and I love climbing and vinyl"
    out = cues([{"start": 0, "end": 10, "text": text, "words": words(text, step=0.3)}])
    assert " ".join(c["text"] for c in out) == text
    assert all(len(c["text"].split()) <= MAX_WORDS for c in out)
    assert all(c["end"] - c["start"] <= MAX_SECONDS + 0.01 for c in out)


def test_cues_are_ordered_and_never_overlap():
    text = "one two three four five six seven eight nine ten eleven twelve"
    w = words(text, step=0.5)
    for x in w:
        x["end"] += 0.3  # Whisper word ends can overlap the next word's start
    out = cues([{"start": 0, "end": 7, "text": text, "words": w}])
    assert all(a["end"] <= b["start"] for a, b in zip(out, out[1:]))
    assert all(c["end"] > c["start"] for c in out)


def test_timings_follow_the_video_clock_across_segments():
    out = cues([
        {"start": 0.5, "end": 2, "text": "", "words": words("Hello there.", start=0.5)},
        {"start": 9.0, "end": 11, "text": "", "words": words("After a pause.", start=9.0)},
    ])
    assert out[0]["start"] == 0.5 and out[1]["start"] == 9.0


def test_segment_without_word_timings_becomes_one_cue():
    assert cues([{"start": 1, "end": 3, "text": " Hello world ", "words": []}]) == [{"start": 1.0, "end": 3.0, "text": "Hello world"}]


def test_empty_and_silent_input():
    assert cues([]) == []
    assert cues([{"start": 0, "end": 1, "text": "  ", "words": [{"start": 0, "end": 1, "word": " "}]}]) == []
