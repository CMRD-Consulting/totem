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
}

export interface Group {
  id: string;
  name: string;
  code: string;
  inviteToken: string;
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
