#!/usr/bin/env python3
"""LTX-2.5 Layout-to-Render: the game render as the layout, through ComfyUI's API.

    tools/ltxjob.py --frames /home/ubuntu/job/frames --n 41 --w 1024 --h 640 \
        --look /home/ubuntu/job/refs/look.png --pos "..." --tag _l1 \
        --host http://127.0.0.1:18188

The graph is Lightricks' own `LTX-2.5_ICLoRA_Layout_To_Render_Two_Stage_Distilled
.json` (from the gated Lightricks/LTX-2.5-22b-IC-LoRA-Layout-To-Render repo)
flattened into API form, node for node, with two substitutions: the layout comes
from a PNG directory (VHS_LoadImagesPath, as vacejob22 reads it) instead of
LoadVideo, and the result is saved as PNG frames rather than an mp4, so both
pipelines leave the same kind of output to compare.

    stage 1  half size (w/2 x h/2), distilled 8 sigmas, euler_ancestral, cfg 1
             layout guide at frame 0, look still at frame -1
    stage 2  latent x2 upsampler, the same guides re-added at full size,
             the last 3 sigmas of stage 1's schedule (it continues, not restarts)

cfg 1, so the negative prompt is inert (see restyle-prompt-dominates) and the
positive prompt is the whole text conditioning. The README asks for one or two
sentences describing the finished shot and never the words clay/3D/Unreal.

Knobs added for the 1 Oct sweep (all default to the shipped graph):

    --ctl union      Lightricks' Union Control IC-LoRA (depth / canny / pose,
                     LTX-2.3 weights, used by their 2.5 workflow) instead of
                     Layout-to-Render. --frames is then the depth or canny
                     sequence. As shipped it re-adds no guide in stage 2.
    --first P        open on P (an image, or a PNG directory with --first-n
                     frames) through LTXVImgToVideoInplace: those frames are
                     encoded into the latent and held, in both stages. This is
                     how a long shot is chained — the next pass opens on the
                     last --first-n frames of the one before — and how a look
                     image that is ALIGNED with layout frame 0 (a Wan restyle
                     of frame 0) is used as frame 0 rather than beside it.
    --cfg 3 --neg …  real CFG on the distilled model (2x the compute).
    --steps1 12      stage 1 resampled to N steps along the distilled curve.
    --no-s2guide     stage 2 without the layout re-added at full size.

LICENCE: LTX-2.x Community License + Lightricks AUP forbid sexually explicit
content in running the model and in its outputs. Exterior, non-explicit shots
only — never the kabina footage.

Files it expects in ComfyUI/models (official bf16 choice):
    diffusion_models/ltx-2.5-22b-distilled-transformer-bf16.safetensors  42 GB
    text_encoders/gemma4-12b-with-proj-ltx-2.5-bf16.safetensors          26 GB
    vae/ltx-2.5-video-vae-bf16.safetensors
    latent_upscale_models/ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors
    loras/ltx-2.5-22b-ic-lora-layout-to-render-1.0.safetensors
and ComfyUI master + Lightricks/ComfyUI-LTXVideo (LTXAddVideoICLoRAGuide,
LTXICLoRALoaderModelOnly).
"""
import argparse
import json
import sys
import urllib.error
import urllib.request

AP = argparse.ArgumentParser()
AP.add_argument("--frames", required=True, help="box-side PNG directory")
AP.add_argument("--n", type=int, default=41)
AP.add_argument("--skip", type=int, default=0)
AP.add_argument("--w", type=int, default=1024, help="final width, /64")
AP.add_argument("--h", type=int, default=640, help="final height, /64")
AP.add_argument("--fps", type=float, default=16.0)
AP.add_argument("--look", default="", help="box-side look still, IC guide at -1 "
                "(art direction, as shipped); empty = none")
AP.add_argument("--first", default="", help="box-side image or PNG dir held as "
                "the opening frame(s) (LTXVImgToVideoInplace), both stages")
AP.add_argument("--first-n", type=int, default=1, help="frames of a --first dir, 8k+1")
AP.add_argument("--first-skip", type=int, default=0)
AP.add_argument("--first-str", type=float, default=1.0)
AP.add_argument("--ctl", choices=("l2r", "union"), default="l2r")
AP.add_argument("--cfg", type=float, default=1.0)
AP.add_argument("--steps1", type=int, default=0, help="resample stage 1 to N steps")
AP.add_argument("--s2guide", dest="s2guide", action="store_true", default=None)
AP.add_argument("--no-s2guide", dest="s2guide", action="store_false")
AP.add_argument("--pos", required=True)
AP.add_argument("--neg", default="")
AP.add_argument("--seed", type=int, default=42)
AP.add_argument("--guide", type=float, default=1.0, help="layout guide strength")
AP.add_argument("--lookstr", type=float, default=1.0, help="look still strength")
AP.add_argument("--lora", type=float, default=1.0, help="IC-LoRA strength")
AP.add_argument("--sigmas1", default="1.0, 0.99375, 0.9875, 0.98125, 0.975, "
                "0.909375, 0.725, 0.421875, 0.0")
