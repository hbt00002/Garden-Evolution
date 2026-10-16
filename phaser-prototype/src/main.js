// Entry point. The game is plain DOM and must always start, and start fast; the
// Phaser scenery behind it is an enhancement and by far the heaviest part of
// the page (about 330 KB compressed). So both are requested at once, but the
// game is started first and never waits for the scenery. Without WebGL (or if
// Phaser fails to start) the game falls back to the built-in SVG scenery that
// script.js already contains.

import "./fonts.js";
import { loadErrorCopy } from "./load-error.js";

performance.mark("app-start");

const env = document.getElementById("env");

const webglAvailable = (() => {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    // Release the probe context: browsers allow only a few live WebGL contexts.
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(gl);
  } catch (error) {
    return false;
  }
})();

// Tell the game up front that Phaser will draw the backdrop, so it does not
// build the SVG one it would only throw away.
if (webglAvailable) env.dataset.phaserActive = "";

// Start both downloads now (the browser also preloads them, see vite.config.js).
const gameLoad = import("../script.js");
const sceneryLoad = webglAvailable ? import("./engine.js") : null;
// Handled here so a scenery failure that lands before it is awaited below is
// not reported as an unhandled rejection.
sceneryLoad?.catch(() => {});

try {
  await gameLoad;
  performance.mark("game-ready");
} catch (error) {
  // Without the game's code every button is dead. Say why instead of leaving a
  // silent, frozen page: an ad blocker swallowing a file is the usual reason.
  console.error("The game could not be loaded.", error);
  let stored = null;
  try { stored = localStorage.getItem("gardenEvolutionLanguage"); } catch (e) { /* storage blocked */ }
  const [title, text, label] = loadErrorCopy(stored, navigator.language);
  document.getElementById("loadErrorTitle").textContent = title;
  document.getElementById("loadErrorText").textContent = text;
  const retry = document.getElementById("loadErrorRetry");
  retry.textContent = label;
  retry.addEventListener("click", () => location.reload());
  document.getElementById("loadError").hidden = false;
  retry.focus();
}

if (sceneryLoad) {
  try {
    await sceneryLoad;
    performance.mark("scenery-ready");
  } catch (error) {
    console.error("The Phaser scenery could not start; using the built-in scenery.", error);
    // Only fall back when the world itself never came up. If just the board
    // frame failed, the world is already running and must stay in charge.
    if (!window.gardenEngine) {
      env.removeAttribute("data-phaser-active");
      window.dispatchEvent(new CustomEvent("garden:scenery-failed"));
    }
  }
}
