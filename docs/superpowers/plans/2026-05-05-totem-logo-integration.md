# Totem Logo Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the user-provided Totem mark across iOS app icon, iOS splash, web favicons, PWA manifest, and a reusable in-app Vue component, all generated from a single canonical SVG source.

**Architecture:** `src/assets/totem-mark.svg` (the canonical source, with `fill="currentColor"`) drives everything. A shell script at `scripts/generate-logo-assets.sh` uses ImageMagick to render the icon/splash PNG ladder onto square midnight tiles, plus writes a dark-mode-aware `public/favicon.svg` and `public/site.webmanifest`. A new `LogoMark.vue` component imports the SVG via Vite's `?raw` query and inlines it with `v-html`, picking up theme color via `currentColor` from the surrounding context.

**Tech Stack:** Vue 3 + Vite + Ionic 8 + Capacitor 8, ImageMagick 7 (`magick` CLI, already installed at `/opt/homebrew/bin/magick`), Vitest 2 + @vue/test-utils 2.

**Spec:** [docs/superpowers/specs/2026-05-05-totem-logo-integration-design.md](../specs/2026-05-05-totem-logo-integration-design.md)

---

## Table of Contents

- [File Map](#file-map)
- [Task 1: Vendor and normalize the source SVG](#task-1-vendor-and-normalize-the-source-svg)
- [Task 2: Write the asset generation script](#task-2-write-the-asset-generation-script)
- [Task 3: Run the generator and commit assets](#task-3-run-the-generator-and-commit-assets)
- [Task 4: Update `index.html` favicon links](#task-4-update-indexhtml-favicon-links)
- [Task 5: Remove the old favicon.png](#task-5-remove-the-old-faviconpng)
- [Task 6: Create LogoMark.vue with unit test (TDD)](#task-6-create-logomarkvue-with-unit-test-tdd)
- [Task 7: Add LogoMark to SignInPage as the hero](#task-7-add-logomark-to-signinpage-as-the-hero)
- [Task 8: Verify iOS app icon and splash via Capacitor sync](#task-8-verify-ios-app-icon-and-splash-via-capacitor-sync)
- [Task 9: Final verification](#task-9-final-verification)
- [Acceptance criteria](#acceptance-criteria)

## File Map

**Create:**
- `src/assets/totem-mark.svg` — canonical source, `fill="currentColor"`
- `scripts/generate-logo-assets.sh` — generator (idempotent, self-verifying)
- `src/components/LogoMark.vue` — in-app component
- `src/components/__tests__/LogoMark.spec.ts` — unit test
- `public/favicon.svg` — generated, dark-mode-aware
- `public/favicon.ico` — generated
- `public/icon-180.png` — generated
- `public/icon-192.png` — generated
- `public/icon-512.png` — generated
- `public/site.webmanifest` — generated

**Modify:**
- `index.html` — replace favicon link with full set + manifest + theme-color
- `src/views/SignInPage.vue` — add LogoMark hero above existing Wordmark
- `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` — overwritten by script (1024×1024 midnight tile)
- `ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png` — overwritten by script
- `ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png` — overwritten by script
- `ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png` — overwritten by script

**Delete:**
- `public/favicon.png` — superseded by SVG + ICO + size-specific PNGs

**Out of scope:** TopBar.vue modifications. The LogoMark component will be available; per-page placement (e.g. dropping it into TopBar's `left` slot) is a future, page-by-page decision.

---

## Task 1: Vendor and normalize the source SVG

The user's SVG at `~/Downloads/totem-mark.svg` is a single `<path fill="black">`. We copy it into the repo and swap the fill to `currentColor` so it inherits theme color when embedded in Vue.

**Files:**
- Create: `src/assets/totem-mark.svg`

- [ ] **Step 1: Copy and normalize the source SVG**

```bash
mkdir -p /Users/cmitchell/www/cmrd/apps/totem/src/assets
sed 's/fill="black"/fill="currentColor"/' \
  /Users/cmitchell/Downloads/totem-mark.svg \
  > /Users/cmitchell/www/cmrd/apps/totem/src/assets/totem-mark.svg
```

- [ ] **Step 2: Verify the swap took**

Run:
```bash
grep -c 'fill="currentColor"' /Users/cmitchell/www/cmrd/apps/totem/src/assets/totem-mark.svg
grep -c 'fill="black"' /Users/cmitchell/www/cmrd/apps/totem/src/assets/totem-mark.svg
```
Expected: first command outputs `1`, second outputs `0`.

- [ ] **Step 3: Sanity-check the SVG renders**

Run:
```bash
magick -background "#15131a" -resize 200x \
  /Users/cmitchell/www/cmrd/apps/totem/src/assets/totem-mark.svg \
  /tmp/totem-mark-check.png
file /tmp/totem-mark-check.png
```
Expected: file output mentions `PNG image data, 200 x ...` (SVG renders to PNG without errors).

Note: `currentColor` outside an HTML/CSS context falls back to black in ImageMagick, which is fine — this step only verifies the SVG parses and rasterizes.

- [ ] **Step 4: Commit**

```bash
cd /Users/cmitchell/www/cmrd/apps/totem
git add src/assets/totem-mark.svg
git commit -m "feat(brand): vendor totem mark svg as canonical source"
```

---

## Task 2: Write the asset generation script

A single shell script renders all PNG variants from the canonical SVG. It uses two intermediate "rendering" SVGs (one for white-on-midnight, one for ink-on-transparent) generated on the fly via `sed`. ImageMagick handles SVG→PNG and square-padding via `-extent`.

**Files:**
- Create: `scripts/generate-logo-assets.sh`

- [ ] **Step 1: Create the script**

```bash
cat > /Users/cmitchell/www/cmrd/apps/totem/scripts/generate-logo-assets.sh <<'SCRIPT'
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
SCRIPT
chmod +x /Users/cmitchell/www/cmrd/apps/totem/scripts/generate-logo-assets.sh
```

- [ ] **Step 2: Lint-check the script for shell errors**

Run:
```bash
bash -n /Users/cmitchell/www/cmrd/apps/totem/scripts/generate-logo-assets.sh && echo "syntax ok"
```
Expected: `syntax ok`.

- [ ] **Step 3: Commit the script (without running it yet)**

```bash
cd /Users/cmitchell/www/cmrd/apps/totem
git add scripts/generate-logo-assets.sh
git commit -m "feat(brand): script to generate logo assets from canonical svg"
```

---

## Task 3: Run the generator and commit assets

This task executes the script, verifies outputs, and commits all generated binaries. The script's built-in `verify` step is the test.

- [ ] **Step 1: Run the generator**

Run:
```bash
cd /Users/cmitchell/www/cmrd/apps/totem
bash scripts/generate-logo-assets.sh
```
Expected: a series of `→` lines for each asset, ending with `All assets generated successfully.` and a list of `ok` verification lines including `1024x1024` for the iOS icon and `2732x2732` for each splash.

- [ ] **Step 2: Spot-check a few outputs visually**

Run:
```bash
magick identify /Users/cmitchell/www/cmrd/apps/totem/public/icon-512.png
magick identify /Users/cmitchell/www/cmrd/apps/totem/public/favicon.ico
magick identify /Users/cmitchell/www/cmrd/apps/totem/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
```
Expected:
- `icon-512.png PNG 512x512 ...`
- `favicon.ico ICO 16x16 ...` (multi-frame ICO, identify shows the first frame)
- `AppIcon-512@2x.png PNG 1024x1024 ...`

- [ ] **Step 3: Confirm favicon.svg has the dark-mode media query**

Run:
```bash
grep "prefers-color-scheme" /Users/cmitchell/www/cmrd/apps/totem/public/favicon.svg
```
Expected: a line containing `@media (prefers-color-scheme: dark)`.

- [ ] **Step 4: Commit generated assets**

```bash
cd /Users/cmitchell/www/cmrd/apps/totem
git add public/favicon.svg public/favicon.ico public/icon-180.png public/icon-192.png public/icon-512.png public/site.webmanifest \
        ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png \
        ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png \
        ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png \
        ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png
git commit -m "feat(brand): generate web + ios logo assets from canonical svg"
```

---

## Task 4: Update `index.html` favicon links

Replace the single `<link rel="shortcut icon">` with the modern multi-link set + PWA manifest + theme-color. This makes the new favicons visible in the dev server.

**Files:**
- Modify: `index.html:17`

- [ ] **Step 1: Replace the favicon link block**

Replace this single line (currently at line 17):
```html
    <link rel="shortcut icon" type="image/png" href="/favicon.png" />
```

with:
```html
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    <link rel="apple-touch-icon" sizes="180x180" href="/icon-180.png" />
    <link rel="manifest" href="/site.webmanifest" />
    <meta name="theme-color" content="#15131a" />
```

Use Edit tool with:
- `old_string`: `    <link rel="shortcut icon" type="image/png" href="/favicon.png" />`
- `new_string`: the 5-line block above (preserve the 4-space indent on each line).

- [ ] **Step 2: Confirm the change**

Run:
```bash
grep -E 'rel="(icon|apple-touch-icon|manifest)"|theme-color' /Users/cmitchell/www/cmrd/apps/totem/index.html
```
Expected: 5 matching lines (svg favicon, ico favicon, apple-touch-icon, manifest, theme-color meta).

- [ ] **Step 3: Verify the dev server serves the new favicon**

Start the dev server in a background process, hit the favicon URL, and confirm content-type:
```bash
cd /Users/cmitchell/www/cmrd/apps/totem
pnpm dev &
DEV_PID=$!
sleep 4
curl -sI http://localhost:5173/favicon.svg | grep -i "content-type"
curl -sI http://localhost:5173/site.webmanifest | grep -iE "content-type|HTTP/"
kill $DEV_PID
wait $DEV_PID 2>/dev/null || true
```
Expected: favicon.svg returns `Content-Type: image/svg+xml` (or similar), webmanifest returns `200`.

If the dev server runs on a different port, adjust the URL — Vite logs the port to stdout when starting.

- [ ] **Step 4: Commit**

```bash
cd /Users/cmitchell/www/cmrd/apps/totem
git add index.html
git commit -m "feat(brand): wire new favicon set + pwa manifest into index.html"
```

---

## Task 5: Remove the old favicon.png

Now that all references in `index.html` point to the new set, the legacy PNG is dead weight.

- [ ] **Step 1: Confirm no remaining references**

Run:
```bash
grep -rn "favicon.png" /Users/cmitchell/www/cmrd/apps/totem/src /Users/cmitchell/www/cmrd/apps/totem/index.html /Users/cmitchell/www/cmrd/apps/totem/public 2>/dev/null
```
Expected: only `public/favicon.png` shows up (the file itself); no references in source.

- [ ] **Step 2: Delete the file**

```bash
git -C /Users/cmitchell/www/cmrd/apps/totem rm public/favicon.png
```

- [ ] **Step 3: Commit**

```bash
cd /Users/cmitchell/www/cmrd/apps/totem
git commit -m "chore(brand): remove superseded favicon.png"
```

---

## Task 6: Create LogoMark.vue with unit test (TDD)

Build the in-app component test-first. The test asserts the component renders an SVG inside an aria-labelled span and accepts a `size` prop that drives the rendered width.

**Files:**
- Create: `src/components/__tests__/LogoMark.spec.ts`
- Create: `src/components/LogoMark.vue`

- [ ] **Step 1: Write the failing test**

```bash
mkdir -p /Users/cmitchell/www/cmrd/apps/totem/src/components/__tests__
```

Create `/Users/cmitchell/www/cmrd/apps/totem/src/components/__tests__/LogoMark.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LogoMark from '../LogoMark.vue';

describe('LogoMark', () => {
  it('renders a span with role="img" and aria-label "Totem"', () => {
    const wrapper = mount(LogoMark);
    const span = wrapper.find('span[role="img"]');
    expect(span.exists()).toBe(true);
    expect(span.attributes('aria-label')).toBe('Totem');
  });

  it('inlines the totem-mark SVG', () => {
    const wrapper = mount(LogoMark);
    expect(wrapper.html()).toContain('<svg');
    expect(wrapper.html()).toContain('viewBox="0 0 2099 2679"');
  });

  it('reflects the size prop in the rendered width style', () => {
    const wrapper = mount(LogoMark, { props: { size: 64 } });
    const span = wrapper.find('span[role="img"]');
    expect(span.attributes('style') ?? '').toMatch(/width:\s*64px/);
  });

  it('uses currentColor by default', () => {
    const wrapper = mount(LogoMark);
    const span = wrapper.find('span[role="img"]');
    expect(span.attributes('style') ?? '').toMatch(/color:\s*currentcolor/i);
  });

  it('accepts a custom color override', () => {
    const wrapper = mount(LogoMark, { props: { color: '#d62e2e' } });
    const span = wrapper.find('span[role="img"]');
    expect(span.attributes('style') ?? '').toMatch(/color:\s*(?:rgb\(214,\s*46,\s*46\)|#d62e2e)/i);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:
```bash
cd /Users/cmitchell/www/cmrd/apps/totem
pnpm test:unit run src/components/__tests__/LogoMark.spec.ts
```
Expected: failure mentioning that `LogoMark.vue` cannot be resolved (file does not exist yet).

- [ ] **Step 3: Implement LogoMark.vue**

Create `/Users/cmitchell/www/cmrd/apps/totem/src/components/LogoMark.vue`:

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
    :style="{
      display: 'inline-block',
      width: size + 'px',
      lineHeight: 0,
      color,
    }"
    v-html="svg"
  />
</template>
```

- [ ] **Step 4: Run the test and verify it passes**

Run:
```bash
cd /Users/cmitchell/www/cmrd/apps/totem
pnpm test:unit run src/components/__tests__/LogoMark.spec.ts
```
Expected: 5 passing tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/cmitchell/www/cmrd/apps/totem
git add src/components/LogoMark.vue src/components/__tests__/LogoMark.spec.ts
git commit -m "feat(brand): add LogoMark component for in-app totem mark"
```

---

## Task 7: Add LogoMark to SignInPage as the hero

Place the brand mark above the existing sign-in flow. The current SignInPage already imports `Wordmark`; we add `LogoMark` above it.

**Files:**
- Modify: `src/views/SignInPage.vue`

- [ ] **Step 1: Locate the existing Wordmark usage**

Run:
```bash
grep -n "Wordmark" /Users/cmitchell/www/cmrd/apps/totem/src/views/SignInPage.vue
```
Note the line numbers. There will be one import line and at least one `<Wordmark` template usage.

- [ ] **Step 2: Add the LogoMark import**

Use Edit on `/Users/cmitchell/www/cmrd/apps/totem/src/views/SignInPage.vue`:
- `old_string`: `import Wordmark from '@/components/Wordmark.vue';`
- `new_string`:
```
import Wordmark from '@/components/Wordmark.vue';
import LogoMark from '@/components/LogoMark.vue';
```

- [ ] **Step 3: Place LogoMark above the Wordmark in the template**

Find the `<Wordmark` usage in the template (use Read on the file from line 80 onward to see exact context). Insert a `<LogoMark>` element directly above it, wrapped to ensure vertical layout.

The exact edit depends on the existing template structure — Read the file first, then choose an `old_string` that uniquely identifies the Wordmark line plus 1-2 surrounding lines for context. Replace with the same lines plus a `<LogoMark :size="80" style="margin-bottom: 12px" />` immediately before the Wordmark.

For example, if the existing line reads:
```html
        <Wordmark :size="32" />
```

Replace with:
```html
        <LogoMark :size="80" :style="{ marginBottom: '12px' }" />
        <Wordmark :size="32" />
```

(Match indentation exactly to whatever was already there.)

- [ ] **Step 4: Verify the file still parses**

Run:
```bash
cd /Users/cmitchell/www/cmrd/apps/totem
pnpm vue-tsc --noEmit 2>&1 | head -20
```
Expected: either clean output, or only pre-existing errors not related to SignInPage. If new errors mention SignInPage, fix the import/template before continuing.

- [ ] **Step 5: Confirm LogoMark is wired into SignInPage**

Run:
```bash
grep -E "LogoMark" /Users/cmitchell/www/cmrd/apps/totem/src/views/SignInPage.vue
```
Expected: at least 2 lines — one matching the import, one or more matching the `<LogoMark` template usage.

Visual verification (run the dev server, manually open the sign-in route in a browser, confirm the mark renders above the wordmark and picks up theme color) is recommended but optional — the unit test from Task 6 + this grep + `vue-tsc` from Step 4 are the load-bearing automated checks.

- [ ] **Step 6: Commit**

```bash
cd /Users/cmitchell/www/cmrd/apps/totem
git add src/views/SignInPage.vue
git commit -m "feat(brand): show LogoMark hero on SignInPage"
```

---

## Task 8: Verify iOS app icon and splash via Capacitor sync

The iOS PNG assets are already in their final paths from Task 3. This task makes sure Capacitor's iOS project picks them up and the simulator renders them correctly.

- [ ] **Step 1: Run cap sync to refresh Capacitor's iOS state**

Run:
```bash
cd /Users/cmitchell/www/cmrd/apps/totem
npx cap sync ios
```
Expected: `Sync finished` with no errors. The icon and splash assets are already at the correct Xcode-managed paths, so this is mostly defensive.

- [ ] **Step 2: Open the Xcode project**

Run:
```bash
open /Users/cmitchell/www/cmrd/apps/totem/ios/App/App.xcworkspace
```

- [ ] **Step 3: Manually verify in the simulator**

In Xcode:
1. Pick an iPhone simulator (e.g. iPhone 15).
2. Build and run (Cmd+R).
3. When the simulator boots, observe:
   - The splash screen shows the Totem mark on midnight bg (no stretching, no off-center placement).
   - After splash dismisses, press the simulator's Home button (Cmd+Shift+H).
   - The app icon on the home screen shows the Totem mark on a midnight tile.
4. If anything is misaligned:
   - Mark too small/large → adjust `MARK_RATIO` in `scripts/generate-logo-assets.sh` and re-run from Task 3.
   - Wrong color → recheck the script's `MIDNIGHT` and `CREAM_WHITE` constants.

- [ ] **Step 4: Commit any iOS project metadata changes from cap sync**

```bash
cd /Users/cmitchell/www/cmrd/apps/totem
git status
```

If `cap sync` modified `ios/App/CapApp-SPM/Package.swift` or other iOS files, those changes are part of the integration:
```bash
git add ios/App/
git diff --staged --stat
git commit -m "chore(ios): cap sync after logo asset update"
```

If there are no changes, skip the commit.

---

## Task 9: Final verification

End-to-end check that all artifacts ship together cleanly.

- [ ] **Step 1: Run the unit tests**

Run:
```bash
cd /Users/cmitchell/www/cmrd/apps/totem
pnpm test:unit run
```
Expected: all tests pass, including `LogoMark.spec.ts`.

- [ ] **Step 2: Run the production build**

Run:
```bash
cd /Users/cmitchell/www/cmrd/apps/totem
pnpm build
```
Expected: `vue-tsc` and `vite build` both complete without errors. The `dist/` directory should contain `favicon.svg`, `favicon.ico`, `icon-180.png`, `icon-192.png`, `icon-512.png`, and `site.webmanifest` (Vite copies `public/` straight into `dist/`).

- [ ] **Step 3: Confirm dist contents**

Run:
```bash
ls /Users/cmitchell/www/cmrd/apps/totem/dist/ | grep -E "favicon|icon-|webmanifest"
```
Expected: 6 lines listing each asset.

- [ ] **Step 4: Re-run the generator to confirm idempotence**

Run:
```bash
cd /Users/cmitchell/www/cmrd/apps/totem
bash scripts/generate-logo-assets.sh
git status
```
Expected: script completes successfully, and `git status` shows zero modified files (the generator produces identical bytes on each run).

If `git status` shows changes, inspect the diff — most often this happens because ImageMagick re-encodes timestamps into the PNG metadata. If that's the cause, the script needs `-define png:exclude-chunks=date,time` added to each `magick` invocation; fix and re-commit.

- [ ] **Step 5: Final commit if any idempotence fixes were needed**

```bash
cd /Users/cmitchell/www/cmrd/apps/totem
git status
# only commit if idempotence fixes were applied
git add -p scripts/generate-logo-assets.sh
git commit -m "fix(brand): make logo asset generation idempotent" || true
```

---

## Acceptance criteria

Mirrors the spec's acceptance criteria. All must pass:

- [ ] **AC1** — Dev server: visiting any page in a modern browser shows the Totem mark as the favicon (SVG variant). Verified in Task 4 / Task 7.
- [ ] **AC2** — PWA: adding the dev URL to home screen on iOS Safari uses `icon-192.png` and the midnight `theme_color`. Verified manually in Task 7 if reachable from a phone, otherwise covered by Task 9 build artifacts.
- [ ] **AC3** — iOS app: simulator shows midnight-tile app icon and midnight splash with centered Totem mark. Verified in Task 8.
- [ ] **AC4** — In-app: SignInPage renders `LogoMark` and it picks up theme color (white on midnight, ink on cream). Verified in Task 7.
- [ ] **AC5** — Idempotent generation: re-running `scripts/generate-logo-assets.sh` produces zero file changes. Verified in Task 9.
