#!/usr/bin/env bash
# One finished run -> the mp4s the user actually looks at.
#
#   ~/fr-video/lab/variants.sh A1 "aerial-prompt" [--upscales]
#
# Without --upscales this makes the native-resolution mp4 only. With it, the
# same frames are also run through Lanczos and through ESRGAN, which is the
# upscaler A/B: three files off ONE rented render, from identical pixels, so
# the only difference between them is the upscaling.
set -uo pipefail
cd "$HOME/flamme-retarde"
TAG="${1:?tag}"; NAME="${2:?name}"; MODE="${3:-}"
LAB="$HOME/fr-video/lab"
SRC="$LAB/$TAG"
n=$(ls "$SRC"/*.png 2>/dev/null | wc -l)
[ "$n" -gt 0 ] || { echo "[var] $TAG: no frames"; exit 1; }

# The interior shot has no captured audio; the aerial one does. Passing a
# missing path is fine, lab-assemble.sh drops the audio track.
case "$SRC" in *) AUD="$HOME/fr-video/live/frames-audio.m4a" ;; esac
grep -q "^$TAG	.*entry" "$LAB"/*.tsv 2>/dev/null && AUD=/nonexistent

tools/lab-assemble.sh "$SRC" "fr-${TAG}-${NAME}.mp4" "$AUD"

if [ "$MODE" = "--upscales" ]; then
  for m in lanczos esrgan; do
    python3 tools/upscale.py "$SRC" "$LAB/${TAG}_$m" --mode $m --outw 1920 \
      | tail -1
    tools/lab-assemble.sh "$LAB/${TAG}_$m" "fr-${TAG}-${NAME}-${m}1920.mp4" "$AUD"
  done
fi
