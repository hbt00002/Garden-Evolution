import { defineConfig } from "vite";

// Ad blockers and privacy extensions match file names against filter lists,
// and a generic word such as "script" in a bundle name is enough for one to
// swallow the game's code (the browser then gets the site's HTML page instead
// of JavaScript and every button is dead). Emit neutral names instead.
const CHUNK_NAMES = {
  script: "game",      // script.js: the game itself
  engine: "scenery",   // src/engine.js: the Phaser backdrop
  phaser: "vendor"     // the Phaser library
};

export const entryFileNames = () => "assets/app-[hash].js";
export const chunkFileNames = chunk => `assets/${CHUNK_NAMES[chunk.name] ?? chunk.name}-[hash].js`;

// The entry only discovers the game and the scenery once it has run, which
// costs a round trip before either download can start. Declare them in the
// page itself instead: the game at normal priority, because it is what the
// visitor is waiting for, and the heavy scenery (Phaser) at low priority so it
// cannot slow the game down. Returns the tags, or [] when nothing applies.
export function preloadTags(bundle) {
  const tags = [];
  for (const chunk of Object.values(bundle ?? {})) {
    if (chunk.type !== "chunk") continue;
    const group = CHUNK_NAMES[chunk.name];
    if (!group) continue;
    const attrs = { rel: "modulepreload", crossorigin: "", href: `/${chunk.fileName}` };
    if (group !== "game") attrs.fetchpriority = "low";
    tags.push({ tag: "link", attrs, injectTo: "head" });
  }
  // Game first, then the scenery chunks, so the order in the page says what matters.
  return tags.sort((a, b) => Number(a.attrs.fetchpriority === "low") - Number(b.attrs.fetchpriority === "low"));
}

const preloadGame = () => ({
  name: "preload-game",
  transformIndexHtml: {
    order: "post",
    handler: (html, context) => preloadTags(context.bundle)
  }
});

export default defineConfig({
  plugins: [preloadGame()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames,
        chunkFileNames,
        manualChunks: {
          phaser: ["phaser"]
        }
      }
    }
  }
});
