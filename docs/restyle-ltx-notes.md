# LTX-2.5 Layout-to-Render for the photoreal demos

Status, 1 Oct 2026: **promising for exterior shots, not adopted yet.** Wan 2.2 VACE remains
the pipeline. More tests to come before any switch.

## What it is

Lightricks' LTX-2.5 (22B, open weights on Hugging Face) plus the
`LTX-2.5-22b-IC-LoRA-Layout-To-Render` IC-LoRA, announced 1 Oct 2026: a game/CG
"layout" video goes in, a finished shot comes out, holding camera and composition.
Official two-stage ComfyUI workflow
(`LTX-2.5_ICLoRA_Layout_To_Render_Two_Stage_Distilled.json`). Fits one 80 GB H100.
Frame counts are 8k+1. Driver: `tools/ltxjob.py`.

## Licence (read before using it on any clip)

- LTX-2.x Community License: worldwide grant, free under $10M annual revenue.
- **Attachment A (Lightricks Acceptable Use Policy) forbids sexually explicit content
  and "content related to sexual fetishes or fantasies"**, covering running the model
  and its outputs. So **LTX is exterior / non-explicit only.** The kabina clips stay on
  Wan (Apache-2.0).
- Weights are gated; Misha accepted the gates (Layout-to-Render, LTX-2.5, Refine-Details)
  and the token lives in `~/ablit-central/.env` as `HF_TOKEN`. Copy it to a rented box
  only during downloads and delete it after.

## Tests so far

| Test | Cost | Result |
|---|---|---|
| 2.5 s aerial, Wan vs LTX | $1.27 | Inconclusive (the metric rewarded copying the game; the LTX look image was Wan's own frame). |
| 6.8 s vikendica + promenade walks, blind A/B | $4.65 | Misha: ~50/50. LTX seamless and consistent but "gamish"; Wan more photoreal, seams every 1.7 s. LTX put sea on the promenade and opened on the reference photo before dissolving into the shot. |
| Hybrid + 10-variant sweep + 48 s long clip | $2.85 | The hybrid fixes the sea and the dissolve; see below. |

Files on synology `shared/micko/`: `ltx-vs-vace-jadrija-aerial-20261001.*`,
`ltx-vs-wan-{prom,vik}-20261001-{labelled,blind}.mp4` + key, `ltx-tune-sweep-20261001.jpg`,
`ltx-long-promenade-20261001(.mp4, -sbs.mp4)`. Work dirs `~/fr-video/ltxwan/`, `~/fr-video/ltxlong/`.

## Best recipe so far (exteriors)

1. **Hybrid look image:** render only the first 41-frame chunk with our Wan VACE recipe
   (with the reference photo); Wan's frame 0, aligned with game frame 0, becomes LTX's
   look image. This fixes the sea-on-promenade error and the opening dissolve.
2. Layout = the game frames in **greyscale** (colour frames make LTX copy the low-poly look).
3. Layout-to-Render strength **1.0** (0.8 goes grey and flat, 0.6 collapses into the layout).
4. **No layout in stage 2** (look only): least "gamish" and the fastest variant (56 s per 209 frames).
5. Depth / canny guides (Union Control) look more photographic but invent buildings.
6. Long shots: chain 401-frame passes, each held on the previous pass's last 25 frames
   (`ltxjob.py --first DIR --first-n 25`), crossfading the overlaps. 48 s rendered in ~8 min.

## Speed and cost (one H100 PCIe, $3.29/h)

- LTX ≈ $0.009 per output second (89 s for 8.7 s of video), versus Wan VACE ≈ $0.28
  (517 s per 1.7 s chunk): roughly 30× cheaper.

## Known problems / next tests

- Drift over long shots: the sky slowly turns overcast; people change identity (~40 s in);
  a floating smear appeared at the right edge.
- Near tree trunks keep the game's low-poly texture in every variant.
- **Refine-Details IC-LoRA** (`ltx-2.5-22b-ic-lora-refine-details-1.0.safetensors`) not yet
  tested; the gate is now accepted (access verified 1 Oct).
- Ideas: Refine-Details on stage 2; periodic re-anchoring with a fresh Wan keyframe to stop
  long-shot drift; more exterior scenes (Canadair, channel, the boat).
