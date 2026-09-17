# Real-time commands: from one label, one sequence, to a plan she can enter

> Misha, 17 Sep 2026: *"say we are in the kabine, right: and i tell her: chase
> away that pug out, and she says something witty but doesn't do it... or maybe
> something more concrete: i tell her to get down on her knees, and eventho she
> knows how to do it if i spray her, she says something but doesn't actually get
> down on her knees.... she should .. or, if i ask to pour some wine, she
> executes her entire routine: she leaves the hut, re-enters, and pours, that's
> like a pre-recorded sequence.. she has no concept that she is already in the
> hut and the wine is already poured in the glass.... like i think i'm perhaps
> asking for science-fiction level stuff... to basically ask for stuff, and it
> gets done in real-time u know.."*

Three complaints and three different bugs, and none of them is science fiction.
Line numbers in this document are as of this branch.

- **The kneel** was one table entry wide. `submit` is eleven seconds of
  authored pose that only the hose could reach. Prototype (b) below.
- **The wine** is not a missing feature, it is a sequence with two legs walked
  outdoors nailed to the front of it. Measured, asked from `dwell`: she walked
  **1.58 m out onto the concrete**, spent **3.2 s outside the room she was
  already standing in**, and then poured **7.6 s** of wine into a glass that was
  already full. 16.2 s, and the state at the end was the state at the start.
  Prototype (a) below.
- **The pug** is the honest one, and the answer is not "she has no concept". The
  pug is real (`DOG`, 43-jadrija.js:30134), his beat straddles the kabina's door
  on purpose, and he comes in after you and gets up on the cot. What is missing
  is not a world model. It is one line: *nothing in this game can make the dog
  leave a room except you leaving it first*. See §3.

---

## 1. The atomic actions that already exist

Her figure carries **28 clips** — read off `raw().testFigure.clips` in the
built page, which is the honest list rather than the one in
`tools/blender/human_mh.py`:

```
idle wave notice kneel crawl getup flip walk swim tread cartwheel soak
shimmy twerk heart note ballet wine untie submit kept recline cradle situp
knees flare firestarter cast
```

`stepShow` (43-jadrija.js:34169) is a switch over **46 phases**. A phase is not
an atomic action — most phases are one leg of a sequence. What follows is the
list of things that are *separable*: each one has a precondition, an effect, and
an entry that is already a single call.

### 1a. The movers — five of them, and they are the whole of "go there"

| call | line | needs | changes |
|---|---|---|---|
| `showTo(t, s, dt, mul)` | 32930 | nothing | walks her at `SHOW.walk * mul` toward one mark; returns the gap |
| `showMove(v, dt)` | 33047 | a heading in `show.wander` | travels on a heading, no target |
| `showCreep(t, s, dt)` | 32988 | the kneeling clip playing | 0.40 m/s on her knees toward a point |
| `showHold(dt)` | 33011 | nothing | stands still and turns to `show.want` |
| `showSettle(mark, dt, rate)` | 33040 | a 3-vector mark | eases the last 20 cm onto a mark to sub-mm |

Every "go somewhere" in the file is a list of `[t, s]` legs fed to `showTo` —
`come` (four legs, 43-jadrija.js:34819), `leave` (two), `toBar`, `errandLegs`
(32868), `hutGo`/`hutOut`. **This is already a path planner**, and legs are
already data. That is the single most important fact in this document: the
sequencing primitive does not have to be invented, only indexed.

### 1b. The set pieces — reachable from `askShow` today

All of these have a named entry function in `stepShow` and are already in
`SHE_CAN` (33792). Each one is `go(phase, clip, fade)` plus setup.

| ask | entry | needs first | effect |
|---|---|---|---|
| `shimmy` | `enterShimmy` | a phase in `ASKABLE` | loops `shimmy` for `SHOW.shimmyFor` |
| `twerk` | `enterTwerk` | as above | loops `twerk`; turns her away |
| `heart` | `enterHeart` | as above | loops `heart`, facing you |
| `note` | `enterNote` | as above; `banner` | loops `note`, card visible, line chosen on entry |
| `wheel` | `enterWheels` | as above | lines her up along the promenade, then 3 cartwheels |
| `joy` | inline | as above | one `flip`, ballistic, carries 2.1 m/s |
| `ballet` | inline | **a ladder within `SHOW.barreFrom`** (`barreAt`, 34136) | walks to the ladder, 15 s of `ballet` |
| `wine` | inline | the kabina exists | walk in, pour, meet, untie, dwell |
| `swim`/`tramp` | `ERRANDS` | `errandMark` resolves | walk to a mark, do the thing, come back |
| `see.*` | `SEE` | a real `SHOPS` entry | walk there, count what is there, come back and report |

