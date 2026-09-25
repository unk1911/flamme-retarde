# Third-party audio in this game

## `pour_freesound_421184_inspectorj.mp3`

**"Water, Pouring, A.wav"** by **InspectorJ** (Jonathan Shaw), freesound.org
<https://freesound.org/people/InspectorJ/sounds/421184/>

Licensed **Creative Commons Attribution 4.0 International (CC BY 4.0)**
<https://creativecommons.org/licenses/by/4.0/>

Raw audio of a tub of icy water poured onto snow-laden concrete, recorded with
the microphone about half a metre from the splash point. 2.83 s, 44.1 kHz.

Used, trimmed and re-levelled, as the sound of Baye the Bucketeer emptying her
pail on the vikendica porch. `tools/cut_pour.py` performs the conditioning and
its note records what was changed and why. The conditioned result is
`build/payload/pour.mp3`, which is what the build inlines.

CC BY 4.0 permits redistribution and modification, including commercially, on
the condition that the author is credited and changes are indicated. Both are
done here and in the README.

## `hmm_freesound_170781_esperar.mp3`

**"Hmm Ahh.wav"** by **esperar**, freesound.org
<https://freesound.org/people/esperar/sounds/170781/>

Released under **CC0 1.0 Universal** (public domain dedication)
<https://creativecommons.org/publicdomain/zero/1.0/>

A young man saying "hmm" and "ahh" several times with different inflections,
39.8 s. The file here is the copy Pixabay's `freesound_community` account
re-hosts of the same recording (<https://pixabay.com/sound-effects/people-hmm-ahh-6426/>),
which is where it was downloaded from; the Freesound original's CC0 is the
licence that applies.

Used as the Slow Doodle's "hmm?" when he puts his nose through the kabina's
curtain: the one "hmm?" at 0.93–1.66 s, cut out, levelled and encoded by
`tools/cut_hmm.py`, whose note lists the changes. The result is
`build/payload/doodle_hmm.mp3`. CC0 asks for no attribution; this is here
anyway.

## `slap_b_0.ogg` and `kiss_misha.mp3`

The owner's own recordings (Misha, supplied 25 Sep 2026 as `b_0.ogg` and
`kiss.mp3`), so no third-party terms. The slap is cut to its one hit by
`tools/cut_slap.py` (`build/payload/slap.mp3`), and the kiss to its five smacks
by `tools/cut_kiss.py` (`build/payload/kiss.mp3`); each tool's note lists what
it changes.

## Everything else

Every other sound in this game is synthesised at runtime in `src/80-audio.js`
or baked by a tool in `tools/` — see `cut_birds.py`, `cut_chat.py`,
`cut_field.py`, `cut_mutter.py` and `cut_song.py`. The voices are the owner's
own ElevenLabs account. Nothing else here is anybody else's work.
