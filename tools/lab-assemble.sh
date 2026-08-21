#!/usr/bin/env bash
# Turn one directory of restyled frames into a deliverable mp4.
#
#   tools/lab-assemble.sh ~/fr-video/lab/E1/native E1-native.mp4 [audio.m4a]
#
# Unlike assemble.sh this takes the frame directory as an argument rather than
# reaching into ComfyUI's output, because burst runs land wherever rsync put
# them and a comparison needs many of them side by side.
#
# Everything except the frames is held identical on purpose — same fps, same
# interpolation, same crf — so that when two of these look different, the
# frames are the only thing that can have caused it.
#
# `/usr/bin/ffmpeg` spelled out: the conda ffmpeg first on PATH has no libx264
# and reports it by complaining about `-preset`, which sends you looking in
# entirely the wrong place.
set -euo pipefail

SRC="${1:?frame directory}"
OUT="${2:?output filename}"
AUD="${3:-$HOME/fr-video/live/frames-audio.m4a}"
DEST="${LAB_DEST:-/mnt/c/tmp/flamme-retarde}"
FF=/usr/bin/ffmpeg

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
i=0
for f in $(ls "$SRC"/*.png 2>/dev/null | sort); do
  ln -s "$(readlink -f "$f")" "$(printf '%s/f_%05d.png' "$WORK" $i)"
  i=$((i + 1))
done
[ "$i" -gt 0 ] || { echo "[lab] no frames in $SRC"; exit 1; }

mkdir -p "$DEST"
# minterpolate doubles the model's native 16 fps to 32. 16 reads as a flipbook
# on a camera move and there is no honest way to sample more of them; motion
# compensation over a shot whose geometry is *held* by VACE is the easy case,
# because the scene is the render's scene and the vectors are real.
FILT='[0:v]minterpolate=fps=32:mi_mode=mci:mc_mode=aobmc:vsbmc=1[v]'

if [ -f "$AUD" ]; then
  "$FF" -y -loglevel error -framerate 16 -i "$WORK/f_%05d.png" -i "$AUD" \
    -filter_complex "$FILT" -map '[v]' -map 1:a \
    -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart \
    -c:a aac -b:a 160k -shortest "$DEST/$OUT"
else
  "$FF" -y -loglevel error -framerate 16 -i "$WORK/f_%05d.png" \
    -filter_complex "$FILT" -map '[v]' \
    -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart \
    "$DEST/$OUT"
fi

printf '[lab] %-42s %s frames  %s\n' "$OUT" "$i" \
  "$(du -h "$DEST/$OUT" | cut -f1)"
