#!/usr/bin/env python3
"""Queue one Wan 2.2 A14B VACE restyle — the mixture-of-experts sibling of
tools/vacejob.py.

    python3 vacejob22.py --frames /home/ubuntu/job/frames --n 81 \
        --w 1280 --h 720 --tag _k1 --steps 8 --boundary 3 \
        --light 1.0 --denoise 0.85 --swap 20

── why this is a second file and not a flag ──────────────────────────────────

Wan 2.2 A14B is not a bigger Wan 2.1. It is a *mixture of experts*: two
fourteen-billion-parameter transformers, one trained for the high-noise end of
the schedule and one for the low-noise end, with a handover partway down. There
is no single checkpoint to point `--model` at. That changes the graph rather
than a filename:

  * two `WanVideoModelLoader`s, each with its own VACE module (HIGH and LOW are
    a matched pair — mixing releases puts a seam at the boundary);
  * two `WanVideoSampler`s sharing one schedule, split with `start_step` and
    `end_step`, the second taking the first's latents through `samples`;
  * two distill LoRAs, because Lightning is also released per expert.

vacejob.py's graph is a straight line and this one forks, so folding both into
one file would mean every node in it growing an `if moe`. Two files, and the
duplication is the price.

── the traps, all of them paid for ───────────────────────────────────────────

**`denoise_strength` and `start_step` are mutually exclusive in the wrapper.**
`WanVideoSampler.process` raises `start_step must be 0 when denoise_strength is
used` — and denoising below 1.0 *is itself* an implicit start_step, computed as
`steps - int(steps * denoise) - 1`. So the video-to-video anchor can only live
on the HIGH sampler, which is the one that starts at zero; the LOW sampler must
run at denoise 1.0 and inherit the anchor through the latents it is handed. Set
`--denoise` and this file puts it in the only place it can go.

**The loader input is `extra_model`, not `vace_model`.** The June-2025 wrapper
that vacejob.py targets called it `vace_model`; master renamed it and kept the
old name only as a Python kwarg that `INPUT_TYPES` no longer advertises — so a
graph written against the old name is rejected by ComfyUI's validator before
anything loads, with a message about an unexpected input rather than about
VACE.

**Neither `_fast` quantization nor `fp16_fast` is for an A100.** Both want fp8
matmul, which is compute capability 8.9 and up; Ampere is 8.0. The scaled fp8
checkpoints still load — they are dequantised — but asking for the fast path on
sm80 is how a run dies at model load.

**Validate the graph against `/object_info` before queueing.** Every one of the
above presents as an HTTP 400 several minutes into a rented instance, and the
body names one input on one node. `--check` (on by default) pulls the schema
off the running server and says which node and which input, for free, in a
second — see `validate()`.
"""

import argparse
import json
import sys
import urllib.error
import urllib.request

AP = argparse.ArgumentParser()
AP.add_argument("--frames", required=True)
AP.add_argument("--n", type=int, default=81)
AP.add_argument("--w", type=int, default=1280)
AP.add_argument("--h", type=int, default=720)
AP.add_argument("--tag", default="_vace22")
# Lightning is trained for four steps, two per expert. Eight with a boundary at
# three is the same shape with headroom: the expensive part of a restyle is not
# the step count, it is that there are two models to page in and out.
AP.add_argument("--steps", type=int, default=8)
AP.add_argument("--boundary", type=int, default=0,
                help="step at which the HIGH expert hands over to the LOW one; "
                     "0 means steps//3, which is where sigma crosses 0.875 at "
                     "shift 5")
AP.add_argument("--cfg", type=float, default=1.0)
AP.add_argument("--shift", type=float, default=5.0)
AP.add_argument("--seed", type=int, default=7731)
AP.add_argument("--light", type=float, default=1.0,
                help="Wan22-Lightning strength, per expert; 0 removes both")
AP.add_argument("--vace", type=float, default=1.0)
AP.add_argument("--vacestart", type=float, default=0.0)
AP.add_argument("--vaceend", type=float, default=1.0)
AP.add_argument("--swap", type=int, default=20)
AP.add_argument("--denoise", type=float, default=1.0)
AP.add_argument("--scheduler", default="unipc")
AP.add_argument("--upscale", default=None)
AP.add_argument("--outw", type=int, default=0)
AP.add_argument("--pos", default=None)
AP.add_argument("--neg", default=None)
AP.add_argument("--ref", default=None)
AP.add_argument("--attn", default="sageattn",
                choices=["sageattn", "sdpa", "flash_attn_2", "sageattn_3"])
