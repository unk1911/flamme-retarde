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
# Everything degrades. On a box with no /dev/dxg — a real Linux machine, a CI
# runner, a Mac — this leaves the environment alone and Blender chooses for
# itself, which is what it was doing before.
#
#     tools/blender/blender.sh -b build/human_mh.blend \
#         -P tools/blender/human_mh.py -- --reskin KNEEL --views side
#
set -euo pipefail

if [ -c /dev/dxg ] && [ -e /usr/lib/x86_64-linux-gnu/dri/d3d12_dri.so ]; then
  export GALLIUM_DRIVER=d3d12
  # libd3d12.so and libdxcore.so live here and nowhere on the default path.
  export LD_LIBRARY_PATH=/usr/lib/wsl/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}
fi

exec blender "$@"
