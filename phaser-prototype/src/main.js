// Entry point. The game is plain DOM and must always start; the Phaser scenery
// is an enhancement. Without WebGL (or if Phaser fails to start) the game
// falls back to the built-in SVG scenery that script.js already contains.

import "./fonts.js";

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

if (webglAvailable) {
  try {
    await import("./engine.js");
  } catch (error) {
    console.error("The Phaser scenery could not start; using the built-in scenery.", error);
    // Only fall back when the world itself never came up. If just the board
    // frame failed, the world is already running and must stay in charge.
    if (!window.gardenEngine) document.getElementById("env")?.removeAttribute("data-phaser-active");
  }
}

await import("../script.js");