AP.add_argument("--host", default="http://127.0.0.1:8188")
AP.add_argument("--no-check", dest="check", action="store_false")
# Wan 2.2's checkpoints are fp8 *scaled*, and merging a LoRA into scaled fp8
# weights is the sharp edge of this whole stack: the wrapper does it across a
# thread pool, and on the first attempt here it took ComfyUI down with a
# simultaneous multi-thread `Fatal Python error: Segmentation fault` fourteen
# seconds into "Loading and assigning model weights to device". low_mem_load
# walks the same merge one tensor at a time instead. Slower, and it does not
# crash.
AP.add_argument("--fastlora", dest="lowmem", action="store_false",
                help="merge LoRAs the fast (threaded) way; segfaulted on an "
                     "A100 with fp8-scaled Wan 2.2 weights")
A = AP.parse_args()

HIGH = "Wan2_2-T2V-A14B_HIGH_fp8_e4m3fn_scaled_KJ.safetensors"
LOW = "Wan2_2-T2V-A14B_LOW_fp8_e4m3fn_scaled_KJ.safetensors"
VACE_HIGH = "Wan2_2_Fun_VACE_module_A14B_HIGH_fp8_e4m3fn_scaled_KJ.safetensors"
VACE_LOW = "Wan2_2_Fun_VACE_module_A14B_LOW_fp8_e4m3fn_scaled_KJ.safetensors"
LORA_HIGH = "Wan22_T2V_HIGH_Lightning_4steps.safetensors"
LORA_LOW = "Wan22_T2V_LOW_Lightning_4steps.safetensors"

_n = (A.n - 1) // 4 * 4 + 1
if _n != A.n:
    print(f"--n {A.n} is not 4k+1; using {_n} (the VAE cannot emit the rest)")
    A.n = _n
