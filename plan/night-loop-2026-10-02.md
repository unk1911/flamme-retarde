# Night loop, 1–2 Oct 2026 (until ~08:30, extended by Misha at 06:25): role reversal + autonomous mode

Misha: "role reversal i think is the hottest part of the game now ... keep improving the
role reversal as well as 'autonomous' modes, to essentially take advantage of the work that
has already been done with all the different toys/tools/positions, and maybe even expand
some of them out even more". One agent at a time ("a single process"), gradual, each
merged + released before the next starts. Consensual adult kabina play; safeword always wins.

## Backlog (in order; tick when merged)

1. [x] **Reverse roles phase 2a — Chloe's voice & persona.** Her own persona on the voice
   service (baye.py: PERSONA_CHLOE — confident, teasing, playful dom; Croatian + gloss like
   Baye), her own ElevenLabs voice (pick a distinct female voice already on the account; ask
   nothing — choose one and say which), her orders/praise/teases spoken, chat with her
   while reversed (`/talk` routes to Chloe when roles are reversed), scene block awareness.
2. [x] **Phase 2b — Chloe uses the belt and the collar on player-Baye.** Belt: she takes it
   off, the AVBD strap in HER hand (third-person arm), swings at the cot targets, same hit
   path/marks/sounds; collar: she buckles it on you, leads you (camera follows), tugs move
   your pose (reuse the leash pose steps). Safeword ends both.
3. [x] **Phase 2c — standing spanks done properly + more Chloe moves.** Fix the 8–19 cm
   misses (solve the arm to the target with the same two-bone hinge solver as 1.561.1),
   kneel-by-the-cot instead of squat, head tracking you, hand poses (open palm, grip),
   circling, hair stroke, hand on your back holding you down, sitting on the cot edge.
4. [x] **New leg poses (both modes).** Legs spread WIDER (a further step past `legs.wider`),
   one leg flat on the cot + the other raised (left/right), both legs raised, and raised
   HIGHER — solved poses (Blender solvers / ?pose harness, rig sign traps), with commands,
   keys in reverse mode, autonomous-mode moves, and Chloe orders for each.
5. [x] **Toys in Chloe's hands.** While reversed and the Lovense or the plug is worn by
   player-Baye, Chloe sometimes slowly draws it partway out and pushes it back in (an
   animation of the worn toy along its axis + her hand on the base, the fit check keeping it
   believable), plus using the remote. Same for the Lovense. Reactions on your body/camera.
6. [x] **Autonomous mode, deeper.** Use the new leg poses, the toys (her own reactions to
   them), the playground kit, the collar/leash (kneel-up on tugs etc.); smarter mood model
   (anticipation, teasing back), more lines; respond to the player's hand positions.
