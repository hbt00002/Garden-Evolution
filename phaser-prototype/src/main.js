import Phaser from "phaser";
import { WinterMountainScene } from "./scenes/WinterMountainScene.js";
import { SnowmeltValleyScene } from "./scenes/SnowmeltValleyScene.js";
import { SpringBloomScene } from "./scenes/SpringBloomScene.js";
import { SakuraGardenScene } from "./scenes/SakuraGardenScene.js";
import { MoonlitFinaleScene } from "./scenes/MoonlitFinaleScene.js";
import { LivingBoardScene } from "./scenes/LivingBoardScene.js";

const mount = document.getElementById("phaserWorld");
const env = document.getElementById("env");
const lowPowerDevice = Boolean(
  (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
  (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
);

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: mount,
  transparent: true,
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight
  },
  render: {
    powerPreference: "high-performance",
    antialias: false,
    pixelArt: true
  },
  fps: { target: lowPowerDevice ? 30 : 60, forceSetTimeOut: lowPowerDevice },
  scene: [WinterMountainScene, SnowmeltValleyScene, SpringBloomScene, SakuraGardenScene, MoonlitFinaleScene]
});

// Phaser's RESIZE mode can miss viewport width changes caused by browser
// sidebars, zoom/UI changes or mobile visualViewport updates. Keep the world
// render surface explicitly synchronized so no uncovered strip remains.
let environmentResizeFrame = 0;
const syncEnvironmentViewport = () => {
  cancelAnimationFrame(environmentResizeFrame);
  environmentResizeFrame = requestAnimationFrame(() => {
    // Keep CSS in charge of the host box and resize Phaser to the layout
    // viewport. visualViewport is intentionally not used for dimensions: at
    // browser/pinch zoom it can be substantially narrower than 100vw and an
    // inline width based on it leaves a black strip on the right.
    mount.style.removeProperty("width");
    mount.style.removeProperty("height");
    const bounds = mount.getBoundingClientRect();
    const width = Math.ceil(Math.max(bounds.width, window.innerWidth, document.documentElement.clientWidth));
    const height = Math.ceil(Math.max(bounds.height, window.innerHeight, document.documentElement.clientHeight));
    if (game.scale.width !== width || game.scale.height !== height) game.scale.resize(width, height);
    game.scene.getScenes(true).forEach(scene => scene.fitWorld?.());
  });
};
window.addEventListener("resize", syncEnvironmentViewport, { passive: true });
window.visualViewport?.addEventListener("resize", syncEnvironmentViewport, { passive: true });
new ResizeObserver(syncEnvironmentViewport).observe(document.documentElement);

window.gardenEngine = game;
game.registry.set("lowPower", lowPowerDevice);
env.dataset.phaserActive = "";

const boardMount = document.getElementById("boardEngine");
const boardGame = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: boardMount,
  transparent: true,
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  scale: { mode: Phaser.Scale.RESIZE, width: boardMount.clientWidth || 480, height: boardMount.clientHeight || 480 },
  render: { powerPreference: "high-performance", antialias: false, pixelArt: true },
  scene: [LivingBoardScene]
});
window.gardenBoardEngine = boardGame;
boardGame.registry.set("lowPower", lowPowerDevice);
env.dataset.boardEngine = "";

let motionAllowed = true;
const applyEnginePreferences = ({ motionOn = true, particlesOn = true } = {}) => {
  motionAllowed = motionOn;
  game.scene.getScenes(false).forEach(scene => scene.setExtraParticles?.(particlesOn));
  boardGame.scene.getScene("LivingBoardScene")?.setExtraParticles?.(particlesOn);

  // Sleeping Phaser's loops freezes the current rendered frame, so disabling
  // motion does not blank either canvas and can be resumed instantly.
  if (motionOn && !document.hidden) {
    game.loop.wake();
    boardGame.loop.wake();
  } else {
    game.loop.sleep();
    boardGame.loop.sleep();
  }
};
window.addEventListener("garden:preferences", event => applyEnginePreferences(event.detail));

window.addEventListener("garden:score-confirm", event => {
  if (event.detail?.open) {
    game.loop.sleep();
    boardGame.loop.sleep();
  } else if (!document.hidden && motionAllowed) {
    game.loop.wake();
    boardGame.loop.wake();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden || !motionAllowed) {
    game.loop.sleep();
    boardGame.loop.sleep();
  } else {
    game.loop.wake();
    boardGame.loop.wake();
  }
});

