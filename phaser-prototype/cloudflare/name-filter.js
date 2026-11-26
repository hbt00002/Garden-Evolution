// Keeps the public leaderboard presentable. This is a safety net, not a
// language police: it normalises the usual disguises (case, accents, leetspeak,
// separators, stretched letters) and rejects names built around a short list
// of slurs and strong profanity (English, Turkish and Russian), plus names that
// pose as the game or its staff. Extend BLOCKED when something slips through.

const LOOKALIKES = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i", "|": "i", "ı": "i" };

// Letters of other scripts that look like Latin ones (Cyrillic, Greek,
// Armenian): a Latin name written with a few of them is a disguise ("аdmin")
// and is refused outright (they are not mapped to Latin, which would spoil
// the Cyrillic words below).
const CONFUSABLES = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "к": "k", "м": "m", "т": "t", "в": "b", "н": "h",
  "ѕ": "s", "і": "i", "ј": "j", "ԁ": "d", "ӏ": "l", "ԛ": "q", "ԝ": "w",
  "α": "a", "ο": "o", "ρ": "p", "ε": "e", "ι": "i", "κ": "k", "ν": "v", "τ": "t", "υ": "u", "χ": "x",
  "ս": "u", "օ": "o", "հ": "h", "ո": "n", "ց": "g"
};

// Latin letters mixed with look-alikes from another script. A name wholly in
// Cyrillic or Greek is a name, not a disguise.
function mixesScripts(name) {
  return /\p{Script=Latin}/u.test(name) && [...String(name).toLowerCase()].some(ch => CONFUSABLES[ch]);
}

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
  "fuck", "phuck", "shit", "bitch", "cunt", "nigger", "nigga", "faggot", "whore", "slut", "dick", "pussy",
  "asshole", "bastard", "rapist", "nazi", "hitler",
  "orospu", "pezevenk", "yarrak", "amcik", "gotveren", "ibne", "sikik", "sikerim", "siktir",
  "sikis", "sikim", "sikiyim", "sikeyim", "amina", "yavsak", "kahpe", "gavat", "kaltak", "serefsiz",
  // A name followed by a possessive and "sik" ("…nin siki").
  "ninsik", "nunsik", "insiki", "unsiki",
  "блят", "бляд", "хуй", "пизд", "ебан", "ебат", "пидор", "мудак"
].map(prepare);

// Short words are only refused as a word of their own ("Ali Amk"), never
// inside another word ("Kamkar").
const BLOCKED_EXACT = ["amk", "aq", "sik", "oc", "pic", "ass", "tits", "fck", "fuk", "stfu"].map(prepare);

// Refused as a word only as written: "göt", but English "got" is fine.
const BLOCKED_WRITTEN = ["göt"];

// Posing as the game, its staff or the leaderboard itself.
const RESERVED = ["admin", "administrator", "moderator", "system", "official", "gardenevolution", "support", "staff"].map(prepare);

// Innocent words that contain a blocked one.
const ALLOWED_WORDS = [
  "scunthorpe", "assassin", "classic", "dickens", "dickinson", "shitake", "bassist", "mishit",
  "nazim", "nazif", "nazife", "nazire", "nazir", "musiki",
  // "Mustafa G…" runs into "fagot" once the space is gone.
  "mustafa"
].map(prepare);

export function isNameAllowed(name) {
  if (mixesScripts(name)) return false;
  const text = normalizeName(name);
  if (!text) return false;
  if (RESERVED.includes(text)) return false;
  const words = String(name).split(/[\s._-]+/).filter(Boolean);
  if (words.some(word => BLOCKED_WRITTEN.includes(word.normalize("NFC").toLocaleLowerCase("tr")))) return false;
  if ([text, ...words.map(normalizeName)].some(word => BLOCKED_EXACT.includes(word))) return false;
  let rest = text;
  for (const word of ALLOWED_WORDS) rest = rest.split(word).join("");
  return !BLOCKED.some(word => rest.includes(word));
}