6b. [x] **Chloe speaks American English** (Misha, 05:20: "is there any way for Chloe to speak
   English, American English, she is really from the west coast and all?"). PERSONA_CHLOE
   rewritten: a young woman from the US West Coast (California) on holiday at Jadrija, casual
   West Coast speech, playful dom, English only (no gloss, no Croatian except maybe a word she
   picked up); a new American female voice from the account, distinct from Baye's Jessica
   (audition 2–3 and say which); every client Chloe line table (49-reverse/revkit/revmoves/
   revtoys) speaks and captions the English line, rewritten to sound natural rather than
   translated; the player's commands stay multilingual; Baye stays as she is.
   PLUS one small new Chloe move (Misha, 05:55): "pelvic humps next to me" — a teasing hip-thrust /
   hip-roll move she does standing or kneeling BESIDE the cot (hands on hips or behind her head,
   a few slow thrusts in the air, a cheeky English line), a tease like Baye's "the bend"; no
   contact with player-Baye's body, no grinding on her. In her selector (now and then, mid heat)
   and on a key/ask ("show me your moves"). Strap-on: declined, do not build.
   PLUS (Misha, 06:00): the existing hug + kiss extended to player-Baye on her back with legs
   raised (1.566.0 leg poses): Chloe comes to the cot SIDE, leans over, hugs her close and kisses
   her; the hip-thrust tease stays standing beside the cot, before or after the hug. Never
   between the raised legs, never thrusting while close/hugging.
7. [ ] **Reverse-roles polish from playtesting the above** (whatever is roughest).
8. [ ] Safeword also stops the Lovense/plug in both modes (Misha hasn't answered — only if
   he says yes; otherwise skip).

## After the loop (launch when the last night item has merged, ~07:30)

9. [ ] **Thin-film: harbour oil sheen + a bather kid blowing soap bubbles** (Misha, 06:05,
   inspired by https://sael.net/soap-bubble/ — "All rights reserved": take NO code from it;
   rebuild from physics). Our own thin-film LUT (RGB vs optical path difference, summed over
   the visible spectrum with CIE matching functions, baked at load, ~50 lines), indexed by
   film thickness x cos(view angle). (a) Oil sheen: faint drifting iridescent patches on the
   water at the harbour (Šibenik riva / the boats / fuel dock — find where boats moor), in
   the sea shader or as decal patches, calm water only, broken up by noise (no regular
   pattern — memory nothing-beats-a-wrong-pattern; no varying coefficient on absolute
   position). (b) One of the seated bather kids on a chair near one of the businesses there
   blows soap bubbles: a wand, bubbles spawned at the lips, drifting on the wind with a
   little buoyancy, swirling drained-film colours (black film top), popping with an
   expanding-hole shader; pooled, cheap (dozens, one shader). RULE 4 for any 43-jadrija.js
   bather change (own RNG). people 100 / blockers 820.

11. [x] **Baye speaks English** (Misha, 06:20: "the speech for baye should be in English, not
   croatian ... keep using that same eleven labs voice" = Jessica `LEnmbrrxYsUYS7vsRRwD`,
   unchanged). Every Baye line she SPEAKS and captions becomes English, rewritten to sound
   natural (not word-for-word from the gloss), no gloss line: baye.py PERSONA / PERSONA_TALK
   (her character otherwise unchanged) and every Baye beat/scene table; client line tables
   (43-jadrija asks/replies, 49-auto.js 1.568.0 lines, ears, collar/belt/leash, toys, playground,
   R race, aftercare, safeword lines). Pre-baked Baye audio re-rendered with Jessica in English.
   The player's commands stay multilingual (en/hr/fr). Bathers, the cat, the Bucketeer, TV news
   and overheard chatter stay Croatian. Runs right after 6b (Chloe's English) merges, BEFORE
   item 10 so the wand's lines are written in English; in parallel with item 9.
12. [ ] **Spooning on the cot (reverse roles)** (Misha, 06:40: "at certain intimate moments of
   show of affection ... Chloe could slide in lay on the cot next to baye (baye being in fetal
   pose) and spoon ... ultimately we are in love"). Player-Baye curled on her side (fetal; find
   or solve the pose); Chloe climbs onto the cot behind her and lies along her back: arm over
   her waist, hand finding hers, face nuzzled at the neck, a kiss on the shoulder, breathing
   that slowly syncs (chest rise), a soft English line; hold until the player moves/asks/time.
   NO hip thrusts or grinding while pressed together (Misha asked for "very slight hip
   thrusts" — declined; the cuddle only). Selector: after aftercare / a run of obeyed orders /
   praise; asks "spoon me", "cuddle me", "hold me", "zagrli me u krevetu"; a key. Bodies must
   not interpenetrate (measure gaps); the cot holds both (AVBD/mattress lift as relevant).
   Starts when item 9 or 11 lands (not parallel with item 10 if both touch 49-revmoves).
13. [ ] **Chloe pulls your hair when she's excited (reverse roles)** (Misha, 06:55: "does Chloe
   ever pull me by the hair, when she is excited? ... just like I (Chloe) sometimes pull baye's
   hair, she should do it also to me"). Today she only has 1.565.0's light nape hold (rvm.nape:
   ~7° camera pitch, upper back eased back). Build the real thing, mirroring the player's
   1.544.0 hairPull (43-jadrija.js hairPull/hairPullAt, PULL_RAG in 41-skin.js): from behind
   (you face down / on all fours / bent over / kneeling), her fist gathers your hair, pulls
   your head back firmly but playfully; PULL_RAG-style body response on player-Baye (neck +
   upper back arched, hands bracing), first-person camera pitched back hard toward the
   ceiling/her, a gasp; her lines in English (Laura). Triggered by her excitement (heat high,
   a run of obeyed orders, during/after spanks or toy play) and on ask ("pull my hair");
   holds a few seconds, can combine with a spank from her other hand; release eases back.
   Safeword lets go instantly. Starts after item 12 (spooning) lands — both edit 49-revmoves.js.
   PLUS (Misha, 07:00, agreed version): you kneeling in front of her (standing), her fist in your
   hair draws you in so your CHEEK rests against her SIDE — hip/waist, head turned to the side —
   your arms go round her legs (thighs/knees) for balance (both hands solved onto her legs),
   then she tips your head back so you look up at her, holds a beat with a line, releases.
   NEVER face-to-crotch / face pressed to her front below the waist (declined); the head goes
   to her side at waist/hip height only.
10. [ ] **Third worn toy: the dual-ended wand / G-spot vibrator** (Misha, 06:15: "a 3rd toy,
   which can be used in place of the lovense or plug ... it can go into either hole, for a more
   intense experience"). Reference photo: refs/toys/wand-ref.jpg (git-ignored): soft pink
   silicone, a round wand-massager head on a short neck at one end, a thin gold band, a handle
   with an embossed infinity-sign button, tapering into a curved G-spot end. Build it on the
   Lovense/plug code paths (1.560.2/1.560.3 worn mount + clearance fit, signal path with the
   1.567.0 intensity levels, its own remote channel, rhythm sync on lips/eyes): a prop on the
   kabina shelf/tabouret, `wear:wand front` / `wear:wand back` (one at a time per hole; it
   replaces whatever toy is in that hole), the curved end worn, the head and handle outside,
   fit check in every cot pose incl. the 1.566.0 leg poses; stronger reactions than the
   Lovense at the same level ("more intense"). Normal mode: asks typed + spoken; autonomous
   mode reactions (1.568.0). Reverse roles: Chloe holds it by the handle and works it with
   the 1.567.0 draw/tease/twist + her remote steps, and can swap it in for the Lovense/plug.
   Safeword stops it in reverse roles (normal mode = item 8, unanswered).

## Rules for each iteration
- One worktree agent at a time; brief it fully (memory notes, fast pipeline, RULE 4,
  regression people 100 / blockers 820, CHANGELOG/TASKLOG one row, commit in worktree).
- Merge per merging-agent-worktrees (mergefix traps), regression plans, deploy baye.py if it
  changed (bump VERSION), release, remove worktree, check orphans.
- Stop launching new work after ~07:45 so the last one lands by ~08:30 (extended 06:25). After 6b: items 11 + 9 in parallel (separate worktrees), then 10 once 11 is merged.
