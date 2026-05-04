import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decodeState } from "./index.ts";

Deno.test("decodeState parses base64 JSON state", () => {
  const state = btoa(JSON.stringify({ playlist_id: "p1", jwt: "j1" }));
  assertEquals(decodeState(state), { playlist_id: "p1", jwt: "j1" });
});