const SCENE_TEXTURES = {
  WinterMountainScene: ["mountain-ridge-v2", "snow-tile", "spruce-large", "spruce-medium", "spruce-small", "shrub-a", "shrub-b", "rock-large", "rock-medium", "snow-dot"],
  SnowmeltValleyScene: ["s2v3-mountains", "s2v3-meadow", "s2v3-acacia", "s2v3-hornbeam", "s2v3-cottage", "s2v3-frog", "s2v3-mote"],
  SpringBloomScene: ["s3-hills", "s3-terrain", "s3-tree", "s3-turtle", "s3-bird", "s3-flying-bird", "s3-hive", "s3-nest", "s3-bee", "s3-terrain-horizon-mask"],
  SakuraGardenScene: ["s4-mountains", "s4-valley", "s4-tree", "s4-mid-tree", "s4-petal-pile", "s4-valley-mask", "s4-mid-tree-pixel", "s4-petal-pile-pixel", "s4-petal"],
  MoonlitFinaleScene: ["s5-garden", "s5-moon-branch", "s5-moon-reeds", "s5-moon-moth", "s5-lantern-glow", "s5-water-glow", "s5-firefly", "s5-night-petal"]
};
const SCENE_KEYS = Object.keys(SCENE_TEXTURES);
const sceneKeyForStage = stage => stage === 1 ? "WinterMountainScene" : stage === 2 ? "SnowmeltValleyScene" : stage === 3 ? "SpringBloomScene" : stage === 4 ? "SakuraGardenScene" : stage === 5 ? "MoonlitFinaleScene" : null;
const stageForSceneKey = key => SCENE_KEYS.indexOf(key) + 1;
const warmedWorlds = new Set();
const pendingWorldWarms = new Set();
const pendingSceneStarts = new Set();
const pendingSceneDisposals = new Map();
const cancelSceneDisposal = key => {
  const timer = pendingSceneDisposals.get(key);
  if (timer) clearTimeout(timer);
  pendingSceneDisposals.delete(key);
};
const warmWorldScene = stage => {
  const sceneKey = sceneKeyForStage(stage);
  if (!sceneKey || warmedWorlds.has(stage) || pendingWorldWarms.has(stage) || pendingSceneStarts.has(sceneKey) || game.scene.isActive(sceneKey) || game.scene.isSleeping(sceneKey)) return;
  pendingWorldWarms.add(stage);
  const prepare = () => {
    if (Number(env.dataset.stage || 1) >= stage || pendingSceneStarts.has(sceneKey) || game.scene.isActive(sceneKey) || game.scene.isSleeping(sceneKey)) {
      pendingWorldWarms.delete(stage);
      return;
    }
    const target = game.scene.getScene(sceneKey);
    if (!target) {
      pendingWorldWarms.delete(stage);
      return;
    }
    target.events.once(Phaser.Scenes.Events.CREATE, () => {
      pendingSceneStarts.delete(sceneKey);
      const createdScene = game.scene.getScene(sceneKey);
      if (!createdScene?.cameras?.main) {
        warmedWorlds.delete(stage);
        requestAnimationFrame(syncScene);
        return;
      }
      // The player may reach this world while its hidden warm-up is still
      // finishing. Never hide/sleep a scene that has become the active world.
      if (Number(env.dataset.stage || 1) >= stage) {
        createdScene.cameras.main.setVisible(true);
        releaseOtherScenes(sceneKey);
        requestAnimationFrame(syncScene);
        return;
      }
      // Render one practically transparent frame before sleeping. That first
      // draw uploads decoded textures to WebGL now instead of on transition.
      createdScene.cameras.main.setAlpha(.001).setVisible(true);
      game.events.once(Phaser.Core.Events.POST_RENDER, () => {
        if (!createdScene.cameras?.main) return;
        if (Number(env.dataset.stage || 1) >= stage) {
          createdScene.cameras.main.setAlpha(1).setVisible(true);
          releaseOtherScenes(sceneKey);
          return;
        }
        // Restore full opacity only after the warm scene is no longer
        // renderable. Setting alpha to 1 while visible exposed one complete
        // frame of the next world on some devices.
        createdScene.cameras.main.setVisible(false);
        createdScene.scene.sleep();
        createdScene.cameras.main.setAlpha(1);
      });
    });
    // SceneManager does not expose ScenePlugin.launch(). Starting through the
    // manager keeps the current world alive while the next one renders its
    // hidden warm-up frame.
    pendingWorldWarms.delete(stage);
    warmedWorlds.add(stage);
    pendingSceneStarts.add(sceneKey);
    target.events.once(Phaser.Scenes.Events.SHUTDOWN, () => pendingSceneStarts.delete(sceneKey));
    try {
      game.scene.start(sceneKey);
    } catch (error) {
      pendingSceneStarts.delete(sceneKey);
      throw error;
    }
  };
  if ("requestIdleCallback" in window) requestIdleCallback(prepare, { timeout: 1600 });
  else setTimeout(prepare, 700);
};
window.addEventListener("garden:game-started", () => warmWorldScene(2), { once: true });

