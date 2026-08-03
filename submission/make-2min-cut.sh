#!/usr/bin/env bash
# Cut the 3:36 demo down to the 2:00 slot inside the recorded pitch.
#
# Every in and out point below falls in a GAP between narration lines, taken
# from narration.srt — cutting on a round number would chop a sentence in half
# and the subtitle with it. Segments are re-encoded rather than stream-copied
# so the joins land on the exact frame instead of the nearest keyframe.
#
#   bash submission/make-2min-cut.sh
#
# Output: submission/yau-lok-demo-2min.mp4

set -euo pipefail
cd "$(dirname "$0")"

SRC=yau-lok-demo.mp4
OUT=yau-lok-demo-2min.mp4
WORK=.cut

[ -f "$SRC" ] || { echo "no $SRC — run assemble.sh first"; exit 1; }

# start:end, in seconds into the full demo
SEGMENTS=(
  "0:8"        # 有落 home, the four live numbers
  "52:92"      # on board -> the lock-screen alert -> into the taxi
  "112:132"    # 講病情, symptoms coming back as Cantonese
  "145:163"    # 0T 走冰 少甜 on the chit
  "172:184"    # 影餐牌, correcting a misread line
  "188.4:200"  # the whole interface in Bahasa, then Urdu
  "203.5:213.5" # closing card and QR
)

rm -rf "$WORK"; mkdir -p "$WORK"
LIST="$WORK/list.txt"; : > "$LIST"
TOTAL=0

for seg in "${SEGMENTS[@]}"; do
  from="${seg%%:*}"; to="${seg##*:}"
  dur=$(python3 -c "print(round($to - $from, 3))")
  n=$(printf "%02d" "${#TOTAL}")
  f="$WORK/seg-$from.mp4"
  ffmpeg -y -loglevel error -ss "$from" -t "$dur" -i "$SRC" \
    -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p \
    -c:a aac -b:a 192k -ar 48000 "$f"
  echo "file '$(basename "$f")'" >> "$LIST"
  TOTAL=$(python3 -c "print(round($TOTAL + $dur, 1))")
  printf "  %-12s %5.1fs\n" "$from-$to" "$dur"
done

ffmpeg -y -loglevel error -f concat -safe 0 -i "$LIST" \
  -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 192k "$OUT"
rm -rf "$WORK"

echo
echo "  -> submission/$OUT"
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height \
  -show_entries format=duration,size -of default=noprint_wrappers=1 "$OUT" | sed 's/^/     /'
