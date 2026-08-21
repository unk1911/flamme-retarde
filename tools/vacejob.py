#!/usr/bin/env python3
"""Queue one VACE restyle of a rendered cutscene into a running ComfyUI.

    python3 vacejob.py --frames ~/fr-video/full/frames --n 181 \
        --w 848 --h 480 --tag _full3 --steps 12 --light 1.0 --sim2real 0.55 \
        --vace 1.0 --swap 24 --seed 7731 --denoise 0.70 \
        --ctx 81 --ctxover 24 --upscale RealESRGAN_x4plus.pth --outw 1920

Why VACE and not plain video-to-video, once, because it was learned the
expensive way: plain v2v has exactly one dial — how much noise to add before
resampling — and neither end of it works. Low, and nothing changes; high, and
the model repaints the shot as a digital painting with people in it who were
never there. VACE is the control model: the game frames go in as a *control
signal*, so the sampler can run at full strength while the geometry and the
camera are held by something other than luck.

Three knobs matter and they interact:

  --vace       how hard the control signal holds. 1.0 is "do not move anything".
  --sim2real   the ditto LoRA, trained on exactly rendered -> photographed.
  --denoise    below 1.0 the sampler starts from the *render's own latents*
               rather than from noise, which is the knob that stops it
               inventing. Takes 1 and 2 ran from pure noise with only VACE
               holding them, and both decided there was an open space where
               the bathroom is.

The distill LoRA runs at cfg 1.0, which makes the negative prompt inert. It is
still passed, because a text embed is required and an empty one is worse.
"""

import argparse
import json
import urllib.request

AP = argparse.ArgumentParser()
AP.add_argument("--frames", required=True)
AP.add_argument("--n", type=int, default=181)
AP.add_argument("--w", type=int, default=848)
AP.add_argument("--h", type=int, default=480)
AP.add_argument("--tag", default="_vace")
AP.add_argument("--steps", type=int, default=12)
AP.add_argument("--cfg", type=float, default=1.0)
AP.add_argument("--shift", type=float, default=5.0)
AP.add_argument("--seed", type=int, default=7731)
AP.add_argument("--light", type=float, default=1.0)      # cfg-step-distill
AP.add_argument("--sim2real", type=float, default=0.55)
AP.add_argument("--vace", type=float, default=1.0)
AP.add_argument("--swap", type=int, default=24)
AP.add_argument("--denoise", type=float, default=1.0)
AP.add_argument("--ctx", type=int, default=0)            # 0 = one shot
AP.add_argument("--ctxover", type=int, default=24)
AP.add_argument("--ctxstride", type=int, default=4)   # pixel frames; 4 = 1 latent
AP.add_argument("--upscale", default=None)
AP.add_argument("--outw", type=int, default=0)
AP.add_argument("--pos", default=None, help="override the positive prompt")
AP.add_argument("--ref", default=None,
                help="photograph(s) of the real subject, comma-separated paths")
AP.add_argument("--host", default="http://127.0.0.1:8188")
A = AP.parse_args()

POS = ("photorealistic footage of a Dalmatian seaside holiday cabin interior "
       "and terrace in bright August afternoon light, real photographed video, "
       "natural sunlight through windows, real wood and plaster and tile "
       "surfaces, shallow depth of field, film grain, 35mm, sharp fine detail, "
       "real fabric, real glass, cinematic colour grade")
NEG = ("cartoon, cgi, render, 3d, video game, low poly, flat shading, "
       "illustration, painting, blurry, distorted geometry, extra people, "
       "text, watermark")

G = {}


def node(cid, cls, inputs):
    G[cid] = {"class_type": cls, "inputs": inputs}
    return cid


# ── the models ──────────────────────────────────────────────────────────────
node("vae", "WanVideoVAELoader",
     {"model_name": "wan_2.1_vae.safetensors", "precision": "bf16"})
node("t5", "LoadWanVideoT5TextEncoder",
     {"model_name": "umt5-xxl-enc-fp8_e4m3fn.safetensors", "precision": "bf16",
      "load_device": "offload_device", "quantization": "disabled"})
node("swap", "WanVideoBlockSwap",
     {"blocks_to_swap": A.swap, "offload_img_emb": True,
      "offload_txt_emb": True, "use_non_blocking": True,
      # Follows `--swap`, rather than being 8 whatever happens. Hardcoded, it
      # kept 2.9 GB of VACE blocks on the CPU of an 80 GB H100 that had asked
      # for no swapping at all — which does not break anything, it just quietly
      # pays PCIe for nothing on exactly the machine rented to avoid that.
      "vace_blocks_to_swap": 8 if A.swap else 0})

# The two LoRAs, chained. lightx2v is the cfg-step distill — it is what makes
# twelve steps enough — and ditto_sim2real is the one doing the actual job.
node("lora1", "WanVideoLoraSelect",
     {"lora": "Wan21_T2V_14B_lightx2v_cfg_step_distill_lora_rank32.safetensors",
      "strength": A.light, "low_mem_load": False})
node("lora2", "WanVideoLoraSelect",
     {"lora": "Wan21_14B_VACE_lora_ditto_sim2real_bf16.safetensors",
      "strength": A.sim2real, "prev_lora": ["lora1", 0], "low_mem_load": False})

node("vacesel", "WanVideoVACEModelSelect",
     {"vace_model": "Wan2_1-VACE_module_14B_fp8_e4m3fn.safetensors"})
