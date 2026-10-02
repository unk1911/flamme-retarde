# Night loop, 1–2 Oct 2026 (until ~07:30): role reversal + autonomous mode

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
6. [ ] **Autonomous mode, deeper.** Use the new leg poses, the toys (her own reactions to
   them), the playground kit, the collar/leash (kneel-up on tugs etc.); smarter mood model
   (anticipation, teasing back), more lines; respond to the player's hand positions.
6b. [ ] **Chloe speaks American English** (Misha, 05:20: "is there any way for Chloe to speak
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
7. [ ] **Reverse-roles polish from playtesting the above** (whatever is roughest).
8. [ ] Safeword also stops the Lovense/plug in both modes (Misha hasn't answered — only if
   he says yes; otherwise skip).

## Rules for each iteration
- One worktree agent at a time; brief it fully (memory notes, fast pipeline, RULE 4,
  regression people 100 / blockers 820, CHANGELOG/TASKLOG one row, commit in worktree).
- Merge per merging-agent-worktrees (mergefix traps), regression plans, deploy baye.py if it
  changed (bump VERSION), release, remove worktree, check orphans.
- Stop launching new work after ~06:45 so the last one lands by ~07:30.
