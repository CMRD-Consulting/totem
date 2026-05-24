import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { consumeStateToken } from "./index.ts";
import {
  generateStateToken,
  OAUTH_STATE_MAX_AGE_MS,
} from "../_shared/oauthState.ts";

// consumeStateToken talks to the database via the supabase-js client. To
// avoid pulling in a real Supabase for unit tests, we hand-roll a minimal
// chainable mock that satisfies the call shape exactly:
//   admin.from(table).select(...).eq(...).maybeSingle()
//   admin.from(table).delete().eq(...)
interface MockRow {
  jwt: string;
  playlist_id: string | null;
  created_at: string;
}

function makeAdminMock(opts: {
  row: MockRow | null;
}): {
  admin: Parameters<typeof consumeStateToken>[0];
  deletes: { table: string; column: string; value: unknown }[];
} {
  const deletes: { table: string; column: string; value: unknown }[] = [];
  const admin = {
    from(table: string) {
      return {
        select(_cols: string) {
          return {
            eq(_col: string, _val: unknown) {
              return {
                maybeSingle() {
                  return Promise.resolve({ data: opts.row, error: null });
                },
              };
            },
          };
        },
        delete() {
          return {
            eq(column: string, value: unknown) {
              deletes.push({ table, column, value });
              return Promise.resolve({ error: null });
            },
            lt(column: string, value: unknown) {
              deletes.push({ table, column, value });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
    // deno-lint-ignore no-explicit-any
  } as any;
  return { admin, deletes };
}

Deno.test("generateStateToken produces 32 hex characters", () => {
  const t = generateStateToken();
  assertEquals(t.length, 32);
  assert(/^[0-9a-f]{32}$/.test(t));
});

Deno.test("generateStateToken produces unique values across calls", () => {
  const a = generateStateToken();
  const b = generateStateToken();
  assert(a !== b);
});

Deno.test("consumeStateToken returns null when token is unknown", async () => {
  const { admin } = makeAdminMock({ row: null });
  const result = await consumeStateToken(admin, "missing");
  assertEquals(result, null);
});

Deno.test("consumeStateToken returns jwt + playlist_id and deletes the row", async () => {
  const { admin, deletes } = makeAdminMock({
    row: {
      jwt: "user-jwt",
      playlist_id: "playlist-uuid",
      created_at: new Date().toISOString(),
    },
  });
  const result = await consumeStateToken(admin, "tok");
  assertEquals(result, { jwt: "user-jwt", playlist_id: "playlist-uuid" });
  // exactly one delete, on oauth_states, keyed by state_token
  assertEquals(deletes.length, 1);
  assertEquals(deletes[0], {
    table: "oauth_states",
    column: "state_token",
    value: "tok",
  });
});

Deno.test("consumeStateToken returns null for a row older than the max age", async () => {
  const stale = new Date(Date.now() - OAUTH_STATE_MAX_AGE_MS - 5_000).toISOString();
  const { admin } = makeAdminMock({
    row: { jwt: "j", playlist_id: null, created_at: stale },
  });
  const result = await consumeStateToken(admin, "tok");
  assertEquals(result, null);
});

Deno.test("consumeStateToken accepts a row right at the edge of the window", async () => {
  const justInside = new Date(Date.now() - (OAUTH_STATE_MAX_AGE_MS - 1_000))
    .toISOString();
  const { admin } = makeAdminMock({
    row: { jwt: "j", playlist_id: null, created_at: justInside },
  });
  const result = await consumeStateToken(admin, "tok");
  assertEquals(result?.jwt, "j");
});