BND = A.boundary or max(1, A.steps // 3)

POS = ("photorealistic footage, real photographed video, film grain, 35mm, "
       "sharp fine detail, cinematic colour grade")
NEG = ("cartoon, cgi, render, 3d, video game, low poly, flat shading, "
       "illustration, painting, blurry, distorted geometry, extra people, "
       "text, watermark")

G = {}


def node(cid, cls, inputs):
    G[cid] = {"class_type": cls, "inputs": inputs}
    return cid


node("vae", "WanVideoVAELoader",
     {"model_name": "wan_2.1_vae.safetensors", "precision": "bf16"})
node("t5", "LoadWanVideoT5TextEncoder",
     {"model_name": "umt5-xxl-enc-fp8_e4m3fn.safetensors", "precision": "bf16",
      "load_device": "offload_device", "quantization": "disabled"})
node("swap", "WanVideoBlockSwap",
     {"blocks_to_swap": A.swap, "offload_img_emb": True,
      "offload_txt_emb": True, "use_non_blocking": True,
      "vace_blocks_to_swap": 8 if A.swap else 0})

# One expert per branch, and each branch is loader + its own VACE module + its
# own Lightning LoRA. Both are 15 GB fp8; on a 40 GB card only one can be
# resident, which is what --swap is really paying for here.
for side, base, vace, lora in (("h", HIGH, VACE_HIGH, LORA_HIGH),
                               ("l", LOW, VACE_LOW, LORA_LOW)):
    node("vacesel_" + side, "WanVideoVACEModelSelect", {"vace_model": vace})
    m = {"model": base,
         # bf16 and the plain scaled path, not fp16_fast / _fast: those need
         # fp8 matmul, which is compute capability 8.9, and the only box with
         # capacity today is an A100 at 8.0.
         "base_precision": "bf16", "quantization": "fp8_e4m3fn_scaled",
         "load_device": "offload_device", "attention_mode": A.attn,
         # Renamed from vace_model in master; see the module docstring.
         "extra_model": ["vacesel_" + side, 0]}
    if A.swap:
        m["block_swap_args"] = ["swap", 0]
    if A.light:
        node("lora_" + side, "WanVideoLoraSelect",
             {"lora": lora, "strength": A.light,
              "low_mem_load": A.lowmem})
        m["lora"] = ["lora_" + side, 0]
    node("model_" + side, "WanVideoModelLoader", m)

node("txt", "WanVideoTextEncode",
     {"t5": ["t5", 0], "positive_prompt": A.pos or POS,
      "negative_prompt": A.neg or NEG, "force_offload": True})

node("src", "VHS_LoadImagesPath",
     {"directory": A.frames, "image_load_cap": A.n, "skip_first_images": 0,
      "select_every_nth": 1})
node("fit", "ImageResizeKJ",
     {"image": ["src", 0], "width": A.w, "height": A.h,
      "upscale_method": "lanczos", "keep_proportion": False,
      "divisible_by": 16, "crop": "disabled"})

vace_in = {"vae": ["vae", 0], "width": A.w, "height": A.h, "num_frames": A.n,
           "strength": A.vace, "vace_start_percent": A.vacestart,
           "vace_end_percent": A.vaceend, "input_frames": ["fit", 0],
           "tiled_vae": False}
if A.ref:
    prev = None
    for i, r in enumerate([r.strip() for r in A.ref.split(",") if r.strip()]):
        node("ref%d" % i, "VHS_LoadImagePath",
             {"image": r, "custom_width": A.w, "custom_height": A.h})
        if prev is None:
            prev = ["ref%d" % i, 0]
        else:
            node("refcat%d" % i, "ImageBatch",
                 {"image1": prev, "image2": ["ref%d" % i, 0]})
            prev = ["refcat%d" % i, 0]
    vace_in["ref_images"] = prev
node("vaceenc", "WanVideoVACEEncode", vace_in)


def sampler(cid, model, start, end, samples=None, denoise=1.0):
    s = {"model": [model, 0], "image_embeds": ["vaceenc", 0],
         "steps": A.steps, "cfg": A.cfg, "shift": A.shift, "seed": A.seed,
         "force_offload": True, "scheduler": A.scheduler,
         "riflex_freq_index": 0, "text_embeds": ["txt", 0],
         "start_step": start, "end_step": end}
    if samples is not None:
        s["samples"] = samples
    if denoise < 1.0:
        s["denoise_strength"] = denoise
    node(cid, "WanVideoSampler", s)


# The video-to-video anchor can only sit on the HIGH pass — see the docstring.
if A.denoise < 1.0:
    node("enc", "WanVideoEncode",
         {"vae": ["vae", 0], "image": ["fit", 0], "enable_vae_tiling": False,
          "tile_x": 272, "tile_y": 272, "tile_stride_x": 144,
          "tile_stride_y": 128, "noise_aug_strength": 0.0,
          "latent_strength": 1.0})
    # start_step MUST stay 0 here; the wrapper derives its own from denoise.
    sampler("samp_h", "model_h", 0, BND, samples=["enc", 0],
            denoise=A.denoise)
else:
    sampler("samp_h", "model_h", 0, BND)
sampler("samp_l", "model_l", BND, -1, samples=["samp_h", 0])

node("dec", "WanVideoDecode",
     {"vae": ["vae", 0], "samples": ["samp_l", 0], "enable_vae_tiling": True,
      "tile_x": 272, "tile_y": 272, "tile_stride_x": 144,
      "tile_stride_y": 128})

out = ["dec", 0]
if A.upscale:
    node("upm", "UpscaleModelLoader", {"model_name": A.upscale})
    node("up", "ImageUpscaleWithModel",
         {"upscale_model": ["upm", 0], "image": out})
    out = ["up", 0]
node("save", "SaveImage", {"images": out, "filename_prefix": "vace" + A.tag})


def validate():
    """Check every class and every input name against the live server.

    This exists because all three of the mistakes in the module docstring
    present identically — an HTTP 400 whose body names one input on one node,
    minutes into a paid instance. Reading the schema costs a second and says
    the same thing before anything is queued.
    """
    try:
        info = json.loads(urllib.request.urlopen(
            A.host + "/object_info", timeout=60).read())
    except Exception as e:                                # noqa: BLE001
        print(f"could not read /object_info ({e}) — skipping validation")
        return True
    bad = []
    for cid, n in G.items():
        cls = n["class_type"]
        if cls not in info:
            bad.append(f"{cid}: no such node class {cls!r}")
            continue
        it = info[cls].get("input", {})
        known = set(it.get("required", {})) | set(it.get("optional", {})) \
            | set(it.get("hidden", {}))
        for k in n["inputs"]:
            if k not in known:
                bad.append(f"{cid} ({cls}): unknown input {k!r} — has "
                           + ", ".join(sorted(known)))
        for k in it.get("required", {}):
            if k not in n["inputs"]:
                bad.append(f"{cid} ({cls}): missing required input {k!r}")
    for b in bad:
        print("  GRAPH " + b)
    return not bad


print(f"Wan 2.2 A14B MoE · {A.steps} steps, handover at {BND} · "
      f"{A.w}x{A.h} n={A.n} · denoise {A.denoise} · vace {A.vace} "
      f"end {A.vaceend} · light {A.light} · cfg {A.cfg}")
if A.check and not validate():
    sys.exit("graph does not match this server's schema — nothing queued")

req = urllib.request.Request(
    A.host + "/prompt", data=json.dumps({"prompt": G}).encode(),
    headers={"Content-Type": "application/json"})
try:
    r = json.loads(urllib.request.urlopen(req).read())
    print("queued", r.get("prompt_id"), "number", r.get("number"))
except urllib.error.HTTPError as e:
    print("REJECTED", e.code)
    print(e.read().decode()[:4000])
    raise SystemExit(1)
