#!/usr/bin/env bash
# Build the closing card — clip 08, generated rather than filmed.
#
# A photograph of a laptop showing a QR code would be the only non-app frame in
# the video and would look it. This composes the card at full 1080x1920 so it
# cuts cleanly against the screen recordings, and so the QR is pixel-sharp for
# anyone scanning it off a projector.
#
#   bash submission/make-close-card.sh

set -euo pipefail
cd "$(dirname "$0")"

OUT=assets/close-card.png
QR=assets/yau-lok-qr.png
URL="yau-lok.vercel.app"

command -v ffmpeg >/dev/null || { echo "ffmpeg not found: brew install ffmpeg"; exit 1; }
[ -f "$QR" ] || { echo "missing $QR — run the qrcode step first"; exit 1; }

# Heiti TC lives in a path with a space, which is a fight with filtergraph
# escaping; copying it out is cheaper than winning that fight.
FONT=/tmp/yau-lok-card-font.ttc
cp "/System/Library/Fonts/STHeiti Medium.ttc" "$FONT"

ffmpeg -y -loglevel error \
  -f lavfi -i "color=c=0xEDE6DA:s=1080x1920" \
  -i "$QR" \
  -filter_complex "
    [1:v]scale=640:640[qr];
    [0:v][qr]overlay=(W-w)/2:660[bg];
    [bg]
      drawtext=fontfile=$FONT:text='有落':fontsize=190:fontcolor=0x0F7A52:
        x=(w-text_w)/2:y=250,
      drawtext=fontfile=$FONT:text='YAU LOK\!':fontsize=54:fontcolor=0x6B6155:
        x=(w-text_w)/2:y=500,
      drawtext=fontfile=$FONT:text='唔使驚 · 我幫你講':fontsize=44:fontcolor=0x14100C:
        x=(w-text_w)/2:y=1370,
      drawtext=fontfile=$FONT:text='$URL':fontsize=52:fontcolor=0x0F7A52:
        x=(w-text_w)/2:y=1480,
      drawtext=fontfile=$FONT:text='Firebird Hackathon · HKGAI 港話通':fontsize=34:
        fontcolor=0x8D857E:x=(w-text_w)/2:y=1620,
      drawtext=fontfile=$FONT:text='旁白由 HKGAI 語音合成 · Narration by HKGAI TTS':
        fontsize=27:fontcolor=0x9E968D:x=(w-text_w)/2:y=1692
    " \
  -frames:v 1 "$OUT"

rm -f "$FONT"
echo "  -> submission/$OUT"
ffprobe -v error -select_streams v:0 -show_entries stream=width,height \
  -of csv=p=0 "$OUT" | sed 's/^/     /'
