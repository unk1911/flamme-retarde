# Queued for Misha — decisions I made alone and would like checked

Nothing here is blocking; each one has a defensible choice already built. If a
call was wrong, say which and I will redo it.

## Answered myself, flag if wrong
1. **Dive board direction.** You said "250 m west"; west is decreasing t and
   would have put it on the beach. "Across from the kabine" is unambiguous and
   the kabine are east, so I went east — t 430, s -40. It makes the race
   LONGER: 175 m from the mole head instead of 66, because the distance is now
   along the shore rather than straight out. Swim it before you decide.
2. **Crazy paving is INLAND, not seaward.** The survey report said the opposite.
   v_022 shows paving under the terraces and power-floated slab by the water.
   I followed the footage over the report.
3. **Sun angle left alone.** The plan wanted an hour-angle model at 54.4 deg for
   14:20, but that figure is computed for 21 Aug — your survey date — and the
   game is set in the second week of August, the 6 Aug Rokici fire. At the right
   declination the error is 3.4 deg, not 7.4. `sunAngles` is global and its
   azimuth convention is ambiguous enough that changing it risks flipping every
   shadow in the game for a 3 deg gain. Wants its own sitting with a test.
4. **Four shops ship unnamed** — konoba, the glass-fronted bar, the green kiosk,
   the trampoline operator. No legible sign in any photograph or frame. I would
   rather leave them blank than invent Croatian business names.

## Open questions
- The western 200 m is Strand Jadrija — sand and shingle in the aerial — but the
  game builds concrete terraces the whole way. I am converting it to a beach
  profile. If you want the concrete to run further west, say so.
- Nothing in the survey fixes how the eastern kabine break into runs. 124 huts
  is a chosen number honouring "about a hundred", not a count.

## Alarm clock (2026-08-22)
You asked me to wake at 02:45 Croatia time. When you sent that it was already
04:56 CEST — 02:45 had passed two hours earlier. I set the alarm for the next
02:45 CEST (Sat 22 Aug, = 20:45 EDT on this box) and kept working in the
meantime. If you meant "in a couple of hours", say so and I'll re-set it.

## The three unreadable signs: mostly my own bad camera (2026-08-22, later)
I said MINI, H2O and TRAMPULIN were missing. Tagging every board with a name
and pointing the camera at its OWN world position — rather than at where I
thought it ought to be — shows all seven boards present, visible, unculled,
with ink on them. **Caffee bar H2O reads perfectly.** So does Slasticarnica,
F2 and Tisak. The earlier verdict came from cameras aimed at guessed heights.
Still chasing: MINI shows its dark tray with no board inside it, and TRAMPULIN
is behind its own building from the seaward normal.

`menuWall()` is separately explained: NOTHING in the SHOPS table sets `menu`,
so the one call site never fires. It is dead code, not a render bug. It also
sits in an `if (S.menu) menuWall(); else if (S.name) shopSign();` chain with
twenty-six lines of comment between the two halves, which is a trap waiting
for the first shop that gets a menu — that shop would silently lose its sign.
