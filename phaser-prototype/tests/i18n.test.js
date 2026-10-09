import test from "node:test";
import assert from "node:assert/strict";
import { LOCALIZED_STAGES, LOWER_SCORE_COPY, PLAY_LABELS, TRANSLATIONS } from "../src/i18n.js";

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
