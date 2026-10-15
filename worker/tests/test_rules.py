"""Run: python3 -m pytest worker/tests  (or: python3 worker/tests/test_rules.py)"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))
from rules import find_age, find_gender, find_height, find_interest, find_name, find_pronouns, support, content_stems  # noqa: E402

AGE = [
    ("Hey, I'm Maya, I'm 29, about five seven", 29),
    ("I'm twenty-nine years old and I work in tech", 29),
    ("I am a 31 year old nurse", 31),
    ("I just turned thirty", 30),
    ("I'm 30 minutes away from here", None),
    ("I'm 5'10\" and I love hiking", None),
    ("I'm 12 kids deep in a family of chaos", None),
    ("I have two cats", None),
    ("I'm five seven", None),
]
HEIGHT = [
    ("I'm about five seven, I work as a designer", "5'7\""),
    ("I'm 5'10\" and I love hiking", "5'10\""),
    ("I am six foot two", "6'2\""),
    ("I'm six feet tall", "6'0\""),
    ("I'm 178 cm", "178 cm"),
    ("I'm 1.82 meters tall", "182 cm"),
    ("I'm 5 ft 4 in", "5'4\""),
    ("I'm about five, five seven tall", "5'7\""),
    ("I'm 29 and I love climbing", None),
    ("I'm about twenty five", None),
    ("we arrived at five ten", None),
]
PRONOUNS = [
    ("My pronouns are she/her", "she/her"),
    ("pronouns they them", "they/them"),
    ("I go by he and him", "he/him"),
    ("I'm Sam, she/they", "she/they"),
    ("She told me to come", None),
]
NAMES = [
    ("Hey, I'm Maya, I'm 29", "Maya"),
    ("Hi everyone, my name is Jordan and I'm a chef", "Jordan"),
    ("Hi, I'm really excited to be here, I'm Priya", "Priya"),
    ("I'm so happy to be here", None),
]

GENDER = [
    ("I'm a 29 year old guy from Boston", "man"),
    ("As a woman in tech I love meetups", "woman"),
    ("As a woman who just moved here, I'm still meeting people", "woman"),
    ("I'm a guy who loves cooking", "man"),
    ("I'm a pretty chill dude", "man"),
    ("I'm non-binary and I love art", "nonbinary"),
    ("I'm a product designer", None),
    ("I'm a big fan of jazz", None),
    ("My sister is a woman of many talents", None),
]
INTEREST = [
    ("Tonight I'm hoping to meet a nice guy", "men"),
    ("I'm looking for a girlfriend honestly", "women"),
    ("I'm into women", "women"),
    ("looking for men or women, I'm open", "everyone"),
    ("I'm bi so anyone really", "everyone"),
    ("I'm hoping to meet new friends", None),
    ("I'm looking for a dance partner", None),
]


def test_all():
    failures = []
    for fn, cases in ((find_age, AGE), (find_height, HEIGHT), (find_pronouns, PRONOUNS), (find_name, NAMES),
                      (find_gender, GENDER), (find_interest, INTEREST)):
        for text, want in cases:
            got = fn(text)
            if got != want:
                failures.append(f"{fn.__name__}({text!r}) = {got!r}, want {want!r}")
    src = content_stems("I love climbing and vinyl and natural wine, and I'm hoping to meet new friends")
    assert support("climbing", src) == 1.0
    assert support("rock climbing", src) == 0.5
    assert support("skydiving", src) == 0.0
    assert not failures, "\n".join(failures)


if __name__ == "__main__":
    test_all()
    print("all rule tests passed")