### 1c. The ones she performs for other reasons and nothing could ask for

**This is the interesting list**, and it is where the owner's own example lives.

| thing | phase / clip | what triggers it today | reachable from `askShow` before this branch |
|---|---|---|---|
| **the kneel** | `submit` → `kept` (33711 `KNEES`, 34048 `OWN`) | `show.soak >= SHOW.soakIn` (1.5 s of jet) **and** `sheIsIn()` — 43-jadrija.js soak branch | **no** → now `submit` |
| knee-shuffle toward you | `creep`, clip `knees` | in `kept`, you back off past `SHOW.creepFrom` (1.35 m) | no |
| on her back | `recline` → `cradle` | in `kept`, jet held for `SHOW.reclineIn` (3.2 s) | no |
| sit up | `situp` | `cradle` and the jet off `SHOW.cradleFor` | no |
| get up off her knees | `rise`, clip `getup` | `kept` and the jet off `SHOW.keptFor` (11 s) | no |
| the turn (catch fire) | `flare` → `blaze` → `cast` → `boast` | 16 s of jet **outdoors** | no — and should stay that way |
| bask in the jet | `bask`, clip `soak` | `show.owed > 0` and a `WETTABLE` phase | no |
| the wrap comes off | `untie`, latch `show.shed` | only ever reached from `meet` | no; `raw().wear(on)` forces the draw only |
| down on all fours | `notice` → `down` → `crawl` → `up` | you come within `SHOW.near` (17 m) while she is `idle` | no |
| the twerk, turned away | `twerk` + `show.bumpBack` | being walked into (`bumpReact`, 36555) | partly — `twerk` loses the turn-away |
| change her wrap | `hutGo`→`hutIn`→`hutOn`→`hutOut`, `showScarf(null)` (29306) | 1-in-6 draw near the changing hut, 95 s cooldown | no |
| a hop over a bench | `show.hopV`, `HOPPING` (33742) | a wander tick in `play`/`home`/`orbit` | no |
| **wave** | clip `wave` | **nothing at all** — the clip is in her bank and `stepShow` never plays it | no |
| tread water | clip `tread` | nothing in her own machine | no |

Two clips in her bank are *dead*: `wave` and `tread`. `wave` is the cheapest
new gesture in the game — it exists, it is 2.5 s, it is one `go('wave','wave')`
away, and it is what a person does to shoo an animal.

### 1d. The dog, since the question was about him

`moveDog` (30437) is a five-mode machine: `stand`, `walk`, `shake`, plus the
indoor set `DOG_IN = {come, hop, rest}` (30435) and `out`. The room test is
derived from **your** position every frame (30450-30455), exactly like hers, and
the only line that sets `s.mode = 'out'` is the one that fires when *you* are no
longer in the room. `dogWet` (30629) → `shakeDog` (30614) is the one thing
anybody can do to him and it does not move him. `raw().wet()` and
`raw().walk()` are debug reads on the same two states.

So the atomic action "the dog leaves the room" **is already written** and has
exactly one caller. Reaching it is two lines.

---

## 2. Preconditions and effects: the smallest state vocabulary

The requirement is to make *"she is already in the hut"* and *"the wine is
already poured"* representable **without a second world model**. Both already
are, and nothing new had to be stored:

