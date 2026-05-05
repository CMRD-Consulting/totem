# Totem logo integration — design spec

## Table of Contents

- [Goal](#goal)
- [Source asset](#source-asset)
- [Output artifacts](#output-artifacts)
- [Square-padding strategy](#square-padding-strategy)
- [Generation script](#generation-script)
- [Favicon SVG with dark-mode awareness](#favicon-svg-with-dark-mode-awareness)
- [Web manifest (`public/site.webmanifest`)](#web-manifest-publicsitewebmanifest)
- [`index.html` updates](#indexhtml-updates)
- [In-app integration](#in-app-integration)
- [Acceptance criteria](#acceptance-criteria)
- [Out of scope](#out-of-scope)

## Goal

Integrate the user-provided Totem mark (`/Users/cmitchell/Downloads/totem-mark.svg`) across the iOS app and the web shell. Produce all required icon and splash assets, wire the SVG into in-app surfaces, and update HTML/manifest references.

## Source asset

- **File:** `/Users/cmitchell/Downloads/totem-mark.svg`
- **Dimensions:** 2099 × 2679 (portrait, ~1:1.28 aspect)
- **Content:** single `<path fill="black">` on a transparent canvas
- **Vendoring:** copy to `src/assets/totem-mark.svg` and swap `fill="black"` → `fill="currentColor"`. This becomes the canonical in-repo source for both PNG generation and in-app rendering.

## Output artifacts

| Path | Size | Bg | Mark color | Purpose |
|---|---|---|---|---|
| `src/assets/totem-mark.svg` | vector | transparent | `currentColor` | In-app source, imported by `LogoMark.vue` |
| `public/favicon.svg` | vector | transparent | `#0f0e0c` light / `#f1ece0` dark (via `prefers-color-scheme` media query inside the SVG) | Modern-browser favicon |
| `public/favicon.ico` | 16 + 32 multi-res | transparent | `#0f0e0c` | Legacy fallback (matches favicon SVG light-mode) |
| `public/icon-180.png` | 180 × 180 | midnight `#15131a` | `#f1ece0` | apple-touch-icon |
| `public/icon-192.png` | 192 × 192 | midnight | `#f1ece0` | PWA / Android |
| `public/icon-512.png` | 512 × 512 | midnight | `#f1ece0` | PWA / Android, also serves as maskable |
| `public/site.webmanifest` | json | n/a | n/a | PWA manifest |
| `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` | 1024 × 1024 | midnight | `#f1ece0` | iOS app icon (replaces existing) |
| `ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png` | 2732 × 2732 | midnight | `#f1ece0` | iOS splash @3x |
| `ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png` | 2732 × 2732 | midnight | `#f1ece0` | iOS splash @2x (same image) |
| `ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png` | 2732 × 2732 | midnight | `#f1ece0` | iOS splash @1x (same image) |

The three splash files are identical content — Capacitor's `Contents.json` references three scale variants, but the same 2732×2732 image works for all of them (iOS crops/scales as needed).

## Square-padding strategy

The source mark is portrait (2099 × 2679). For square contexts (icons, splash) we render onto a square canvas with the mark centered, occupying ~70% of the canvas height. That means:

- **For 1024×1024 icon:** mark is rendered at ~570 × 720, centered at (512, 512). Margin ≈ 22% of canvas on top/bottom, ≈ 28% on left/right.
- **For 2732×2732 splash:** mark rendered at ~1500 × 1916, centered. Same proportional padding.
- The mark stays portrait (we don't crop or stretch) — padding is asymmetric (more horizontal than vertical) but the visual result is centered and balanced.

Rendered with ImageMagick: render the SVG to PNG at the target *mark* size, then composite onto a solid-colored square canvas of the target *icon* size.

## Generation script

A single shell script at `scripts/generate-logo-assets.sh` runs all renders. It:

1. Reads `src/assets/totem-mark.svg`
2. Produces a temporary white-fill SVG (replaces `currentColor` with `#f1ece0`) for icon rendering
3. Produces a temporary ink-fill SVG (replaces `currentColor` with `#0f0e0c`) for the favicon ICO
4. Renders each PNG variant via `magick` (ImageMagick), padding to square as described above
5. Writes the favicon SVG (with `prefers-color-scheme` media query) directly to `public/favicon.svg`
6. Writes the manifest JSON to `public/site.webmanifest`

The script is re-runnable. Output paths are deterministic. Inputs are the canonical SVG plus the script's hard-coded colors and sizes.

**Why a script vs one-off commands:** the user may iterate on the mark (touch up curves, tweak padding). Re-running the script regenerates everything from one source of truth.

## Favicon SVG with dark-mode awareness

The favicon SVG ships a `<style>` block that switches the path's fill via `prefers-color-scheme`:

```xml
<svg ...>
  <style>
    path { fill: #0f0e0c; }
    @media (prefers-color-scheme: dark) {
      path { fill: #f1ece0; }
    }
  </style>
  <path d="..."/>
</svg>
```

Supported by Chrome 90+, Firefox 41+, Safari 15+. Older browsers fall back to whichever color is declared first.

## Web manifest (`public/site.webmanifest`)

```json
{
  "name": "Totem",
  "short_name": "Totem",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#15131a",
  "theme_color": "#15131a",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

## `index.html` updates

Replace the single `<link rel="shortcut icon" type="image/png" href="/favicon.png" />` with:

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
<link rel="apple-touch-icon" sizes="180x180" href="/icon-180.png" />
<link rel="manifest" href="/site.webmanifest" />
<meta name="theme-color" content="#15131a" />
```

Delete `public/favicon.png` after the new assets are in place — it's superseded.

## In-app integration

Create `src/components/LogoMark.vue`. Use Vite's built-in `?raw` query to import the SVG as a string and inline it via `v-html`. This keeps a single source of truth (no path-data duplication), preserves `currentColor` theming, and adds no new dependency.

```vue
<script setup lang="ts">
import svg from '@/assets/totem-mark.svg?raw';

withDefaults(
  defineProps<{
    size?: number;
    color?: string;
  }>(),
  { size: 32, color: 'currentColor' },
);
</script>

<template>
  <span
    role="img"
    aria-label="Totem"
    :style="{ display: 'inline-block', width: size + 'px', color }"
    v-html="svg"
  />
</template>
```

For this to theme correctly, the source SVG must use `fill="currentColor"` (this is the source-normalization step described above). The wrapping `<span>` sets the color which the inner `<path>` inherits. The SVG's intrinsic `viewBox` handles aspect-ratio scaling when `width` is specified and `height` is auto-derived by the SVG itself.

**Where the component appears (initial scope):**

- `src/views/SignInPage.vue` — replace whatever hero treatment exists with `<LogoMark :size="80" />` above the wordmark.
- `src/components/TopBar.vue` — small mark (~24px) on the left of the app bar where appropriate.

Splash screen on iOS is handled by the static PNG, so no in-app component there.

## Acceptance criteria

1. Visiting the dev server in a browser shows the Totem mark as the favicon (modern browsers via SVG, IE/edge fallback via ICO).
2. Adding the site to home screen on iOS / Android picks up the icon and theme color from the manifest.
3. Building the iOS app via `npx cap sync ios && open ios/App/App.xcworkspace` and running on simulator shows:
   - Home-screen icon: midnight tile with white Totem mark, properly centered.
   - Splash: midnight bg with white Totem mark, properly centered, no stretching.
4. Sign-in page renders the inline mark via `LogoMark.vue` and it picks up theme color (white on midnight, ink on cream).
5. Re-running `scripts/generate-logo-assets.sh` is idempotent — produces identical output bytes.

## Out of scope

- Animated splash (e.g. spinning entry).
- Theme-driven app icon (iOS supports per-theme icons but it's a separate feature; not requested).
- Marketing-site or App Store screenshots.
- Updating the existing `Sigil.vue` component — confirmed it is an album-art mosaic component for track lists, not a brand sigil. Do not touch.
