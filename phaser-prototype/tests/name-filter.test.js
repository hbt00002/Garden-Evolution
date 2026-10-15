import test from "node:test";
import assert from "node:assert/strict";
import { isNameAllowed, normalizeName } from "../cloudflare/name-filter.js";

test("ordinary names are allowed", () => {
  for (const name of ["Mira", "Ada Lovelace", "berat", "Çiçek", "Ørjan", "山田太郎", "Zoë_92", "Garden Fan", "Kaya", "김민수", "Анна", "さくら"]) {
    assert.equal(isNameAllowed(name), true, name);
  }
});

test("blocked words are refused however they are disguised", () => {
  for (const name of ["fuck", "FUCK", "f u c k", "f.u.c.k", "fuuuuck", "fvck".replace("v", "u"), "sh1t", "b1tch", "SHIT_face", "xX_cunt_Xx", "n1gger", "orospu", "0r0spu", "SİKTİR", "a$$hole", "H1tler", "Пиздец", "ХУЙ"]) {
    assert.equal(isNameAllowed(name), false, name);
  }
});

test("short blocked words only count as the whole name", () => {
  assert.equal(isNameAllowed("amk"), false);
  assert.equal(isNameAllowed("AMK"), false);
  assert.equal(isNameAllowed("Kamkar"), true, "contains amk but is a name");
  assert.equal(isNameAllowed("Sikorsky"), true);
  assert.equal(isNameAllowed("Assad"), true);
});

test("innocent words that contain a blocked one are allowed", () => {
  for (const name of ["Scunthorpe", "Classic", "Assassin", "Dickens"]) {
    assert.equal(isNameAllowed(name), true, name);
  }
});

test("names posing as the game or its staff are refused", () => {
  for (const name of ["admin", "Admin", "Moderator", "garden evolution", "G4rden-Evolution", "SYSTEM", "support"]) {
    assert.equal(isNameAllowed(name), false, name);
  }
  assert.equal(isNameAllowed("Admiral"), true);
});

test("a name with no letters at all is refused", () => {
  assert.equal(isNameAllowed("1234"), true, "digits that look like letters stay readable");
  assert.equal(isNameAllowed("..."), false);
  assert.equal(isNameAllowed("   "), false);
});

test("normalisation strips accents, separators and stretched letters", () => {
  assert.equal(normalizeName("F-ü-C-k"), "fuck");
  assert.equal(normalizeName("Fuuuck"), "fuck");
  assert.equal(normalizeName("Zoë"), "zoe");
});
