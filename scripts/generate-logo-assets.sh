#!/usr/bin/env bash
# Regenerate all Totem logo assets from src/assets/totem-mark.svg.
# Idempotent: re-running produces identical bytes.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_SVG="${REPO_ROOT}/src/assets/totem-mark.svg"
PUBLIC_DIR="${REPO_ROOT}/public"
IOS_ICON="${REPO_ROOT}/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
IOS_SPLASH_DIR="${REPO_ROOT}/ios/App/App/Assets.xcassets/Splash.imageset"

MIDNIGHT="#15131a"
INK="#0f0e0c"
CREAM_WHITE="#f1ece0"
MARK_RATIO=0.70   # mark fills 70% of the icon tile's height

if [[ ! -f "${SOURCE_SVG}" ]]; then
  echo "Source SVG not found at ${SOURCE_SVG}" >&2
  exit 1
fi

if ! command -v magick >/dev/null 2>&1; then
  echo "ImageMagick (magick) not found. Install with: brew install imagemagick" >&2
  exit 1
fi

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "${WORK_DIR}"' EXIT

# Two recolored variants of the source SVG
sed "s/fill=\"currentColor\"/fill=\"${CREAM_WHITE}\"/" "${SOURCE_SVG}" \
  > "${WORK_DIR}/mark-cream.svg"
sed "s/fill=\"currentColor\"/fill=\"${INK}\"/" "${SOURCE_SVG}" \
  > "${WORK_DIR}/mark-ink.svg"

# Render a square icon: midnight bg + cream-white mark, mark fills MARK_RATIO of canvas height.
# $1 = output PNG path, $2 = canvas size (px)
render_icon() {
  local out="$1" size="$2"
  local mark_h
  mark_h=$(awk -v s="${size}" -v r="${MARK_RATIO}" 'BEGIN { printf "%d", s * r }')
  magick -background none \
    -density 600 \
    -resize "x${mark_h}" \
    "${WORK_DIR}/mark-cream.svg" \
    -background "${MIDNIGHT}" \
    -gravity center \
    -extent "${size}x${size}" \
    "${out}"
}

# Render a transparent PNG of the ink mark at given height (for ICO source).
# $1 = output PNG path, $2 = pixel height
render_transparent_ink() {
  local out="$1" h="$2"
  magick -background none \
    -density 600 \
    -resize "x${h}" \
    "${WORK_DIR}/mark-ink.svg" \
    "${out}"
}

echo "→ favicon.svg (dark-mode-aware)"
# Inject a <style> block before </svg> with prefers-color-scheme switch.
# Source has fill="currentColor"; we strip the fill attribute and let CSS drive it.
sed 's/fill="currentColor"//' "${SOURCE_SVG}" \
  | awk -v ink="${INK}" -v cream="${CREAM_WHITE}" '
      /<svg/ && !inserted {
        print
        print "<style>path { fill: " ink "; } @media (prefers-color-scheme: dark) { path { fill: " cream "; } }</style>"
        inserted=1
        next
      }
      { print }
    ' > "${PUBLIC_DIR}/favicon.svg"

echo "→ favicon.ico (16 + 32 px)"
render_transparent_ink "${WORK_DIR}/fav-16.png" 16
render_transparent_ink "${WORK_DIR}/fav-32.png" 32
magick "${WORK_DIR}/fav-16.png" "${WORK_DIR}/fav-32.png" "${PUBLIC_DIR}/favicon.ico"

echo "→ icon-180.png (apple-touch-icon)"
render_icon "${PUBLIC_DIR}/icon-180.png" 180

echo "→ icon-192.png (PWA / Android)"
render_icon "${PUBLIC_DIR}/icon-192.png" 192

echo "→ icon-512.png (PWA / Android maskable)"
render_icon "${PUBLIC_DIR}/icon-512.png" 512

echo "→ ios AppIcon (1024×1024)"
render_icon "${IOS_ICON}" 1024

echo "→ ios Splash (2732×2732, three identical scale variants)"
render_icon "${IOS_SPLASH_DIR}/splash-2732x2732.png" 2732
cp "${IOS_SPLASH_DIR}/splash-2732x2732.png" "${IOS_SPLASH_DIR}/splash-2732x2732-1.png"
cp "${IOS_SPLASH_DIR}/splash-2732x2732.png" "${IOS_SPLASH_DIR}/splash-2732x2732-2.png"

echo "→ site.webmanifest"
cat > "${PUBLIC_DIR}/site.webmanifest" <<JSON
{
  "name": "Totem",
  "short_name": "Totem",
  "start_url": "/",
  "display": "standalone",
  "background_color": "${MIDNIGHT}",
  "theme_color": "${MIDNIGHT}",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
JSON

echo
echo "→ verifying outputs"
verify() {
  local path="$1" expected="$2"
  if [[ ! -f "${path}" ]]; then echo "  MISSING: ${path}" >&2; exit 1; fi
  local actual
  actual="$(magick identify -format '%wx%h' "${path}")"
  if [[ "${actual}" != "${expected}" ]]; then
    echo "  WRONG SIZE: ${path} (got ${actual}, expected ${expected})" >&2
    exit 1
  fi
  printf "  ok  %-72s  %s\n" "${path#${REPO_ROOT}/}" "${actual}"
}
verify "${PUBLIC_DIR}/icon-180.png"                                180x180
verify "${PUBLIC_DIR}/icon-192.png"                                192x192
verify "${PUBLIC_DIR}/icon-512.png"                                512x512
verify "${IOS_ICON}"                                               1024x1024
verify "${IOS_SPLASH_DIR}/splash-2732x2732.png"                    2732x2732
verify "${IOS_SPLASH_DIR}/splash-2732x2732-1.png"                  2732x2732
verify "${IOS_SPLASH_DIR}/splash-2732x2732-2.png"                  2732x2732
[[ -f "${PUBLIC_DIR}/favicon.svg" ]] && echo "  ok  public/favicon.svg" || { echo "MISSING favicon.svg" >&2; exit 1; }
[[ -f "${PUBLIC_DIR}/favicon.ico" ]] && echo "  ok  public/favicon.ico" || { echo "MISSING favicon.ico" >&2; exit 1; }
[[ -f "${PUBLIC_DIR}/site.webmanifest" ]] && echo "  ok  public/site.webmanifest" || { echo "MISSING site.webmanifest" >&2; exit 1; }

echo
echo "All assets generated successfully."
