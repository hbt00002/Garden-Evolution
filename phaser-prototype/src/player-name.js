// A leaderboard name as it is stored and shown, the same in the game and on
// the server: invisible and direction-changing characters, blank-looking
// fillers and piles of combining marks are removed, spaces tidied, and the
// name cut to 16 characters as the database counts them (code points)
// without ever splitting a character people see as one (an emoji, a letter
// with its accent).
const MAX_LENGTH = 16;
const graphemes = typeof Intl !== "undefined" && Intl.Segmenter
  ? text => [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map(part => part.segment)
  : text => [...text];

// The zero-width joiner holds an emoji together (a family is one picture);
// anywhere else it is an invisible character.
const LOOSE_JOINER = /(?<!\p{Extended_Pictographic}\uFE0F?)\u200D|\u200D(?!\p{Extended_Pictographic})/gu;
// Format characters (zero-width spaces, direction overrides…), the Hangul
// fillers and the blank braille cell, all of which look like nothing.
const INVISIBLE = /[\p{Cf}\u115F\u1160\u3164\uFFA0\u2800]/gu;

export function cleanName(value) {
  const text = String(value || "")
    .normalize("NFKC")
    // Control characters are exactly what is being removed here.
    // eslint-disable-next-line no-control-regex
    .replace(/[<>\u0000-\u001f\u007f]/g, "")
    .replace(LOOSE_JOINER, "")
    .replace(INVISIBLE, ch => (ch === "\u200D" ? ch : ""))
    // At most two marks on a letter: no towers of accents spilling out.
    .replace(/(\p{M}{2})\p{M}+/gu, "$1")
    .replace(/\s+/g, " ")
    .trim();
  let name = "";
  let length = 0;
  for (const part of graphemes(text)) {
    const size = [...part].length;
    if (length + size > MAX_LENGTH) break;
    name += part;
    length += size;
  }
  return name.trim();
}

// How moderation compares names: the cleaned name with only the ASCII letters
// lowered, exactly as SQLite's lower() does, so the database can match it.
// ("ŞEY" and "şey" stay two names.)
export function nameKey(value) {
  return cleanName(value).replace(/[A-Z]/g, letter => letter.toLowerCase());
}
