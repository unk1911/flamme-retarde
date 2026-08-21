#!/usr/bin/env python3
"""Upscale a directory of PNGs locally, so the upscaler stops costing GPU-hours.

    tools/upscale.py in/ out/ --mode esrgan --outw 1920
    tools/upscale.py in/ out/ --mode lanczos --outw 1920
    tools/upscale.py in/ out/ --mode none

── why this is not just a ComfyUI node ────────────────────────────────────────

Because the question it exists to answer is a *comparison*, and a comparison
has to hold everything else still. Running ESRGAN inside the sampler's own
workflow means the only way to see the shot without it is to render the shot
again — different graph, and 40-45 per cent more rented time for the privilege.
Decode once, bring the native frames home, and make every variant here from
those exact pixels. Same latents, same seed, same everything, for the price of
one run instead of three.

RRDBNet is reimplemented rather than imported: `realesrgan` drags in basicsr,
which drags in a torchvision private API that moved. The proof that this
architecture is the right one is `load_state_dict(strict=True)` below — it
raises on a single missing or unexpected key, so a silently wrong model is not
one of the things that can happen here.
"""

import argparse
import torch
import torch.nn as nn
import torch.nn.functional as F
from pathlib import Path
from PIL import Image
import numpy as np


class ResidualDenseBlock(nn.Module):
    def __init__(self, nf=64, gc=32):
        super().__init__()
        self.conv1 = nn.Conv2d(nf, gc, 3, 1, 1)
        self.conv2 = nn.Conv2d(nf + gc, gc, 3, 1, 1)
        self.conv3 = nn.Conv2d(nf + 2 * gc, gc, 3, 1, 1)
        self.conv4 = nn.Conv2d(nf + 3 * gc, gc, 3, 1, 1)
        self.conv5 = nn.Conv2d(nf + 4 * gc, nf, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(0.2, inplace=True)

    def forward(self, x):
        x1 = self.lrelu(self.conv1(x))
        x2 = self.lrelu(self.conv2(torch.cat((x, x1), 1)))
        x3 = self.lrelu(self.conv3(torch.cat((x, x1, x2), 1)))
        x4 = self.lrelu(self.conv4(torch.cat((x, x1, x2, x3), 1)))
        x5 = self.conv5(torch.cat((x, x1, x2, x3, x4), 1))
        return x5 * 0.2 + x


class RRDB(nn.Module):
    def __init__(self, nf, gc=32):
        super().__init__()
        self.rdb1, self.rdb2, self.rdb3 = (ResidualDenseBlock(nf, gc)
                                           for _ in range(3))

    def forward(self, x):
        return self.rdb3(self.rdb2(self.rdb1(x))) * 0.2 + x


class RRDBNet(nn.Module):
    def __init__(self, nf=64, nb=23, gc=32):
        super().__init__()
        self.conv_first = nn.Conv2d(3, nf, 3, 1, 1)
        self.body = nn.Sequential(*[RRDB(nf, gc) for _ in range(nb)])
        self.conv_body = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_up1 = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_up2 = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_hr = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_last = nn.Conv2d(nf, 3, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(0.2, inplace=True)

    def forward(self, x):
        feat = self.conv_first(x)
        feat = feat + self.conv_body(self.body(feat))
        feat = self.lrelu(self.conv_up1(
            F.interpolate(feat, scale_factor=2, mode="nearest")))
        feat = self.lrelu(self.conv_up2(
            F.interpolate(feat, scale_factor=2, mode="nearest")))
        return self.conv_last(self.lrelu(self.conv_hr(feat)))


AP = argparse.ArgumentParser()
AP.add_argument("src")
AP.add_argument("dst")
AP.add_argument("--mode", default="esrgan", choices=["esrgan", "lanczos", "none"])
AP.add_argument("--outw", type=int, default=1920)
AP.add_argument("--model", default=str(Path.home() / "ComfyUI-setup" / "ComfyUI"
                                       / "models" / "upscale_models"
                                       / "RealESRGAN_x4plus.pth"))
A = AP.parse_args()

src, dst = Path(A.src).expanduser(), Path(A.dst).expanduser()
dst.mkdir(parents=True, exist_ok=True)
files = sorted(src.glob("*.png"))
if not files:
    raise SystemExit(f"no PNGs in {src}")

net = None
if A.mode == "esrgan":
    sd = torch.load(A.model, map_location="cpu", weights_only=True)
    sd = sd.get("params_ema", sd.get("params", sd))
    net = RRDBNet()
    net.load_state_dict(sd, strict=True)      # the architecture check, see above
    net = net.eval().half().cuda()

for i, f in enumerate(files):
    im = Image.open(f).convert("RGB")
    if A.mode == "esrgan":
        t = torch.from_numpy(np.asarray(im).copy()).permute(2, 0, 1)[None]
        t = (t.half().cuda() / 255.0)
        with torch.no_grad():
            t = net(t).clamp(0, 1)
        im = Image.fromarray(
            (t[0].permute(1, 2, 0).float().cpu().numpy() * 255)
            .round().astype("uint8"))
    if A.mode != "none" and A.outw and im.width != A.outw:
        h = int(round(A.outw * im.height / im.width / 2)) * 2
        im = im.resize((A.outw, h), Image.LANCZOS)
    im.save(dst / f.name)
    if i % 20 == 0 or i == len(files) - 1:
        print(f"  {A.mode} {i + 1}/{len(files)} -> {im.size}", flush=True)
print(f"{len(files)} frames -> {dst}")
