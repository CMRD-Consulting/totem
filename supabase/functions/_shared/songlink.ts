export interface SonglinkResult {
  isrc?: string;
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
  durationMs?: number;
  spotifyId?: string;
  appleMusicId?: string;
  youtubeMusicId?: string;
  songlinkUrl: string;
}

export async function resolveSonglink(url: string): Promise<SonglinkResult> {
  const endpoint = `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(url)}`;
  const res = await fetch(endpoint, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Songlink ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();

  // Find a representative entity for title/artist (prefer Spotify if present, else first).
  const entitiesById = data.entitiesByUniqueId ?? {};
  const entityKeys = Object.keys(entitiesById);
  const representative =
    entityKeys.find((k) => entitiesById[k].apiProvider === "spotify")
      ? entitiesById[entityKeys.find((k) => entitiesById[k].apiProvider === "spotify")!]
      : entitiesById[entityKeys[0]];

  if (!representative) throw new Error("Songlink returned no entities");

  const platforms = data.linksByPlatform ?? {};
  const idFor = (platform: string): string | undefined => {
    const link = platforms[platform];
    if (!link?.entityUniqueId) return undefined;
    const entity = entitiesById[link.entityUniqueId];
    return entity?.id;
  };

  return {
    isrc: representative.isrc,
    title: representative.title,
    artist: representative.artistName,
    album: representative.albumName,
    artworkUrl: representative.thumbnailUrl,
    durationMs: representative.durationMs,
    spotifyId: idFor("spotify"),
    appleMusicId: idFor("appleMusic"),
    youtubeMusicId: idFor("youtubeMusic") ?? idFor("youtube"),
    songlinkUrl: data.pageUrl,
  };
}