| fact | already carried by | line |
|---|---|---|
| she is under the kabina roof | `sheIsIn()` | 32609 |
| you are under it | the `inside` local in `stepShow` | 34782 |
| she is on the pour mark | `hypot(show.t − kit.wine[0], show.s − kit.wine[1])` | `kit.wine` is the solve's own mark |
| **the glass is full** | `show.level >= 0` (and `kit.fills[k].visible`) | `fillTo` 36316, `wineAt` 36333 |
| the bottle is in her hand | `show.held` ramp | `wineAt` |
| her wrap is off | `show.shed` latch | set in `untie` |
| she is on her knees | `KNEES[show.phase]` | 33711 |
| she is alight / has turned | `show.turned`, `show.shorn` | latches |
| a ladder is in reach | `barreAt(t, s)` | 34136 |
| the jet is on her now | `show.hit` (0.5 s grace) | |
| what she is holding | `show.held`, `show.pour`, `banner.mesh.visible` | |
| she cannot be interrupted | `HELD`, `OWN`, `MUSIC`, `KABIN` | 33644, 34048, 33663, 34036 |
| she is free to start something | `ASKABLE[show.phase]` | 33780 |
| which wrap she has on | `showScarf` index, `raw().scarf()` | 29306 |
| the dog is in the room / on the cot | `dog.mode ∈ DOG_IN`, `dog.lift > 0` | 30435 |

**The rule that makes this work and is worth stating as a rule:** a
precondition must be *read off state that already exists for another reason*.
`show.level` was written by the `wine` phase and by the debug scrubber and read
by nothing; it is a precondition now. Before this branch it was `undefined`
until the first pour, and `undefined >= 0` is false — so it happened to read as
"empty" **by accident**. It is initialised to `-1` on this branch (show init,
43-jadrija.js), because a precondition that works by accident stops working the
first time somebody reorders a test.

The one genuinely new piece of state is a *reason*: `show.why`, a key and never
a sentence, produced by `askWhy` (33841) and turned into words by `WHY` in
49-ears.js. It is not a world model; it is the answer to "why did nothing
happen", which the page could not previously give.

---

## 3. The planner

### What a plan is

A plan is **an ordered list of the atomic actions from §1, with the ones whose
effect is already true dropped**. It is not a graph search and must not become
one: the branching factor here is under thirty and the longest honest plan is
three steps. A search would buy nothing and would be the second command path
the architecture must not grow.

The shape that fits this codebase — and which prototype (a) implements for one
skill — is:

```
ask(name)
  → askWhy(name)        is there anything left to do?      (33841)
      reason → stop, and say the reason
      null   → arm show.ask
  → stepShow, on a frame where ASKABLE[show.phase]
      → askWhy(name) again        (the player may have walked out since)
      → pick the ENTRY, from the preconditions that already hold
```

"Skipping satisfied legs" and "an entry point per precondition" turn out to be
the same thing here, because every sequence in the file is already a leg list
and `show.leg` is already its index. For the wine the entry is chosen by two
tests and no new state:

| what is already true | entry | legs skipped |
|---|---|---|
| glass full | none — `why = 'poured'` | all |
| on the mark, glass empty | `go('wine','wine')` | all four of `come` |
| under the roof, off the mark | `come` at `show.leg = 2` | the two outdoor legs |
| outside | `come` at `show.leg = 0` | none (unchanged) |

Leg 2 is the swing round the stool and leg 3 is the mark. Legs 0 and 1 are
`(K.dc, K.face − 1.55)` and `(K.dc, K.face + 0.55)` — the first of those is
**outside the door**, and walking to it from `dwell` is the whole of what the
owner saw.

Entering at leg 2 means a straight line across a room she has no collider in,
so it was measured rather than argued. Asked from all four corners of the
kabina and from the middle of the floor, she enters at leg 2 every time, spends
**0 s outside**, reaches the pour in 2.5 to 3.9 s, and passes no closer than
**1.55 m to the cot's centre** and **0.45 m to a wall**. The old path went out
of the door and back, so this is a new line across the floor and not a shorter
version of the old one; it is clear of everything in the room.

### The same shape for every other skill

- `ballet` already does this and has since it was written: `barreAt` is the
  precondition, and with no ladder `show.did = null` — *"no ladder to hold: she
  cannot, honestly"*. That comment is the design. Everything here is that
  comment generalised.
- `swim` / `tramp` / `see.*`: the precondition is `errandMark` resolving; the
  skippable legs are `errandLegs`. A `see.slast` asked while she is *standing at
  the slastičarnica* should go straight to the looking phase (`peek`), not walk
  a 200 m round trip. Not implemented; it is the same two lines.
- `submit`: the precondition is `sheIsIn()`, and `KNEES[show.phase]` is the
  "already true" test — asking again while she is in `kept` is not a request.

### When no plan exists

Three outcomes, and they must be three and not two:

1. **She does not know the name.** `askShow` returns `false`. Unchanged; the
   panel says *"cannot do that here"*.
