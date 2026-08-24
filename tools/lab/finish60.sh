#!/usr/bin/env bash
# Twelve chunks of restyled frames -> one .mp4 with the game's own sound on it.
#
#   tools/lab/finish60.sh ~/fr-video/demo60/out ~/fr-video/demo60/demo60.mp4
#
# Everything the box sends back is `vace_dNN_00001.png`, and there are twelve
# sets of those numbered from one. Interleaving them by name would give
# 00,01,02… of every chunk in turn, so the frames are relinked into one ordered
# sequence first — chunk, then frame within it — and only then does ffmpeg see
# them.
#
# Upscaling is Lanczos and local, and that is a measured choice rather than a
# convenience: ESRGAN was 40-45 % of the wall clock of every run on the rented
# box and at 720p it is no longer buying resolution. Doing it here costs
# nothing per minute.
#
# The audio is the source clip's own Opus, cut to the same window the control
# frames were cut to, and it is NOT regenerated — only the video is enhanced.
set -euo pipefail

SRC="${1:-$HOME/fr-video/demo60/out}"
DST="${2:-$HOME/fr-video/demo60/demo60.mp4}"
CLIP="${CLIP:-/mnt/c/tmp/flamme-retarde/fr-clip-20260823-135829.webm}"
FPS="${FPS:-16}"
OUTW="${OUTW:-1920}"
TAG="${TAG:-_d}"
WORK="$(mktemp -d /tmp/finish60.XXXXXX)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/seq"
n=0
for c in $(seq -w 0 11); do
  # `sort -V` and not `sort`: frame 10 sorts before frame 9 otherwise, and a
  # chunk in the wrong order is a chunk that plays backwards in the middle.
  mapfile -t fs < <(find "$SRC" -maxdepth 1 -name "vace${TAG}${c}_*" | sort -V)
  if [ "${#fs[@]}" -eq 0 ]; then
    echo "chunk $c: NO FRAMES — the film will be short by 81" >&2
    continue
  fi
  echo "chunk $c: ${#fs[@]} frames"
  for f in "${fs[@]}"; do
    ln -s "$(readlink -f "$f")" "$(printf '%s/seq/%05d.png' "$WORK" "$n")"
    n=$((n + 1))
  done
done
echo "$n frames in sequence ($(python3 -c "print(f'{$n/$FPS:.2f}')") s at $FPS fps)"
[ "$n" -gt 0 ] || { echo "nothing to encode" >&2; exit 1; }

# Lanczos to the delivery width, in place of the box's ESRGAN.
mkdir -p "$WORK/up"
python3 "$(dirname "$0")/../upscale.py" "$WORK/seq" "$WORK/up" \
  --mode lanczos --outw "$OUTW"

DUR=$(python3 -c "print(f'{$n/$FPS:.4f}')")
/usr/bin/ffmpeg -y -loglevel error \
  -framerate "$FPS" -i "$WORK/up/%05d.png" \
  -ss 0 -t "$DUR" -i "$CLIP" \
  -map 0:v:0 -map 1:a:0 \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p \
  -vf "fps=${FPS}" \
  -c:a aac -b:a 160k -shortest \
  "$DST"

ls -lh "$DST"
/usr/bin/ffprobe -v error -show_entries format=duration \
  -show_entries stream=codec_name,width,height -of default=noprint_wrappers=1 "$DST"
