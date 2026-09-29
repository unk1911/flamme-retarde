#!/usr/bin/env python3
"""Offline checks for the bathers' lines and the news feed in server/baye/baye.py.

Nothing here touches the running service. It imports baye.py (which needs
ablit-central's `webauth` on disk, as the service itself does) and exercises
the pure parts:

  python3 tools/bather_harness.py                 # topic + language tables
  python3 tools/bather_harness.py --prompts 4     # print four built prompts
  python3 tools/bather_harness.py --live 30       # 30 real lines (model only,
                                                  #   no speech; costs tokens)
  python3 tools/bather_harness.py --news          # one live Brave fetch, shaped
  python3 tools/bather_harness.py --shape         # news shaping on a fixture

`--live` needs OPENAI_API_KEY in the environment or in
~/.config/flamme-baye/keys.env; `--news` needs BRAVE_API_KEY where baye.py
looks for it (ablit-central's .env). Neither calls ElevenLabs.
"""
import argparse
import collections
import os
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server" / "baye"))

keys = Path.home() / ".config" / "flamme-baye" / "keys.env"
if keys.exists():
    for ln in keys.read_text().splitlines():
        if "=" in ln and not ln.startswith("#"):
            k, v = ln.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

import baye  # noqa: E402

KINDS = list(baye.BATHER_WHO)
FULL_WORLD = {
    "weather": {"air_c": 31.4, "sea_c": 26.8, "wind_kmh": 12},
    "crypto": {"btc": {"usd": 79000, "eur": 68000, "chg24": -1.4},
               "doge": {"usd": 0.09, "eur": 0, "chg24": 3.1}},
    "news": {"local": [{"t": "Šibenik slavi Dan grada", "src": "HRT", "ts": 0}],
             "national": [{"t": "Plenković otkrio do kada se odgađa primjena "
                                "sidrenih cijena", "src": "Dnevnik.hr",
                           "ts": 0}],
             "world": [{"t": "Trump povukao SAD iz GRECO-a", "src": "N1",
                        "ts": 0}]},
}


def table(n):
    for label, world in (("all feeds up", FULL_WORLD), ("no feeds", {})):
        for aud in ("local", "tourist", "child"):
            c = collections.Counter(baye.bather_topic(world, aud)[0]
                                    for _ in range(n))
            print(f"\n{aud:8s} ({label}), {n} draws")
            for k, v in c.most_common():
                print(f"  {k:11s} {100 * v / n:5.1f}%")
    # Language, per kind over the 100 pids the beach actually has, and
    # overall for an even spread of kinds.
    print("\nlanguage by kind, pids 0-99")
    tot = hr = 0
    for k in KINDS:
        got = [baye.bather_voice(k, p) for p in range(100)]
        h = sum(v["lang"] == "Croatian" for v in got)
        where = collections.Counter(v["where"].split(",")[0] for v in got)
        print(f"  {k:17s} Croatian {h:3d}%   {dict(where.most_common(4))}")
        tot += 100
        hr += h
    print(f"  overall          Croatian {100 * hr / tot:.1f}%")


def prompts(n):
    random.seed(7)
    for i in range(n):
        kind = KINDS[i % len(KINDS)]
        ctx = {"who": "bather", "kind": kind, "doing": "lie", "pid": 13 * i,
               "hour": 15.5, "lang": "en",
               "spot": "on the beach below the promenade"}
        msgs, meta = baye.build_bather_messages(ctx, FULL_WORLD)
        print("=" * 72)
        print(meta)
        print(msgs[1]["content"])
    print("=" * 72)
    print("SYSTEM PROMPT:\n" + baye.PERSONA_BATHER)


