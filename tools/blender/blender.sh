#!/usr/bin/env bash
#
# Blender, on the GPU, on the machine this is actually being run on.
#
# EEVEE is a rasteriser and a rasteriser needs a GL context. There is no display
# under WSL, so Mesa falls back to llvmpipe and renders it on the CPU, and one
# 760×1120 preview frame out of human_mh.py costs 86 seconds. A pose argument
# settled by looking at three of those is four minutes of waiting per guess,
# which is why the poses in that file have a paper trail of wrong ones.
#
# WSL does expose the host GPU. Not as /dev/dri, which is what everything looks
# for and what is missing here — as /dev/dxg, with Direct3D 12 over the top of
# it, and Mesa ships a Gallium driver that speaks exactly that. Pointed at it,
# the same frame is 6 seconds. Fourteen times, for two environment variables.
#
# They go here rather than in the Python because a process picks its GL driver
# on the way up, long before a script gets a say.
#
# Checked against llvmpipe on the same pose: mean channel difference 0.001 out
# of 255, and the largest difference anywhere in the frame is on an antialiased
# silhouette edge. It is the same picture.
#
# And then, on a laptop, it picks the wrong card. D3D12 enumerates every adapter
# Windows has and Mesa takes the first, which on a machine with switchable
# graphics is the integrated one — so this was quietly rendering on an Intel UHD
# while a 4090 sat idle next to it. Measured on --reskin KNEEL --views side:
#
#     llvmpipe          72.4 s total,  66.2 s of it the render
#     d3d12, Intel UHD  13.1 s total,   7.0 s
#     d3d12, RTX 4090   10.4 s total,   2.4 s
#
# Same picture again — 3 pixels out of 851 200 differ by more than 4/255, all of
# them on a silhouette. The total is no longer render-bound: what is left is
# eight seconds of opening a 50 MB blend and baking twenty-two clips, which is
# where the next lever is if anyone wants one.
#
# Everything degrades. On a box with no /dev/dxg — a real Linux machine, a CI
# runner, a Mac — this leaves the environment alone and Blender chooses for
# itself, which is what it was doing before. The adapter name is a *preference*:
# with no matching adapter Mesa falls back to the first one, so an all-Intel or
# all-AMD box is no worse off than it was.
#
#     tools/blender/blender.sh -b build/human_mh.blend \
#         -P tools/blender/human_mh.py -- --reskin KNEEL --views side
#
set -euo pipefail

if [ -c /dev/dxg ] && [ -e /usr/lib/x86_64-linux-gnu/dri/d3d12_dri.so ]; then
  export GALLIUM_DRIVER=d3d12
  # libd3d12.so and libdxcore.so live here and nowhere on the default path.
  export LD_LIBRARY_PATH=/usr/lib/wsl/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}
  # Substring match against the adapter description, so this is the discrete
  # card on any of the three vendors without having to know which one is here.
  : "${MESA_D3D12_DEFAULT_ADAPTER_NAME:=NVIDIA}"
  export MESA_D3D12_DEFAULT_ADAPTER_NAME
fi

exec blender "$@"
