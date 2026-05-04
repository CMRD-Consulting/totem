import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isTokenExpired } from "./index.ts";

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
