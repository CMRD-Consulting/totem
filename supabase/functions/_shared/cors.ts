// Shared CORS helper for Supabase Edge Functions.
//
// Browsers (and Capacitor's web view) send an OPTIONS preflight before any
// cross-origin POST that carries `Authorization` or a non-simple Content-Type.
// Without these headers the actual request is blocked by the browser before
// it reaches the function — looks like a generic "fetch failed" on the client.

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

/** Returns a 204 preflight response when the request is OPTIONS, otherwise null. */
export function handlePreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  return null;
}

/** Wrap a Response so that CORS headers are present on all real responses. */
export function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

/** Build a plain Response with CORS headers. */
export function corsResponse(
  body: BodyInit | null,
  init: ResponseInit = {},
): Response {
  const headers = new Headers(init.headers);
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
  return new Response(body, { ...init, headers });
}