2. **She knows it and there is nothing left to do.** `askShow` returns a
   **reason key** — `'poured'`, `'already'`. This is a fact about the room, not
   a failure, and answering it with "cannot" was wrong.
3. **She knows it and it is not possible here.** `'outside'` for the kneel on
   the open deck, `nobarre` for the ballet with no ladder. The kneel refuses
   outdoors on the argument the soak meter already makes: out there the same
   water gets you the turn, and a kneel on a public promenade is answering a
   different question.

### "Chase away that pug" — the worked example of *nearly* possible

- The pug exists and is in the room with you (§1d).
- There is no `shoo` action for **her**, and no bark, whine or nudge clip for
  **him**.
- The effect the request needs is already written: `s.mode = 'out'; s.leg = 0`
  at 30454, which walks him off the cot, out through the door and back to his
  beat. It has one caller and that caller is *you* leaving.

So today the honest answer is outcome 1 — no plan — and a witticism instead of
a refusal is the wrong answer to it, because it reads as a woman who did not
listen. **What she should do when a request is nearly possible** is the general
rule here: *do the part of it she can, and say which part she cannot.* For the
pug that is a three-step plan out of parts that all exist:

```
walk-to(dog)      showTo(dog.at[0], dog.at[1])    exists, 32930
gesture(wave)     go('wave', 'wave', 0.30)        clip exists, dead code
dog.shoo()        s.mode = 'out'; s.leg = 0       exists, one caller
```

One new phase, one reuse of a dead clip, two lines on the dog. That is the
cheapest whole new *verb* the game can gain, and it is the one the owner asked
for first. It is deliberately **not** in this branch: the brief was two
prototypes and this is the third, and it needs its own measurement (does she get
back out of a 4 m room without walking through the cot).

The failure mode to avoid is the tempting one: having her say a line and
teleporting the dog out without her moving. That is a cutscene, and it is what
"pre-recorded sequence" means as a complaint.

---

## 4. The classifier's new output

Today (`classify`, server/baye/baye.py:879) the model returns
`{"intents": [...], "language": "..."}` and the page acts on **names only**:

```python
got  = [i for i in raw if i in INTENT_NAMES]
does = [i[3:] for i in raw if i in SKILL_NAMES][:1]
```

That whitelist is the whole safety argument and it must survive the change. The
smallest step up from "one name" is **one name plus an argument**, and then a
**short list** of those — an action program:

```json
{"do": [{"a": "goto", "x": "dog"}, {"a": "wave"}, {"a": "shoo", "x": "dog"}],
 "language": "English"}
```

Rules, all of them enforced in `baye.py` and not in the prompt:

- `a` must be a key of a new `ACTIONS` table, which is `SHE_CAN` plus the
  atomic verbs from §1 — **checked against the page's own names**, the way
  `SKILLS` keys are already checked against `SHE_CAN` by hand today. An invented
  `a` is dropped, not passed on.
- `x` must be a key of a small `TARGETS` table (`dog`, `cat`, `glass`,
  `bottle`, `door`, `barre`, the `SHOPS` keys). Never a free string, never a
  coordinate. A player who can put numbers in `x` can put a woman through a wall.
- **At most three steps**, and a program that is longer is truncated rather than
  refused: she has one body, and the existing `out[:1]` in `skills_of` (523) is
  the same rule at length one.
- The page **re-validates every step** against `SHE_CAN`/`ACTIONS` before
  arming, because the page does not trust the service either. `askShow` already
  does this for one name and the test does not get weaker for three.

**The failure mode when the model invents an action** is the one that matters,
and it is not security — the whitelist covers that. It is *silence*: a dropped
step produces a program with a hole in it, she does two thirds of something, and
the panel says she is doing it. So a program with any step dropped must be
**refused whole** and reported (`WHY.partial`), and she must answer with the
refusal rather than with the yes. Which is the same bug that exists **today**,
one size smaller, and worth writing down as the known defect it is:

