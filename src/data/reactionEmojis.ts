/** Quick bar on track detail + starred in the reaction tray “Frequently used”. */
export const QUICK_REACTS = ['🔥', '❤️', '😭', '👑', '💔', '🌙'] as const;

export type EmojiPickItem = { c: string; k: string };

export type EmojiSection = { title: string; items: EmojiPickItem[] };

function e(c: string, k: string): EmojiPickItem {
  return { c, k: k.toLowerCase() };
}

const SMILEYS: EmojiPickItem[] = [
  e('😀', 'smile grin happy face'),
  e('😃', 'smiley open mouth happy'),
  e('😄', 'grin eyes mouth'),
  e('😁', 'beaming smile teeth'),
  e('😅', 'sweat smile nervous'),
  e('😂', 'joy tears laughing'),
  e('🤣', 'rofl rolling floor laugh'),
  e('🥲', 'tear smile touched'),
  e('☺️', 'relaxed smile outlined'),
  e('😊', 'blush smile'),
  e('😇', 'halo angel innocent'),
  e('🙂', 'slight smile'),
  e('🙃', 'upside down sarcasm'),
  e('😉', 'wink'),
  e('😌', 'relieved peaceful'),
  e('😍', 'heart eyes love'),
  e('🥰', 'hearts love crush'),
  e('😘', 'kiss heart'),
  e('😗', 'kiss'),
  e('😙', 'kiss smiling eyes'),
  e('😚', 'kiss closed eyes'),
  e('😋', 'yum delicious tongue'),
  e('😛', 'tongue silly'),
  e('😜', 'wink tongue'),
  e('🤪', 'zany crazy'),
  e('😝', 'tongue squint'),
  e('😐', 'neutral meh'),
  e('😑', 'expressionless'),
  e('😶', 'no mouth quiet'),
  e('🫥', 'dotted face invisible'),
  e('😏', 'smirk'),
  e('😒', 'unamused side eye'),
  e('🙄', 'roll eyes'),
  e('😬', 'grimace awkward'),
  e('🤥', 'lying pinocchio'),
  e('🤔', 'thinking hmm'),
  e('😔', 'pensive sad'),
  e('😪', 'sleepy'),
  e('🤤', 'drool'),
  e('😴', 'sleep zzz tired'),
  e('😷', 'mask sick'),
  e('🤒', 'thermometer fever'),
  e('🤕', 'head bandage hurt'),
  e('🤢', 'nauseated'),
  e('🤮', 'vomit'),
  e('🥵', 'hot face'),
  e('🥶', 'cold freeze'),
  e('🥴', 'woozy drunk'),
  e('😵', 'dizzy'),
  e('🤯', 'mind blown'),
  e('🤠', 'cowboy hat'),
  e('🥳', 'party celebrating'),
  e('🥸', 'disguise glasses'),
  e('😎', 'cool sunglasses'),
  e('🤓', 'nerd glasses'),
  e('🧐', 'monocle inspect'),
  e('😕', 'confused'),
  e('🫤', 'diagonal mouth'),
  e('😟', 'worried'),
  e('🙁', 'slight frown'),
  e('☹️', 'frown'),
  e('😮', 'open mouth surprised'),
  e('😯', 'hushed'),
  e('😲', 'astonished wow'),
  e('😳', 'flushed embarrassed'),
  e('🥺', 'pleading puppy eyes'),
  e('🥹', 'tear grateful'),
  e('😦', 'frown mouth open'),
  e('😧', 'anguished'),
  e('😨', 'fearful'),
  e('😰', 'anxious sweat'),
  e('😥', 'disappointed relieved'),
  e('😢', 'cry tear'),
  e('😭', 'sob crying loud'),
  e('😱', 'scream fear'),
  e('😖', 'confounded'),
  e('😣', 'persevere struggle'),
  e('😞', 'disappointed'),
  e('😓', 'downcast sweat'),
  e('😩', 'weary tired'),
  e('😫', 'tired'),
  e('🥱', 'yawn'),
  e('😤', 'triumph steam nose'),
  e('😡', 'pouting angry red'),
  e('😠', 'angry mad'),
  e('🤬', 'swearing'),
  e('😈', 'smiling imp devil'),
  e('👿', 'angry devil'),
  e('💀', 'skull dead'),
  e('☠️', 'skull crossbones'),
  e('💩', 'poop'),
  e('🤡', 'clown'),
  e('👹', 'ogre'),
  e('👺', 'goblin'),
  e('👻', 'ghost'),
  e('👽', 'alien'),
  e('👾', 'space invader game'),
  e('🤖', 'robot bot'),
];

