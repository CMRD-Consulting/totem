import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveTrackRow } from "./index.ts";

Deno.test("resolveTrackRow extracts canonical fields from Songlink result", () => {
  const songlink = {
    isrc: "GBAYE0601498",
    title: "Blue Monday",
    artist: "New Order",
    album: "Power, Corruption & Lies",
    artworkUrl: "https://example.com/art.jpg",
    durationMs: 446000,
    spotifyId: "1AhDOtG9vPSOmsWgNW0BEY",
    appleMusicId: undefined,
    youtubeMusicId: "abc123",
    songlinkUrl: "https://song.link/x",
  };
  const row = resolveTrackRow(songlink);
  assertEquals(row.isrc, "GBAYE0601498");
  assertEquals(row.spotify_id, "1AhDOtG9vPSOmsWgNW0BEY");
  assertEquals(row.apple_music_id, null);
  assertEquals(row.youtube_music_id, "abc123");
  assertEquals(row.title, "Blue Monday");
});
