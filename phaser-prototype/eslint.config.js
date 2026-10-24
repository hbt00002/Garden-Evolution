// What the linter looks for: mistakes a test might not reach (a name that is not
// defined, one that is never used, an unreachable branch). It deliberately does
// not police style; the aim is to catch bugs, not to reformat the code.
import js from "@eslint/js";
import globals from "globals";

const shared = {
  ...js.configs.recommended.rules,
  // Unused names are bugs waiting to happen (a leftover after a refactor);
  // a leading underscore marks one that is intentionally unused.
  "no-unused-vars": ["error", { args: "after-used", argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
  "no-undef": "error",
  "no-shadow": ["error", { builtinGlobals: false, hoist: "functions" }],
  // variables: false still flags a name used earlier in the same scope (a real
  // error) but allows a function that refers to a name declared further down.
  "no-use-before-define": ["error", { functions: false, classes: true, variables: false }],
  "no-constant-condition": ["error", { checkLoops: false }],
  "no-empty": ["error", { allowEmptyCatch: true }],
  eqeqeq: ["error", "always", { null: "ignore" }],
  "prefer-const": "error",
  "no-var": "error"
};

export default [
  { ignores: ["dist/**", "node_modules/**", ".wrangler/**", "playwright-report/**", "test-results/**", "art-source/**", "public/**", "archive/**", "android/**", "ios/**"] },

  // The game in the browser.
  {
    files: ["script.js", "src/**/*.js"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: { ...globals.browser } },
    rules: shared
  },

  // The Phaser scenes were written compactly, so a few rules that would only
  // reformat them are off; the rules that find bugs stay on.
  {
    files: ["src/scenes/**/*.js"],
    rules: { "no-shadow": "off", "no-use-before-define": "off" }
  },

  // Code the Worker runs, and the code it shares with the browser.
  {
    files: ["cloudflare/**/*.js"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: { ...globals.serviceworker } },
    rules: shared
  },

  // Tests and tools run in Node; the browser tests also reach into the page.
  {
    files: ["tests/**/*.js", "e2e/**/*.js", "e2e/**/*.mjs", "tools/**/*.mjs", "vite.config.js", "playwright.config.js", "eslint.config.js"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: { ...globals.node, ...globals.browser } },
    rules: { ...shared, "no-shadow": "off", "no-use-before-define": "off" }
  }
];