const HANDS: EmojiPickItem[] = [
  e('👍', 'thumbs up yes agree'),
  e('👎', 'thumbs down no'),
  e('👏', 'clap applause'),
  e('🙌', 'raised hands celebration'),
  e('👐', 'open hands'),
  e('🤲', 'palms up'),
  e('🤝', 'handshake deal'),
  e('🙏', 'pray please thanks'),
  e('✌️', 'peace victory v'),
  e('🤞', 'fingers crossed luck'),
  e('🤟', 'love you gesture'),
  e('🤘', 'rock horns'),
  e('👌', 'ok perfect'),
  e('🤌', 'pinched fingers'),
  e('🤏', 'small amount'),
  e('✊', 'fist solidarity'),
  e('👊', 'punch fist bump'),
  e('🤛', 'left fist'),
  e('🤜', 'right fist'),
  e('👋', 'wave hello bye'),
  e('🤚', 'raised back hand'),
  e('✋', 'stop hand'),
  e('💪', 'flex muscle strong'),
  e('🦾', 'mechanical arm'),
  e('🖕', 'middle finger rude'),
  e('☝️', 'point up'),
  e('👆', 'backhand point up'),
  e('👇', 'point down'),
  e('👈', 'point left'),
  e('👉', 'point right'),
  e('💅', 'nail care sass'),
  e('🤳', 'selfie'),
  e('💃', 'dance woman'),
  e('🕺', 'dance man'),
];

const HEARTS: EmojiPickItem[] = [
  e('❤️', 'red heart love'),
  e('🧡', 'orange heart'),
  e('💛', 'yellow heart'),
  e('💚', 'green heart'),
  e('💙', 'blue heart'),
  e('💜', 'purple heart'),
  e('🖤', 'black heart'),
  e('🤍', 'white heart'),
  e('🤎', 'brown heart'),
  e('💔', 'broken heart'),
  e('❣️', 'heart exclamation'),
  e('💕', 'two hearts'),
  e('💞', 'revolving hearts'),
  e('💓', 'beating heart'),
  e('💗', 'growing heart'),
  e('💖', 'sparkling heart'),
  e('💘', 'cupid arrow'),
  e('💝', 'gift heart'),
  e('💟', 'heart decoration'),
  e('♥️', 'heart suit'),
];

const MUSIC: EmojiPickItem[] = [
  e('🎵', 'music note'),
  e('🎶', 'notes melody'),
  e('🎤', 'mic karaoke'),
  e('🎧', 'headphones listen'),
  e('🎷', 'saxophone jazz'),
  e('🎸', 'guitar rock'),
  e('🎹', 'keyboard piano'),
  e('🥁', 'drums'),
  e('🎺', 'trumpet'),
  e('🎻', 'violin'),
  e('🪕', 'banjo'),
  e('🎼', 'score'),
  e('🎬', 'clapper film'),
  e('🎭', 'theater drama'),
  e('🪩', 'disco ball'),
  e('💃', 'dance'),
  e('🕺', 'dance man'),
];

const SYMBOLS: EmojiPickItem[] = [
  e('✨', 'sparkles magic'),
  e('💫', 'dizzy star'),
  e('⭐', 'star'),
  e('🌟', 'glowing star'),
  e('💯', '100 perfect'),
  e('🔥', 'fire lit hot'),
  e('💥', 'boom collision'),
  e('🎉', 'party popper celebrate'),
  e('🎊', 'confetti ball'),
  e('🏆', 'trophy win'),
  e('🥇', 'gold first'),
  e('👑', 'crown king'),
  e('💎', 'gem diamond'),
  e('⚡', 'zap lightning'),
  e('☀️', 'sun'),
  e('🌙', 'moon night'),
  e('🌈', 'rainbow'),
  e('☁️', 'cloud'),
  e('❗', 'exclamation'),
  e('❓', 'question'),
  e('💬', 'speech bubble'),
  e('👀', 'eyes looking'),
  e('🙈', 'see no evil'),
  e('🙉', 'hear no evil'),
  e('🙊', 'speak no evil'),
];

function dedupeItems(items: EmojiPickItem[]): EmojiPickItem[] {
  const seen = new Set<string>();
  const out: EmojiPickItem[] = [];
  for (const it of items) {
    if (seen.has(it.c)) continue;
    seen.add(it.c);
    out.push(it);
  }
  return out;
}

const frequentItems = dedupeItems([
  ...QUICK_REACTS.map((c) => e(c, 'frequent quick')),
  e('👍', 'thumbs up yes'),
  e('😂', 'joy laugh'),
  e('🎉', 'party celebrate'),
  e('🔥', 'fire lit'),
  e('✨', 'sparkles'),
  e('😍', 'heart eyes'),
  e('🙏', 'pray thanks'),
  e('👀', 'eyes'),
  e('💯', 'hundred'),
  e('🤔', 'think hmm'),
  e('😮', 'surprised wow'),
  e('🥺', 'pleading'),
]);

export const EMOJI_REACTION_SECTIONS: EmojiSection[] = [
  { title: 'Frequently used', items: frequentItems },
  { title: 'Smileys & people', items: SMILEYS },
  { title: 'Hands & celebration', items: HANDS },
  { title: 'Hearts', items: HEARTS },
  { title: 'Music & fun', items: dedupeItems([...MUSIC, ...SYMBOLS]) },
];

export function filterEmojiSections(query: string, sections: EmojiSection[]): EmojiSection[] {
  const q = query.trim().toLowerCase();
  if (!q) return sections;
  const out: EmojiSection[] = [];
  for (const s of sections) {
    const items = s.items.filter((it) => it.k.includes(q) || it.c === q);
    if (items.length) out.push({ title: s.title, items });
  }
  return out;
}
