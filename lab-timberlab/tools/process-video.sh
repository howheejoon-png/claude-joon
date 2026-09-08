#!/usr/bin/env bash
# Compress the hero source clip for the web. Usage: tools/process-video.sh <source.mp4>
# Produces public/video/hero.mp4 (1920w, no audio) and public/video/hero-mobile.mp4 (960w).
set -euo pipefail
SRC="$1"; OUT=public/video; mkdir -p "$OUT"
FF=${FFMPEG:-$(command -v ffmpeg || echo /opt/pw-browsers/ffmpeg-1011/ffmpeg-linux)}
"$FF" -y -i "$SRC" -an -t 20 -vf "scale=1920:-2:flags=lanczos,fps=24" -c:v libx264 -preset slow -crf 27 -pix_fmt yuv420p -movflags +faststart "$OUT/hero.mp4"
"$FF" -y -i "$SRC" -an -t 20 -vf "scale=960:-2:flags=lanczos,fps=24" -c:v libx264 -preset slow -crf 29 -pix_fmt yuv420p -movflags +faststart "$OUT/hero-mobile.mp4"
ls -la "$OUT"
