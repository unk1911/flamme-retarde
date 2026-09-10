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

## Everything else

Every other sound in this game is synthesised at runtime in `src/80-audio.js`
or baked by a tool in `tools/` — see `cut_birds.py`, `cut_chat.py`,
`cut_field.py`, `cut_mutter.py` and `cut_song.py`. The voices are the owner's
own ElevenLabs account. Nothing else here is anybody else's work.
