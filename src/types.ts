export type ServiceKey = 'spotify' | 'apple' | 'youtube';

export interface Service {
  name: string;
  short: string;
  color: string;
}

export interface Friend {
  id: string;
  name: string;
  hue: number;
  service: ServiceKey;
  initial: string;
}

export interface Reaction {
  e: string;
  by: string[];
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  adder: string;
  added: string;
  service: ServiceKey;
  reactions: Reaction[];
  seed: number;
  artworkUrl?: string;
  /** Client-only optimistic state.
   *  - 'resolving' — ingest in flight, real row not yet present.
   *  - 'failed' — ingest errored; user can dismiss. */
  status?: 'resolving' | 'failed';
  errorMessage?: string;
  /** The original URL the user pasted, kept for failure UX (so we can
   *  hint at what was being added). */
  sourceUrl?: string;
}

export interface Playlist {
  id: string;
  name: string;
  code: string;
  inviteToken: string;
  createdBy?: string;
  members: string[];
  tracks: number;
  sigil: [number, number, number];
  trackSeeds?: number[];
}

export type ActivityKind = 'add' | 'react' | 'mirror' | 'join';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  who: string;
  what: string;
  detail?: string;
  emoji?: string;
  when: string;
}

export type ThemeKey = 'paper' | 'cream' | 'midnight';
