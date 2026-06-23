import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isTokenExpired } from "../_shared/musicService.ts";
import { addTracksToPlaylist } from "../_shared/spotify.ts";

Deno.test("isTokenExpired returns true when expires_at is in the past", () => {
  const past = new Date(Date.now() - 60_000).toISOString();
  assertEquals(isTokenExpired(past), true);
});

Deno.test("isTokenExpired returns false with 60s buffer when expires_at is far future", () => {
  const future = new Date(Date.now() + 600_000).toISOString();
  assertEquals(isTokenExpired(future), false);
});

Deno.test("isTokenExpired returns true within 60s buffer of expiry", () => {
  const soon = new Date(Date.now() + 30_000).toISOString();
  assertEquals(isTokenExpired(soon), true);
});

// addTracksToPlaylist is the new chunking helper backfill leans on. Spotify
// caps POST /playlists/{id}/tracks at 100 URIs per call, so anything > 100
// must split. These tests intercept fetch so they exercise the chunk math
// without touching the network.

// fetch is called as fetch(url, { method, body, headers }) by the spotify
// helper, so the mock receives (url, init) — parse init.body for assertions.
function withMockedFetch(
  handler: (
    url: string | URL | Request,
    init?: RequestInit,
  ) => Promise<Response>,
  fn: () => Promise<void>,
): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = handler as typeof fetch;
  return fn().finally(() => {
    globalThis.fetch = original;
  });
}

Deno.test("addTracksToPlaylist returns 0 for empty input and never calls fetch", async () => {
  let called = 0;
  await withMockedFetch(
    () => {
      called++;
      return Promise.resolve(new Response("{}", { status: 201 }));
    },
    async () => {
      const n = await addTracksToPlaylist("tok", "p", []);
      assertEquals(n, 0);
      assertEquals(called, 0);
    },
  );
});

function parseUris(init?: RequestInit): string[] {
  const body = JSON.parse(init?.body as string) as { uris: string[] };
  return body.uris;
}

Deno.test("addTracksToPlaylist sends a single call for <= 100 tracks", async () => {
  const ids = Array.from({ length: 100 }, (_, i) => `t${i}`);
  let calls = 0;
  let receivedUris: string[] = [];
  await withMockedFetch(
    (_url, init) => {
      calls++;
      receivedUris = parseUris(init);
      return Promise.resolve(new Response("{}", { status: 201 }));
    },
    async () => {
      const n = await addTracksToPlaylist("tok", "p", ids);
      assertEquals(n, 100);
      assertEquals(calls, 1);
      assertEquals(receivedUris.length, 100);
      assertEquals(receivedUris[0], "spotify:track:t0");
    },
  );
});

Deno.test("addTracksToPlaylist chunks calls in groups of 100", async () => {
  const ids = Array.from({ length: 250 }, (_, i) => `t${i}`);
  const chunkSizes: number[] = [];
  await withMockedFetch(
    (_url, init) => {
      chunkSizes.push(parseUris(init).length);
      return Promise.resolve(new Response("{}", { status: 201 }));
    },
    async () => {
      const n = await addTracksToPlaylist("tok", "p", ids);
      assertEquals(n, 250);
      assertEquals(chunkSizes, [100, 100, 50]);
    },
  );
});

Deno.test("addTracksToPlaylist dedupes input before chunking", async () => {
  // 120 ids but only 100 unique → one chunk, 100 uris.
  const ids = [
    ...Array.from({ length: 100 }, (_, i) => `t${i}`),
    ...Array.from({ length: 20 }, (_, i) => `t${i}`),
  ];
  const chunkSizes: number[] = [];
  await withMockedFetch(
    (_url, init) => {
      chunkSizes.push(parseUris(init).length);
      return Promise.resolve(new Response("{}", { status: 201 }));
    },
    async () => {
      const n = await addTracksToPlaylist("tok", "p", ids);
      assertEquals(n, 100);
      assertEquals(chunkSizes, [100]);
    },
  );
});

Deno.test("addTracksToPlaylist throws on Spotify error response", async () => {
  await withMockedFetch(
    () => Promise.resolve(new Response("oops", { status: 502 })),
    async () => {
      let caught: string | null = null;
      try {
        await addTracksToPlaylist("tok", "p", ["t1"]);
      } catch (err) {
        caught = (err as Error).message;
      }
      assertEquals(caught?.includes("502"), true);
    },
  );
});
