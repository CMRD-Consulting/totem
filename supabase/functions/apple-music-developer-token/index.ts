import { createDeveloperToken } from "../_shared/appleMusic.ts";
import { corsResponse, handlePreflight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") return corsResponse("Method not allowed", { status: 405 });

  try {
    const token = await createDeveloperToken();
    return corsResponse(JSON.stringify({ developer_token: token }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return corsResponse((err as Error).message, { status: 500 });
  }
});