> The skill name rides the ticket from `/hear` into the prompt
> (`build_talk_messages`, baye.py:2864: *"THEY HAVE ASKED YOU TO … AND YOU ARE
> DOING IT RIGHT NOW"*), and the ticket is issued **before the page has decided
> whether she can**. Ask for the ballet with no ladder in reach and she says yes
> while the panel says "cannot do that here". Ask for the wine on this branch
> with the glass already full and she says yes to pouring a glass she poured
> five minutes ago.

The fix is one field, and it is a page → server field rather than a prompt
change: `voice.converse` already posts `heard: heard.id` (49-voice.js:920), so
it can post `did: <name|reason>` beside it, and `talk_facts` can use the
reason instead of the skill line. **Not done on this branch** — it needs the
service deployed to test, and the brief says do not deploy.

### Keeping it cheap

`gpt-4.1-nano`, `temperature 0`, `max_tokens 60` today. A three-step program is
about 40 more output tokens and one more menu in the system message. Two things
keep the bill flat:

- The classifier is **only** asked about sentences `plainly_english` (870)
  could not read — English requests never reach it, and the regex table in
  `SKILLS` (388) is where new phrasings should go first. The kneel on this
  branch is two regexes and costs nothing per utterance.
- A program is only worth asking for when the regexes matched **nothing**.
  Single-skill requests stay on the cheap path.

---

## 5. Staged plan, cheapest first

**Stage 0 — name what is already there.** `SHE_CAN` + two regexes brings a
whole authored pose into reach. *Buys:* the kneel, and any other dead clip
(`wave`) the same way. *Risks:* nothing — no new state, no new phase. **Done on
this branch as prototype (b).**

**Stage 1 — preconditions and entries, one skill at a time.** `askWhy` + an
entry chosen off the preconditions that hold. *Buys:* the wine stops replaying,
and a third honest answer ("already poured") instead of "cannot". *Risks:* an
entry that skips a leg the leg was load-bearing for — the mitigation is that
`showSettle` still plants her on the mark, measured at 0.005 m either way.
**Done on this branch as prototype (a), for `wine` only.** `swim`, `tramp` and
the eight `see.*` are the same shape and are not done.

**Stage 2 — the missing verbs, as phases.** `wave`, `shoo`, `goto(target)`.
*Buys:* the pug, and "go and stand over there", and every request whose object
is a thing in the world rather than a move in her repertoire. *Risks:* the first
real new animation debt — a shoo that is a wave is a cheat that works once; and
a `goto` with an arbitrary target is the first thing in this file that can walk
her somewhere nobody surveyed. Fence it to `SHOPS`, the kabina and the two
animals.

**Stage 3 — a two- or three-step program from the classifier.** *Buys:*
"pour me a drink and then dance", and the compound Croatian requests the regex
table will never hold. *Risks:* the silence described in §4 — refuse whole,
never partially. Cap at three. Do not let it grow a loop or a conditional; the
moment a program can branch, the page has a second command path and the argument
in the note over `askShow` stops being true.

**Stage 4 — the page tells the service what it did.** One field on `/talk`, so
that she stops saying yes to things the page refused. Cheap, needs a deploy, and
it is the difference between "asks for stuff and it gets done" and "asks for
stuff and she says it got done".

---

## 6. What this branch actually changed

**43-jadrija.js**

- `SHE_CAN` (33792): `submit: 1`.
- `askWhy(name)` (33841): new. The precondition half of a skill — `null`, or a
  key. `wine` → `poured` / `nokit`; `submit` → `outside` / `already`.
- The ask dispatch (34677): calls `askWhy`, and picks the wine's entry off
  `onMark` and `sheIsIn()`; adds the `submit` branch, which is the same call the
  soak meter makes minus the water noise.
- `askShow` (41036): three answers instead of two — `false`, `true`, or a
  reason key.
- `whyShow()` (41053): new read. `show()` reports `level` and `why`.
- show init: `level: -1`, `why: null`.

**49-ears.js** — `DOES.submit`, a `WHY` table of one line per reason key, and
the three-way test in the `d.does` branch.

**90-app.js** — `__fr.jad.why()`, and the doc over `ask`.

**server/baye/baye.py — NOT DEPLOYED, worktree copy only**

- `SKILLS["submit"]`, one regex: `kneel\w*|on your knees|onto your knees|to
  your knees`. The bare noun "knees" is deliberately excluded.
- `ASK_RE`: `get` and `kneel` added to the bare-imperative openers, with the
  same `(?!\s+(you|u|i|we))` lookahead the rest carry — "get down on your
  knees" and "kneel down" carried no modal and no please, so the whole sentence
  read as talk and never reached `skills_of`.