node("model", "WanVideoModelLoader",
     {"model": "Wan2_1-T2V-14B_fp8_e4m3fn.safetensors",
      "base_precision": "bf16", "quantization": "fp8_e4m3fn",
      "load_device": "offload_device", "attention_mode": "sageattn",
      "block_swap_args": ["swap", 0], "lora": ["lora2", 0],
      "vace_model": ["vacesel", 0]})

node("txt", "WanVideoTextEncode",
     {"t5": ["t5", 0], "positive_prompt": A.pos or POS, "negative_prompt": NEG,
      "force_offload": True})

# ── the control signal ──────────────────────────────────────────────────────
node("src", "VHS_LoadImagesPath",
     {"directory": A.frames, "image_load_cap": A.n, "skip_first_images": 0,
      "select_every_nth": 1})
node("fit", "ImageResizeKJ",
     {"image": ["src", 0], "width": A.w, "height": A.h,
      "upscale_method": "lanczos", "keep_proportion": False,
      "divisible_by": 16, "crop": "disabled"})
# ── ref_images: a photograph of the actual room ─────────────────────────────
#
# The second conditioning channel, and the one that took longest to reach for.
# `input_frames` says where everything is; `ref_images` says what it looks like.
# Without it the entire content-anchoring budget goes on a text description
# competing against everything the model knows about holiday rentals — which is
# how a grey wall became navy and a room with no curtains got curtains, twice,
# in prompts that said "no curtains". A photograph does not argue with the
# prior, it replaces it.
#
# Fed through VHS_LoadImagePath rather than LoadImage because that one wants the
# file inside ComfyUI's own input directory, and these arrive from a phone.
vace_in = {"vae": ["vae", 0], "width": A.w, "height": A.h, "num_frames": A.n,
           "strength": A.vace, "vace_start_percent": 0.0,
           "vace_end_percent": 1.0, "input_frames": ["fit", 0],
           "tiled_vae": False}
if A.ref:
    paths = [r.strip() for r in A.ref.split(",") if r.strip()]
    prev = None
    for i, r in enumerate(paths):
        node("ref%d" % i, "VHS_LoadImagePath",
             {"image": r, "custom_width": A.w, "custom_height": A.h})
        # More than one reference is a batch, so they stack rather than
        # replacing each other.
        if prev is None:
            prev = ["ref%d" % i, 0]
        else:
            node("refcat%d" % i, "ImageBatch",
                 {"image1": prev, "image2": ["ref%d" % i, 0]})
            prev = ["refcat%d" % i, 0]
    vace_in["ref_images"] = prev
node("vaceenc", "WanVideoVACEEncode", vace_in)

samp = {"model": ["model", 0], "image_embeds": ["vaceenc", 0],
        "steps": A.steps, "cfg": A.cfg, "shift": A.shift, "seed": A.seed,
        "force_offload": True, "scheduler": "unipc", "riflex_freq_index": 0,
        "text_embeds": ["txt", 0]}

# Start from the render rather than from noise. This is the knob that stops it
# inventing rooms — see the module docstring.
if A.denoise < 1.0:
    node("enc", "WanVideoEncode",
         {"vae": ["vae", 0], "image": ["fit", 0], "enable_vae_tiling": False,
          "tile_x": 272, "tile_y": 272, "tile_stride_x": 144,
          "tile_stride_y": 128, "noise_aug_strength": 0.0,
          "latent_strength": 1.0})
    samp["samples"] = ["enc", 0]
    samp["denoise_strength"] = A.denoise

# 81 frames is the model's native chunk (5.06 s at 16 fps). Anything longer
# needs sliding windows or it degrades into unrelated shots stitched together.
if A.ctx:
    node("ctx", "WanVideoContextOptions",
         {"context_schedule": "uniform_standard", "context_frames": A.ctx,
          "context_stride": A.ctxstride, "context_overlap": A.ctxover,
          "freenoise": True, "verbose": False})
    samp["context_options"] = ["ctx", 0]

node("samp", "WanVideoSampler", samp)
node("dec", "WanVideoDecode",
     {"vae": ["vae", 0], "samples": ["samp", 0], "enable_vae_tiling": True,
      "tile_x": 272, "tile_y": 272, "tile_stride_x": 144,
      "tile_stride_y": 128})

out = ["dec", 0]
if A.upscale:
    node("upm", "UpscaleModelLoader", {"model_name": A.upscale})
    node("up", "ImageUpscaleWithModel",
         {"upscale_model": ["upm", 0], "image": out})
    out = ["up", 0]
    if A.outw:
        node("down", "ImageScale",
             {"image": out, "upscale_method": "lanczos", "width": A.outw,
              "height": int(round(A.outw * A.h / A.w / 2)) * 2,
              "crop": "disabled"})
        out = ["down", 0]

node("save", "SaveImage", {"images": out, "filename_prefix": "vace" + A.tag})

req = urllib.request.Request(
    A.host + "/prompt",
    data=json.dumps({"prompt": G}).encode(),
    headers={"Content-Type": "application/json"})
try:
    r = json.loads(urllib.request.urlopen(req).read())
    print("queued", r.get("prompt_id"), "number", r.get("number"))
except urllib.error.HTTPError as e:
    print("REJECTED", e.code)
    print(e.read().decode()[:4000])
    raise SystemExit(1)