AP.add_argument("--sigmas2", default="0.909375, 0.725, 0.421875, 0.0")
AP.add_argument("--no-stage2", dest="stage2", action="store_false",
                help="decode stage 1 at half size (w/2 x h/2)")
AP.add_argument("--tag", default="_ltx")
AP.add_argument("--host", default="http://127.0.0.1:8188")
AP.add_argument("--no-check", dest="check", action="store_false")
A = AP.parse_args()

_n = (A.n - 1) // 8 * 8 + 1
if _n != A.n:
    print(f"--n {A.n} is not 8k+1; using {_n}")
    A.n = _n
if A.w % 64 or A.h % 64:
    sys.exit("--w/--h must divide by 64 (stage 1 runs at half of it, /32)")
W1, H1 = (A.w // 2, A.h // 2) if A.stage2 else (A.w, A.h)
if not A.look and not A.first:
    sys.exit("give --look and/or --first: the art direction has to come from somewhere")
if A.s2guide is None:
    A.s2guide = A.ctl == "l2r"           # what each shipped workflow does
LORA = {"l2r": "ltx-2.5-22b-ic-lora-layout-to-render-1.0.safetensors",
        "union": "ltx-2.3-22b-ic-lora-union-control-ref0.5.safetensors"}[A.ctl]
if A.steps1:
    # the distilled curve, resampled in step-index space: same start and end,
    # same shape, N steps instead of 8
    _s = [float(x) for x in A.sigmas1.split(",")]
    _o = []
    for k in range(A.steps1 + 1):
        x = k * (len(_s) - 1) / A.steps1
        i = min(int(x), len(_s) - 2)
        _o.append(_s[i] + (_s[i + 1] - _s[i]) * (x - i))
    A.sigmas1 = ", ".join(f"{v:.6f}" for v in _o)

G = {}


def node(cid, cls, inputs):
    G[cid] = {"class_type": cls, "inputs": inputs}
    return cid


node("vae", "VAELoader", {"vae_name": "ltx-2.5-video-vae-bf16.safetensors"})
node("unet", "UNETLoader", {"unet_name":
     "ltx-2.5-22b-distilled-transformer-bf16.safetensors",
     "weight_dtype": "default"})
node("clip", "CLIPLoader", {"clip_name":
     "gemma4-12b-with-proj-ltx-2.5-bf16.safetensors", "type": "ltxv",
     "device": "default"})
node("iclora", "LTXICLoRALoaderModelOnly",
     {"model": ["unet", 0], "lora_name":
      LORA, "strength_model": A.lora})
node("upm", "LatentUpscaleModelLoader", {"model_name":
     "ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors"})

node("tpos", "CLIPTextEncode", {"clip": ["clip", 0], "text": A.pos})
node("tneg", "CLIPTextEncode", {"clip": ["clip", 0], "text": A.neg})
node("cond", "LTXVConditioning", {"positive": ["tpos", 0],
     "negative": ["tneg", 0], "frame_rate": A.fps})

node("src", "VHS_LoadImagesPath",
     {"directory": A.frames, "image_load_cap": A.n,
      "skip_first_images": A.skip, "select_every_nth": 1})
if A.look:
    node("look", "VHS_LoadImagePath",
         {"image": A.look, "custom_width": A.w, "custom_height": A.h})
if A.first:
    if A.first.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
        node("first", "VHS_LoadImagePath",
             {"image": A.first, "custom_width": A.w, "custom_height": A.h})
    else:
        node("first", "VHS_LoadImagesPath",
             {"directory": A.first, "image_load_cap": A.first_n,
              "skip_first_images": A.first_skip, "select_every_nth": 1})


def inplace(prefix, latent):
    """Hold the opening frame(s) — before any IC guide is appended, as in
    Lightricks' Union Control graph."""
    if not A.first:
        return latent
    node(prefix + "ff", "LTXVImgToVideoInplace", {"vae": ["vae", 0],
         "image": ["first", 0], "latent": latent, "strength": A.first_str,
         "bypass": False})
    return [prefix + "ff", 0]


def guides(prefix, pos, neg, latent, dsf):
    """Layout at frame 0 (stretch), look still at -1 (centre crop) — as shipped."""
    g = {"vae": ["vae", 0], "use_tiled_encode": False, "tile_size": 256,
         "tile_overlap": 64}
    node(prefix + "lay", "LTXAddVideoICLoRAGuide", dict(g,
         positive=pos, negative=neg, latent=latent, image=["src", 0],
         frame_idx=0, strength=A.guide, latent_downscale_factor=dsf,
         crop="disabled"))
    if not A.look:
        return prefix + "lay"
    node(prefix + "lk", "LTXAddVideoICLoRAGuide", dict(g,
         positive=[prefix + "lay", 0], negative=[prefix + "lay", 1],
         latent=[prefix + "lay", 2], image=["look", 0],
         frame_idx=-1, strength=A.lookstr, latent_downscale_factor=dsf,
         crop="center"))
    return prefix + "lk"


def look_only(prefix, pos, neg, latent):
    """Stage 2 without the layout: only the look still, if there is one."""
    if not A.look:
        return None
    g = {"vae": ["vae", 0], "use_tiled_encode": False, "tile_size": 256,
         "tile_overlap": 64}
    node(prefix + "lk", "LTXAddVideoICLoRAGuide", dict(g,
         positive=pos, negative=neg, latent=latent, image=["look", 0],
         frame_idx=-1, strength=A.lookstr, latent_downscale_factor=1.0,
         crop="center"))
    return prefix + "lk"


def sample(prefix, pos_neg_lat, sigmas):
    node(prefix + "noise", "RandomNoise", {"noise_seed": A.seed})
    node(prefix + "ks", "KSamplerSelect", {"sampler_name": "euler_ancestral"})
    node(prefix + "sig", "ManualSigmas", {"sigmas": sigmas})
    node(prefix + "cfg", "CFGGuider", {"model": ["iclora", 0],
         "positive": [pos_neg_lat, 0], "negative": [pos_neg_lat, 1],
         "cfg": A.cfg})
    node(prefix + "samp", "SamplerCustomAdvanced", {
         "noise": [prefix + "noise", 0], "guider": [prefix + "cfg", 0],
         "sampler": [prefix + "ks", 0], "sigmas": [prefix + "sig", 0],
         "latent_image": [pos_neg_lat, 2]})
    node(prefix + "crop", "LTXVCropGuides", {"positive": [pos_neg_lat, 0],
         "negative": [pos_neg_lat, 1], "latent": [prefix + "samp", 0]})
    return [prefix + "crop", 2]


node("empty", "EmptyLTXVLatentVideo",
     {"width": W1, "height": H1, "length": A.n, "batch_size": 1})
g1 = guides("s1", ["cond", 0], ["cond", 1], inplace("s1", ["empty", 0]),
            ["iclora", 1])
lat = sample("s1", g1, A.sigmas1)

if A.stage2:
    node("ups", "LTXVLatentUpsampler", {"samples": lat,
         "upscale_model": ["upm", 0], "vae": ["vae", 0]})
    up = inplace("s2", ["ups", 0])
    if A.s2guide:
        g2 = guides("s2", ["cond", 0], ["cond", 1], up, 1.0)
    else:
        g2 = look_only("s2", ["cond", 0], ["cond", 1], up)
    if g2 is None:
        # no guide at all: sample straight on the held latent, nothing to crop
        node("s2pass", "LTXVCropGuides", {"positive": ["cond", 0],
             "negative": ["cond", 1], "latent": up})
        g2 = "s2pass"
    lat = sample("s2", g2, A.sigmas2)

node("dec", "VAEDecodeTiled", {"samples": lat, "vae": ["vae", 0],
     "tile_size": 512, "overlap": 64, "temporal_size": 128,
     "temporal_overlap": 32})
node("save", "SaveImage", {"images": ["dec", 0], "filename_prefix": "ltx" + A.tag})


def validate():
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
                bad.append(f"{cid} ({cls}): unknown input {k!r}")
        for k in it.get("required", {}):
            if k not in n["inputs"]:
                bad.append(f"{cid} ({cls}): missing required input {k!r}")
    for b in bad:
        print("  GRAPH " + b)
    return not bad


print(f"LTX-2.5 {A.ctl} · {W1}x{H1}" + (f" -> {A.w}x{A.h}" if A.stage2 else "")
      + f" n={A.n} · guide {A.guide} look {A.lookstr if A.look else '-'} lora {A.lora}"
      + f" · first {A.first_n if A.first else '-'} · cfg {A.cfg}"
      + f" · s1 {len(A.sigmas1.split(',')) - 1} steps · s2guide {A.s2guide} · seed {A.seed}")
if A.check and not validate():
    sys.exit("graph does not match this server's schema — nothing queued")
req = urllib.request.Request(A.host + "/prompt",
                             data=json.dumps({"prompt": G}).encode(),
                             headers={"Content-Type": "application/json"})
try:
    r = json.loads(urllib.request.urlopen(req).read())
    print("queued", r.get("prompt_id"), "number", r.get("number"))
except urllib.error.HTTPError as e:
    print("REJECTED", e.code)
    print(e.read().decode()[:4000])
    raise SystemExit(1)
