const YOUTUBE_AUTH = "https://oauth2.googleapis.com/token";
const YOUTUBE_AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/youtube.force-ssl",
].join(" ");

export interface YouTubeTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

export function youtubeAuthorizeUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const url = new URL(YOUTUBE_AUTHORIZE);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", YOUTUBE_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<YouTubeTokens> {
  const clientId = Deno.env.get("YOUTUBE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("YOUTUBE_CLIENT_SECRET")!;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(YOUTUBE_AUTH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`YouTube token exchange ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<YouTubeTokens> {
  const clientId = Deno.env.get("YOUTUBE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("YOUTUBE_CLIENT_SECRET")!;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(YOUTUBE_AUTH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`YouTube refresh ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export async function getCurrentChannel(
  accessToken: string,
): Promise<{ id: string; title: string }> {
  const url = new URL(`${YOUTUBE_API}/channels`);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("mine", "true");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`YouTube channels ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const channel = data.items?.[0];
  if (!channel?.id) throw new Error("YouTube channel not found");
  return { id: channel.id, title: channel.snippet?.title ?? channel.id };
}

export async function createPlaylist(
  accessToken: string,
  name: string,
  description: string,
): Promise<{ id: string }> {
  const res = await fetch(`${YOUTUBE_API}/playlists?part=snippet,status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      snippet: { title: name, description },
      status: { privacyStatus: "private" },
    }),
  });
  if (!res.ok) throw new Error(`YouTube createPlaylist ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { id: data.id };
}

export async function addVideoToPlaylist(
  accessToken: string,
  playlistId: string,
  videoId: string,
): Promise<void> {
  const res = await fetch(`${YOUTUBE_API}/playlistItems?part=snippet`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      snippet: {
        playlistId,
        resourceId: { kind: "youtube#video", videoId },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`YouTube add video ${res.status}: ${await res.text()}`);
  }
}

export async function addVideosToPlaylist(
  accessToken: string,
  playlistId: string,
  videoIds: string[],
): Promise<number> {
  const unique = Array.from(new Set(videoIds));
  let pushed = 0;
  for (const videoId of unique) {
    await addVideoToPlaylist(accessToken, playlistId, videoId);
    pushed++;
  }
  return pushed;
}

export async function removeVideoFromPlaylist(
  accessToken: string,
  playlistId: string,
  videoId: string,
): Promise<void> {
  const listUrl = new URL(`${YOUTUBE_API}/playlistItems`);
  listUrl.searchParams.set("part", "id");
  listUrl.searchParams.set("playlistId", playlistId);
  listUrl.searchParams.set("videoId", videoId);
  listUrl.searchParams.set("maxResults", "1");
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!listRes.ok) {
    throw new Error(`YouTube list playlistItems ${listRes.status}: ${await listRes.text()}`);
  }
  const listData = await listRes.json();
  const itemId = listData.items?.[0]?.id;
  if (!itemId) return;

  const delRes = await fetch(`${YOUTUBE_API}/playlistItems?id=${itemId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!delRes.ok) {
    throw new Error(`YouTube remove video ${delRes.status}: ${await delRes.text()}`);
  }
}
