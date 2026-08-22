#!/usr/bin/env bash
# Mux one finished VACE run into a deliverable: restyled frames + the baseline's
# own audio track.
#
#   ~/fr-video/assemble.sh _full3 flamme-retarde-photoreal-3.mp4
#
# Two things here are not obvious.
#
# `minterpolate` doubles 16 fps to 32. The model's native rate is 16 and there
# is no honest way to sample more of them, but 16 fps reads as a flipbook on a
# camera move — and this shot is one continuous camera move. Motion-compensated
# interpolation over a shot whose geometry is *held* by VACE is the easy case
# for it: the scene is the render's scene, so the vectors are real.
#
# `/usr/bin/ffmpeg`, spelled out, because the conda ffmpeg first on PATH has no
# libx264 and says so by complaining about `-preset`, which sends you looking in
# entirely the wrong place.
set -euo pipefail

TAG="${1:-_full3}"
OUT="${2:-flamme-retarde-photoreal-3.mp4}"
SRC="$HOME/ComfyUI-setup/ComfyUI/output"
WORK="$HOME/fr-video/out$TAG"
FF=/usr/bin/ffmpeg

rm -rf "$WORK"; mkdir -p "$WORK"
i=0
for f in $(ls "$SRC" | grep "^vace${TAG}_" | sort); do
  cp "$SRC/$f" "$(printf '%s/f_%05d.png' "$WORK" $i)"
  i=$((i + 1))
done
echo "[assemble] $i frames from $SRC/vace${TAG}_*"
[ "$i" -gt 0 ] || { echo "[assemble] nothing to do"; exit 1; }

"$FF" -y -loglevel warning -framerate 16 -i "$WORK/f_%05d.png" \
  -i "$HOME/fr-video/srcfull.mp4" \
  -filter_complex '[0:v]minterpolate=fps=32:mi_mode=mci:mc_mode=aobmc:vsbmc=1[v]' \
  -map '[v]' -map 1:a \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 160k -shortest "$HOME/fr-video/$OUT"

ls -la "$HOME/fr-video/$OUT"
"$FF" -hide_banner -i "$HOME/fr-video/$OUT" 2>&1 | grep -E "Duration|Stream"
