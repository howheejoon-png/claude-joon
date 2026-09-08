#!/usr/bin/env bash
# Compress the hero source clip for the web. Usage: tools/process-video.sh <source.mp4>
# Produces public/video/hero.mp4 (1920w, no audio) and public/video/hero-mobile.mp4 (960w).
set -euo pipefail
SRC="$1"; OUT=public/video; mkdir -p "$OUT"
# TRIM: seconds to keep (the 17224760 clip shows another company's signage after ~9s)
TRIM=${TRIM:-20}
FF=${FFMPEG:-$(python3 -c "import imageio_ffmpeg as i; print(i.get_ffmpeg_exe())" 2>/dev/null || command -v ffmpeg)}
"$FF" -y -i "$SRC" -an -t ${TRIM:-20} -vf "scale=1920:-2:flags=lanczos,fps=24" -c:v libx264 -preset slow -crf 27 -pix_fmt yuv420p -movflags +faststart "$OUT/hero.mp4"
"$FF" -y -i "$SRC" -an -t ${TRIM:-20} -vf "scale=960:-2:flags=lanczos,fps=24" -c:v libx264 -preset slow -crf 29 -pix_fmt yuv420p -movflags +faststart "$OUT/hero-mobile.mp4"
# WebM (VP9) versions: smaller, and the format open-source Chromium builds can play
"$FF" -y -i "$SRC" -an -t ${TRIM:-20} -vf "scale=1920:-2:flags=lanczos,fps=24" -c:v libvpx-vp9 -b:v 0 -crf 34 -row-mt 1 -pix_fmt yuv420p "$OUT/hero.webm"
"$FF" -y -i "$SRC" -an -t ${TRIM:-20} -vf "scale=960:-2:flags=lanczos,fps=24" -c:v libvpx-vp9 -b:v 0 -crf 36 -row-mt 1 -pix_fmt yuv420p "$OUT/hero-mobile.webm"
ls -la "$OUT"