def live(n):
    world = FULL_WORLD
    try:
        baye.WORLD.tick()                    # real feeds, if the keys are here
        w = baye.WORLD.snapshot()
        if any(w.values()):
            world = w
    except Exception as e:                   # noqa: BLE001
        print("[world]", e)
    said = collections.defaultdict(list)
    for i in range(n):
        kind = random.choice(KINDS)
        pid = random.randrange(100)
        ctx = {"who": "bather", "kind": kind, "pid": pid, "hour": 15.0,
               "doing": random.choice(["lie", "sit", "stand", "wade"]),
               "lang": "en", "said": said[kind][-4:]}
        msgs, meta = baye.build_bather_messages(ctx, world)
        text, usage = baye.ask_model(msgs, fast=True)
        line, gloss = baye.split_gloss(text)
        said[kind].append(line)
        print(f"{i + 1:2d}. [{meta['lang'][:2]} {meta['topic']:9s}] "
              f"{kind:17s} {line}" + (f"   ({gloss})" if gloss else ""),
              flush=True)


FIXTURE = [
    {"title": "Šibenik slavi svoj dan, predstavlja razvojne planove - HRT",
     "page_age": "2026-09-29T19:59:35", "profile": {"name": "HRT"},
     "meta_url": {"hostname": "vijesti.hrt.hr"}},
    {"title": "Los mejores destinos de Europa para viajar en 2027",
     "page_age": "2026-09-28T10:00:00", "profile": {"name": "Meteored"},
     "meta_url": {"hostname": "www.tiempo.com"}},
    {"title": "Slobodna Dalmacija - Stigli su nam sjajni dječji radovi: evo "
              "kako najmlađi vide svoj Šibenik",
     "page_age": "2026-09-29T05:00:00", "profile": {"name": "Slobodna Dalmacija"},
     "meta_url": {"hostname": "slobodnadalmacija.hr"}},
    {"title": "Iz podmorja šibenske rive izvađeno gotovo dvije tone otpada | "
              "Šibenski Kanal", "page_age": "2026-09-27T12:00:00",
     "profile": {"name": "Sibenskikanal"},
     "meta_url": {"hostname": "sibenskikanal.hr"}},
    {"title": "Novi GNK Šibenik odigrao prvu utakmicu | tportal",
     "page_age": "2026-09-27T08:00:00", "profile": {"name": "Tportal"},
     "meta_url": {"hostname": "www.tportal.hr"}},
    {"title": "Beljo zabio prvijenac za Hrvatsku | tportal",
     "page_age": "2026-09-29T19:00:00", "profile": {"name": "Tportal"},
     "meta_url": {"hostname": "www.tportal.hr"}},
    {"title": "Sud stao na stranu sindikata - Vijesti iz Hrvatske, regije i "
              "svijeta - N1 info", "page_age": "2026-09-29T04:33:59",
     "profile": {"name": "N1info"}, "meta_url": {"hostname": "n1info.hr"}},
    {"title": "Filadelfija. @nultatacka - Pravda Hrvatska",
     "page_age": "2026-09-29T17:31:21", "profile": {"name": "Pravda Hrvatska"},
     "meta_url": {"hostname": "croatia.news-pravda.com"}},
]


def shape():
    for local in (True, False):
        print(f"\nlocal={local}")
        for x in baye.news_shape(FIXTURE, local):
            print(" ", x)


def news():
    out = baye.WORLD._news()
    if not out:
        print("no news (no BRAVE_API_KEY, or every slot failed)")
        return
    for slot, items in out.items():
        print(f"\n{slot}: {len(items)}")
        for x in items:
            print(f"  {x['src']:22s} {x['ts']}  {x['t']}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--draws", type=int, default=10000)
    ap.add_argument("--prompts", type=int, default=0)
    ap.add_argument("--live", type=int, default=0)
    ap.add_argument("--news", action="store_true")
    ap.add_argument("--shape", action="store_true")
    a = ap.parse_args()
    if a.prompts:
        prompts(a.prompts)
    elif a.live:
        live(a.live)
    elif a.news:
        news()
    elif a.shape:
        shape()
    else:
        table(a.draws)
