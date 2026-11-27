import test from "node:test";
import assert from "node:assert/strict";
import { LOCALIZED_STAGES, LOWER_SCORE_COPY, PLAY_LABELS, TILE_NAMES, TRANSLATIONS } from "../src/i18n.js";

const languages = Object.keys(TRANSLATIONS);

test("every language defines every English string", () => {
  const english = Object.keys(TRANSLATIONS.en);
  for (const language of languages) {
    const missing = english.filter(key => !TRANSLATIONS[language][key]);
    assert.deepEqual(missing, [], `${language} is missing strings`);
  }
});

test("no language has strings that English lacks", () => {
  const english = new Set(Object.keys(TRANSLATIONS.en));
  for (const language of languages) {
    const extra = Object.keys(TRANSLATIONS[language]).filter(key => !english.has(key));
    assert.deepEqual(extra, [], `${language} has unknown keys`);
  }
});

test("the side tables cover every language", () => {
  for (const language of languages) {
    assert.ok(PLAY_LABELS[language], `${language} play label`);
    assert.equal(LOWER_SCORE_COPY[language]?.length, 4, `${language} lower-score copy`);
    if (language !== "en") assert.equal(LOCALIZED_STAGES[language]?.length, 5, `${language} world names`);
  }
});

test("every language names all 13 plants", () => {
  for (const language of languages) {
    assert.equal(TILE_NAMES[language]?.length, 13, language);
    assert.ok(TILE_NAMES[language].every(name => name.length > 0), language);
  }
});

test("the settings groups are named in every language", () => {
  for (const language of languages) {
    for (const key of ["settingsSound", "settingsView", "settingsGeneral"]) assert.ok(TRANSLATIONS[language][key], `${language} ${key}`);
  }
  assert.equal(TRANSLATIONS.tr.settingsSound, "Ses");
  assert.equal(TRANSLATIONS.tr.settingsView, "Görüntü");
  assert.equal(TRANSLATIONS.tr.settingsGeneral, "Genel");
});

// Short enough for the pixel button on a narrow phone, and what a game in that
// language says: "Nouveau jeu" would read as a new product, not a new round.
test("the new-game button is short and idiomatic in Spanish and French", () => {
  assert.equal(TRANSLATIONS.es.newGame, "Nuevo juego");
  assert.equal(TRANSLATIONS.fr.newGame, "Recommencer");
});

// A new player meets the game in their phone's language, when the game has it.
test("the game picks the device's language when it has it, and English otherwise", async () => {
  const { deviceLanguage } = await import("../src/i18n.js");
  assert.equal(deviceLanguage(["tr-TR"]), "tr");
  assert.equal(deviceLanguage(["de-AT", "en-US"]), "de");
  assert.equal(deviceLanguage(["pt-BR"]), "pt");
  assert.equal(deviceLanguage(["zh-Hans-CN"]), "zh");
  assert.equal(deviceLanguage(["nl-NL", "fr-FR"]), "fr", "the first language the game has");
  assert.equal(deviceLanguage(["nl-NL"]), "en");
  assert.equal(deviceLanguage([]), "en");
  assert.equal(deviceLanguage(undefined), "en");
});

test("the Portuguese settings label is the short one phones use, so it fits the menu", () => {
  assert.equal(TRANSLATIONS.pt.settings, "Ajustes");
});

test("every language can name the way from the end card to the leaderboard", () => {
  for (const [language, text] of Object.entries(TRANSLATIONS)) {
    assert.ok(text.viewLeaderboard && text.viewLeaderboard.length > 2, language);
  }
  assert.equal(TRANSLATIONS.tr.viewLeaderboard, "Sıralamayı gör");
});

test("every language can report a name, thank for it, and explain a hidden name or a ban", () => {
  for (const [language, text] of Object.entries(TRANSLATIONS)) {
    for (const key of ["lbReport", "lbReported", "lbReportFailed", "lbHiddenNote", "submitBanned"]) {
      assert.ok(typeof text[key] === "string" && text[key].trim(), `${language}.${key}`);
    }
  }
  assert.equal(TRANSLATIONS.tr.lbReport, "İsmi bildir");
  assert.equal(TRANSLATIONS.en.lbReport, "Report name");
});