const releaseOtherScenes = activeKey => {
  SCENE_KEYS.forEach(key => {
    if (key === activeKey || (!game.scene.isActive(key) && !game.scene.isSleeping(key) && !game.scene.isPaused(key))) return;
    const keyStage = stageForSceneKey(key);
    const activeStage = Number(env.dataset.stage || 1);
    // A prepared next world is deliberately sleeping; do not dispose it when
    // a late viewport/boot synchronization reaffirms the current world.
    if (game.scene.isSleeping(key) && warmedWorlds.has(keyStage) && keyStage > activeStage) return;
    game.scene.getScene(key)?.cameras?.main?.setVisible(false);
    if (pendingSceneDisposals.has(key)) return;
    // Hide immediately, dispose after the visual swap. Deleting the old GPU
    // textures on the same frame as the new world's first frame caused a spike.
    const timer = setTimeout(() => {
      pendingSceneDisposals.delete(key);
      const currentKey = sceneKeyForStage(Number(env.dataset.stage || 1));
      if (currentKey === key) {
        game.scene.getScene(key)?.cameras?.main?.setVisible(true);
        return;
      }
      const dispose = () => {
        if (sceneKeyForStage(Number(env.dataset.stage || 1)) === key) return;
        pendingSceneStarts.delete(key);
        game.scene.stop(key);
        SCENE_TEXTURES[key].forEach(textureKey => {
          if (game.textures.exists(textureKey)) game.textures.remove(textureKey);
        });
        warmedWorlds.delete(keyStage);
        pendingWorldWarms.delete(keyStage);
      };
      if ("requestIdleCallback" in window) requestIdleCallback(dispose, { timeout: 3000 });
      else setTimeout(dispose, 80);
    }, 1200);
    pendingSceneDisposals.set(key, timer);
  });
};

const syncScene = () => {
  const stage = Number(env.dataset.stage || 1);
  const sceneKey = sceneKeyForStage(stage);
  mount.hidden = !sceneKey;
  env.toggleAttribute("data-phaser-active", Boolean(sceneKey));
  const targetScene = game.scene.getScene(sceneKey);
  // The local ?stage=N art-review helper can update the DOM a frame before
  // Phaser has registered every configured scene. Retry after registration
  // instead of dereferencing a temporary null scene and leaving all scenes
  // stacked in their startup order.
  if (!targetScene) {
    requestAnimationFrame(syncScene);
    return;
  }
  cancelSceneDisposal(sceneKey);
  if (game.scene.isSleeping(sceneKey) || game.scene.isPaused(sceneKey)) {
    targetScene.cameras?.main?.setVisible(true);
    game.scene.wake(sceneKey);
    releaseOtherScenes(sceneKey);
  } else if (!game.scene.isActive(sceneKey)) {
    if (pendingSceneStarts.has(sceneKey)) return;
    // A previously warmed/stopped scene can retain its hidden camera flag.
    // Restore visibility before starting; CREATE is not guaranteed on every
    // restart path in the same order as the warm-up callback.
    targetScene.cameras?.main?.setVisible(true);
    targetScene.events.once(Phaser.Scenes.Events.CREATE, () => {
      pendingSceneStarts.delete(sceneKey);
      const createdScene = game.scene.getScene(sceneKey);
      if (!createdScene?.cameras?.main) {
        requestAnimationFrame(syncScene);
        return;
      }
      createdScene.cameras.main.setVisible(true);
      releaseOtherScenes(sceneKey);
    });
    pendingSceneStarts.add(sceneKey);
    targetScene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => pendingSceneStarts.delete(sceneKey));
    try {
      game.scene.start(sceneKey);
    } catch (error) {
      pendingSceneStarts.delete(sceneKey);
      throw error;
    }
  } else {
    if (!targetScene.cameras?.main) {
      requestAnimationFrame(syncScene);
      return;
    }
    targetScene.cameras.main.setVisible(true);
    releaseOtherScenes(sceneKey);
  }
  // A scene may be created for the first time during the stage switch. Apply
  // the saved particle preference again after its create() lifecycle runs.
  setTimeout(() => game.scene.getScene(sceneKey)?.setExtraParticles?.(
    !document.body.classList.contains("particles-off")
  ), 0);
  // Prepare only the next world, incrementally during idle time. This avoids
  // decoding several large PNGs on the exact frame the stage changes.
  if (stage > 1) setTimeout(() => warmWorldScene(stage + 1), 1400);
};
const observer = new MutationObserver(syncScene);
observer.observe(env, { attributes: true, attributeFilter: ["data-stage"] });
const syncBoardStage = () => boardGame.scene.getScene("LivingBoardScene")?.setStage(Number(env.dataset.stage || 1));
const boardObserver = new MutationObserver(syncBoardStage);
boardObserver.observe(env, { attributes: true, attributeFilter: ["data-stage"] });

window.addEventListener("garden:combo", (event) => {
  const stage = Number(env.dataset.stage || 1);
  const key = stage === 5 ? "MoonlitFinaleScene" : stage === 4 ? "SakuraGardenScene" : stage === 3 ? "SpringBloomScene" : stage === 2 ? "SnowmeltValleyScene" : "WinterMountainScene";
  game.scene.getScene(key)?.setHype(event.detail?.combo || 0);
});

await import("../script.js");
// The initial URL-selected stage can be set before Phaser finishes booting.
// Synchronize once more after both systems are ready instead of waiting for a
// later stage mutation.
game.events.once("ready", syncScene);
requestAnimationFrame(syncScene);
setTimeout(syncScene, 500);
setTimeout(syncEnvironmentViewport, 0);
setTimeout(syncEnvironmentViewport, 500);
setTimeout(syncBoardStage, 120);
setTimeout(() => applyEnginePreferences({
  motionOn: !document.body.classList.contains("motion-off"),
  particlesOn: !document.body.classList.contains("particles-off")
}), 180);
