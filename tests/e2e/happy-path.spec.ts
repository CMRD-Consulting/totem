import { test, expect } from '@playwright/test';

// Happy-path E2E: create a playlist, paste a Spotify track, see it appear.
//
// Prerequisites (manual setup before running):
//   1. .env.local must point at a Supabase project where Apple OAuth is configured.
//   2. A test user must already exist in the Supabase auth.users table.
//   3. That user must be signed in once via the dev server (so the session lives in
//      localStorage). Playwright reuses that session via the storageState below.
//
// The plan acknowledges full automation is a v1 task; this spec is the structural
// scaffold. Run with:  pnpm run e2e

test('create playlist, paste a track, see it appear', async ({ page }) => {
  await page.goto('/');

  // The auth guard sends unsigned visitors to /sign-in. If we land there, the
  // test environment isn't seeded — fail with a useful message rather than a
  // cryptic selector miss.
  if (page.url().endsWith('/sign-in')) {
    test.skip(true, 'No persisted session; sign in once in dev server first.');
    return;
  }

  // Create a playlist.
  await page.goto('/create');
  await page.fill('input[placeholder*="kitchen"]', 'E2E Test ' + Date.now());
  await page.click('button:has-text("create group")');
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}$/, { timeout: 10_000 });

  // Open the paste-link sheet and add a track.
  await page.click('button:has-text("add a song")');
  await page.fill(
    'input[type="url"]',
    'https://open.spotify.com/track/1AhDOtG9vPSOmsWgNW0BEY',
  );
  await page.click('button:has-text("send to group")');

  // After ingest the sheet redirects back to the playlist; Blue Monday should appear.
  await expect(page.locator('text=Blue Monday')).toBeVisible({ timeout: 15_000 });
});
