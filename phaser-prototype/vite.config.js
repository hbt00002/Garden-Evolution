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

export default defineConfig({
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
