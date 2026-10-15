// Keeps the public leaderboard presentable. This is a safety net, not a
// language police: it normalises the usual disguises (case, accents, leetspeak,
// separators, stretched letters) and rejects names built around a short list
// of slurs and strong profanity (English, Turkish and Russian), plus names that
// pose as the game or its staff. Extend BLOCKED when something slips through.

const LOOKALIKES = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i", "|": "i", "ı": "i" };

// Accents and case are dropped for names and for the word lists alike, so
// "ö" and "o", or Cyrillic "й" and "и", never decide a match.
function fold(text) {
  return String(text).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// "fuuuck" -> "fuck": runs of one letter count once, for both sides.
function collapse(text) {
  return text.replace(/(.)\1+/g, "$1");
}

const prepare = word => collapse(fold(word));

// "Fuuuck", "f.u.c.k" and "FÜCK" all reduce to "fuck".
export function normalizeName(name) {
  const letters = fold(name)
    .replace(/[01345 7@$!|ı]/g, ch => LOOKALIKES[ch] ?? "")
    // Keep letters of every script, so names in Chinese, Japanese, Korean or
    // Cyrillic are normalised like any other instead of vanishing.
    .replace(/[^\p{L}]/gu, "");
  return collapse(letters);
}

// Matched anywhere in the normalised name (four letters or more, so a short
// word cannot hide inside an innocent one).
const BLOCKED = [
  "fuck", "shit", "bitch", "cunt", "nigger", "nigga", "faggot", "whore", "slut", "dick", "pussy",
  "asshole", "bastard", "rapist", "nazi", "hitler",
  "orospu", "pezevenk", "yarrak", "amcik", "gotveren", "ibne", "sikik", "sikerim", "siktir",
  "блят", "бляд", "хуй", "пизд", "ебан", "ебат", "пидор", "мудак"
].map(prepare);

// Short words are only refused when they are the whole name.
const BLOCKED_EXACT = ["amk", "sik", "oc", "pic", "ass", "tits"].map(prepare);

// Posing as the game, its staff or the leaderboard itself.
const RESERVED = ["admin", "administrator", "moderator", "system", "official", "gardenevolution", "support", "staff"].map(prepare);

// Innocent words that contain a blocked one.
const ALLOWED_WORDS = ["scunthorpe", "assassin", "classic", "dickens", "shitake", "bassist"].map(prepare);

export function isNameAllowed(name) {
  const text = normalizeName(name);
  if (!text) return false;
  if (RESERVED.includes(text)) return false;
  if (BLOCKED_EXACT.includes(text)) return false;
  let rest = text;
  for (const word of ALLOWED_WORDS) rest = rest.split(word).join("");
  return !BLOCKED.some(word => rest.includes(word));
}
