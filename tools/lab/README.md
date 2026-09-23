# lab — the photoreal restyle rig

Turning a frame of the game into a frame of footage. VACE holds the render's
geometry and camera; a sim2real LoRA supplies the photography. Plain Wan v2v
was tried first and is a dead end — it redraws the shot instead of restyling
it.

## The recipe, settled over 33 runs

- **720p native beats 480p upscaled.** 1280x720 straight out of the model is
  better than 854x480 through ESRGAN, and it is not close.
- **denoise 0.95, vace 1.00, sim2real 0.85, 12 steps.** More steps did not pay
  (A7 at 20 is the control). Below 0.85 denoise the render shows through.
- **The prompt is the whole of the steering.** At cfg 1.0 negatives are inert,
  so the positive prompt is the only text conditioning there is — and it must
  describe *this* shot. What originally shipped restyled an aerial chase over
  Šibenik with a description of a cabin interior, and spent its entire
  conditioning budget failing to find wood and plaster in the Adriatic. That
  is the single biggest quality lever here; see `prompts.sh`.
- **73 frames a clip.** 4k+1 — the model wants 4n+1 and silently mangles
  anything else.

## The HUD has to go before the frames do — 21 Sep 2026

A restyle of a *recorded session* is not a restyle of the game: the recording
has the EARS console and the subtitle line burnt into it, and text is the one
thing this pipeline reliably destroys. Two ways of painting it out were tried
on a rented A100 and both came back worse than the text would have been —
`unhud.py` has the full account, and the short version is that **VACE reads
an edge as geometry and a mirror as a wrong perspective**. What worked was
cropping: the console is anchored to the right edge, so 1280 -> 1024 takes
all of it and costs nothing in the picture.

The general rule: **do not hand the model a region you have invented.** If
an overlay can be cropped out, crop it. Only the subtitle, which sits in the
middle of the floor, is worth filtering — and it is thin bright glyphs over
tiles, which a median takes cleanly.

Also from the same run: **a 2:1 recording does not want 1280x720.** The model
is fine at 1024x640; what it is not fine at is a letterbox, so crop to the
ratio rather than padding to the trained one.

## People stay the same people: a reference image — 23 Sep 2026

Every chunk is generated on its own and knows nothing of the one before, so
the people in it are reinvented every 5.06 s. Measured on
fr-clip-20260923-144913: without a reference the dark-haired woman was blonde
in black mesh briefs by chunk 2. With one, chunk 0 and chunk 2 are the same two
women. **Always run a film with people in it this way:**

1. `burst.py fan --chunks 1 ...` with the final prompts — chunk 0 alone.
2. `tools/lab/refcut.py` on a good frame of it — the people front-on, whole
   bodies — onto white, at exactly the job's size. Look at it before using it.
3. `burst.py fan --chunks N --ref ref.png ...` — the whole film, every chunk
   handed the same picture of who they are.

Cut from the film's OWN chunk 0, so the reference carries the look the film
will have rather than some other attempt's. Onto white, with the wall taken
off, because a reference is a picture of *everything* in it and a mottled wall
behind them would be pushed into every chunk. Costs one extra chunk (~$0.30 on
an A100) and a few minutes of the box idling while the cut is checked.

The other two lessons from the same film are prompt lessons, and they are the
old rule — describe what is in the frame — applied to things that were only
half-described: "a white plate" came back with food on it, and it is "a small
black plate with a gold rim with a few neat lines of fine white powder"; and
people the prompt did not say were naked came back in bikini bottoms.

## And then grade it low-key — 23 Sep 2026

The model exposes a dark room like a photographer would: the kabina came back
lit, with blotchy plaster, at denoise 0.95 AND at 1.0 (so it is not the
render's latents), and no prompt wording darkened it. A grade does, for free,
on the laptop, and cannot touch identity or geometry. The one Misha picked
(`…-demo2b-graded.mp4`):

    ffmpeg -i in.mp4 -vf "curves=all='0/0 0.18/0.05 0.40/0.17 0.60/0.40 0.80/0.70 1/1',eq=saturation=0.92" \
      -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a copy out.mp4

Midtones crushed, highlights kept: walls fall into shadow, skin, the doorway
and the television stay bright. Deliver both, graded and not.

## Rented-GPU gotchas

Each of these cost a run.

- **ssh eats stdin.** An `ssh` inside a `while read` loop swallows the rest of
  the loop's input, so a matrix runs experiment one of eight and announces it
  has finished. `burst.py` passes `stdin=DEVNULL` to every ssh; `matrix.sh`
  reads the table on fd 3 as a second lock on the same door.
- **Never `set -e` in a matrix.** It exists to survive its own failures: one
  OOM must not take the experiments queued behind it, which are the ones that
  were going to answer the question.
- **Source the prompts per iteration, not at startup**, or a prompt added
  while a runner is going does not exist for that runner.
- **sageattention has no aarch64 wheel.** GH200 boxes need it built or skipped.
- **An A100 is +35%, not 2x.** Priced per useful frame it rarely wins.

## Files

| | |
|---|---|
| `matrix.sh` | run one box through a table of experiments |
| `prompts.sh` | the prompts under test, with the reasoning kept |
| `variants.sh` | parameter sweeps |
| `runs/*.tsv` | the experiment matrices, one line per run |
| `runs/*.log` | timings and outcomes — the evidence for the notes above |

Driven by `../burst.py` (fleet) and `../burst-bootstrap.sh` (box setup); the
job graph is `../vacejob.py`; `../lab-assemble.sh` makes a comparison mp4 and
`../assemble.sh` makes the deliverable with audio.

Frames and video are not kept. They were 10 GB and every conclusion they
supported is written down here.
