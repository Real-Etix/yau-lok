#!/usr/bin/env bash
# Build the demo video from the 8 screen recordings.
#
# Every clip is normalised to the same codec, size, frame rate and audio
# layout first — concat only works on streams that already match, and a clip
# recorded with no audio track will otherwise desync everything after it.
#
#   bash submission/assemble.sh
#
# Output: submission/yau-lok-demo.mp4

set -euo pipefail
cd "$(dirname "$0")"

CLIPS=clips
WORK=.build
OUT=yau-lok-demo.mp4
CREAM=0xEDE6DA   # letterbox colour, so padding reads as the app's paper
# Height given over to captions. A phone recording fills the frame top to
# bottom, so any subtitle burned over it covers part of the interface — the
# one thing the video exists to show. The footage is inset above this band
# instead, and nothing is ever obscured.
BAND=280
# Target loudness for the two tracks, in LUFS. The app's clips arrive wildly
# uneven — 01 and 07 are digital silence, the rest peak near 0dB with a very
# low mean because the app's voice is short bursts against nothing — so fixed
# multipliers cannot balance them. Normalising both to a stated target can.
# Raise APP_LUFS toward NARR_LUFS to hear more of the app; they are 1 LU apart.
APP_LUFS=-18
NARR_LUFS=-17

# The running order. Clips play at their RECORDED length — trimming them to
# planned lengths would silently cut the end off a short take, and the
# narration is derived from these same durations by make-narration.mjs, so the
# two cannot drift apart. Only the generated card has a fixed length.
ORDER=(01-home 02-minibus 03-taxi 04-clinic 05-cct 06-scan 07-language 08-close)
CARD_SECONDS=13

command -v ffmpeg >/dev/null || { echo "ffmpeg not found: brew install ffmpeg"; exit 1; }
rm -rf "$WORK"; mkdir -p "$WORK"

echo "==> normalising clips"
LIST="$WORK/list.txt"; : > "$LIST"
TOTAL=0
for name in "${ORDER[@]}"; do
  src=""
  for ext in mov mp4 m4v MOV MP4; do
    [ -f "$CLIPS/$name.$ext" ] && { src="$CLIPS/$name.$ext"; break; }
  done

  # The closing card is generated, not filmed — a photograph of a laptop
  # showing a QR would be the one non-app frame in the video and would look
  # it. A recorded 08-close still wins if you made one.
  if [ -z "$src" ] && [ "$name" = "08-close" ] && [ -f assets/close-card.png ]; then
    ffmpeg -y -loglevel error -loop 1 -t "$CARD_SECONDS" -i assets/close-card.png \
      -f lavfi -t "$CARD_SECONDS" -i anullsrc=channel_layout=stereo:sample_rate=48000 \
      -vf "scale=1080:1920,fps=30,setsar=1" -map 0:v -map 1:a \
      -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p \
      -c:a aac -b:a 160k -ar 48000 "$WORK/$name.mp4"
    echo "file '$name.mp4'" >> "$LIST"
    TOTAL=$(python3 -c "print($TOTAL + $CARD_SECONDS)")
    echo "    ok $name (${CARD_SECONDS}s, from close-card.png)"
    continue
  fi

  if [ -z "$src" ]; then
    echo "    !! missing $CLIPS/$name.(mov|mp4) — skipping"
    continue
  fi

  secs=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$src")

  # Scale to fit 1080x1920 without distorting, pad the rest, force 30fps and
  # a silent stereo track when the recording has none.
  ffmpeg -y -loglevel error \
    -i "$src" \
    -f lavfi -t "$secs" -i anullsrc=channel_layout=stereo:sample_rate=48000 \
    -filter_complex "
      [0:v]scale=1080:$((1920-BAND)):force_original_aspect_ratio=decrease,
           pad=1080:1920:(ow-iw)/2:0:color=$CREAM,
           fps=30,setsar=1[v];
      [0:a][1:a]amerge=inputs=2,pan=stereo|c0<c0+c2|c1<c1+c3[a]
    " -map "[v]" -map "[a]" \
    -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p \
    -c:a aac -b:a 160k -ar 48000 -shortest \
    "$WORK/$name.mp4" 2>/dev/null \
  || ffmpeg -y -loglevel error \
    -i "$src" -f lavfi -t "$secs" -i anullsrc=channel_layout=stereo:sample_rate=48000 \
    -filter_complex "[0:v]scale=1080:$((1920-BAND)):force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:0:color=$CREAM,fps=30,setsar=1[v]" \
    -map "[v]" -map 1:a \
    -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -c:a aac -b:a 160k -ar 48000 \
    "$WORK/$name.mp4"

  echo "file '$name.mp4'" >> "$LIST"
  TOTAL=$(python3 -c "print(round($TOTAL + $secs, 1))")
  echo "    ok $name ($(python3 -c "print(f'{$secs:.1f}')")s)"
done

[ -s "$LIST" ] || { echo "no clips found in $CLIPS/ — nothing to build"; exit 1; }

echo "==> joining (${TOTAL}s)"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$LIST" -c copy "$WORK/joined.mp4"

# Narration, if it exists: mixed *under* the app's own audio rather than over
# it, so the Cantonese the app speaks in clips 02 and 05 stays audible.
NARR=""
for f in narration.wav narration.m4a narration.mp3; do [ -f "$f" ] && { NARR="$f"; break; }; done

echo "==> subtitles + narration"
# Heiti TC, not PingFang: fontconfig on macOS does not expose the PingFang
# family to libass, and an unresolved family silently renders CJK as tofu.
# FontSize and MarginV are in libass script units, not pixels: with no PlayResY
# in the .srt the reference height is 288, so everything here is multiplied by
# 1920/288 ≈ 6.7 on the way out. 8 → ~53px of type, 45 → ~300px off the bottom.
SUBS="subtitles=narration.srt:force_style='FontName=Heiti TC,FontSize=7,PrimaryColour=&H00FFFFFF,OutlineColour=&HB4000000,BorderStyle=3,Outline=1,Shadow=0,MarginV=10,Alignment=2'"

if [ -n "$NARR" ]; then
  echo "    narration: $NARR"
  # The app's own voice is the product; it is not background music. So instead
  # of holding it down for the whole video, it plays at full level and is
  # ducked only while a narration line is actually speaking — sidechained off
  # the narration itself. alimiter catches the sum so the two together cannot
  # clip.
  ffmpeg -y -loglevel error -i "$WORK/joined.mp4" -i "$NARR" \
    -filter_complex "
      [0:v]$SUBS[v];
      [0:a]loudnorm=I=$APP_LUFS:TP=-1.5:LRA=11[app];
      [1:a]loudnorm=I=$NARR_LUFS:TP=-1.5:LRA=7,asplit=2[key][nar];
      [app][key]sidechaincompress=threshold=0.05:ratio=4:attack=20:release=400[ducked];
      [ducked][nar]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,
        alimiter=limit=0.95[a]
    " \
    -map "[v]" -map "[a]" \
    -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -movflags +faststart \
    -c:a aac -b:a 192k "$OUT"
else
  echo "    no narration file — building with app audio only"
  ffmpeg -y -loglevel error -i "$WORK/joined.mp4" \
    -vf "$SUBS" \
    -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -movflags +faststart \
    -c:a aac -b:a 192k "$OUT"
fi

rm -rf "$WORK"
echo
echo "==> $OUT"
ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name,width,height -show_entries format=duration,size \
  -of default=noprint_wrappers=1 "$OUT" | sed 's/^/    /'
echo
echo "    want: h264 / 1080x1920 / duration 180-300 / size under 300000000"
