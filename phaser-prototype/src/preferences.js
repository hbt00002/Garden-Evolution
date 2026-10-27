// The player's visual preferences and whether their system asks for less
// movement. Remembered in the browser (storage.js); read through getters so the
// rest of the game always sees the current value.
import { loadPref, savePref } from "./storage.js";

const KEYS = {
  motion: "gardenEvolutionMotion",
  particles: "gardenEvolutionParticles",
  contrast: "gardenEvolutionContrast",
  reveal: "gardenEvolutionReveal",
  haptics: "gardenEvolutionHaptics"
};

export function createPreferences({ matchMedia = query => window.matchMedia(query) } = {}) {
  let motionOn = loadPref(KEYS.motion, true);
  let particlesOn = loadPref(KEYS.particles, true);
  let contrastOn = loadPref(KEYS.contrast, false);
  // Off unless the player turns it on in Settings: a world arriving should not interrupt play.
  let revealOn = loadPref(KEYS.reveal, false);
  // Vibration in the store apps (there is no switch on the website).
  let hapticsOn = loadPref(KEYS.haptics, true);

  // The system-wide "reduce motion" setting follows the device, live.
  const query = matchMedia("(prefers-reduced-motion: reduce)");
  let reduceMotion = query.matches;
  query.addEventListener?.("change", event => { reduceMotion = event.matches; });

  const state = { motion: () => motionOn, particles: () => particlesOn, contrast: () => contrastOn, reveal: () => revealOn, haptics: () => hapticsOn };

  return {
    get motionOn() { return motionOn; },
    get particlesOn() { return particlesOn; },
    get contrastOn() { return contrastOn; },
    get revealOn() { return revealOn; },
    get hapticsOn() { return hapticsOn; },
    get reduceMotion() { return reduceMotion; },
    // True when little should move: the system asks for it or the player turned motion off.
    get calm() { return reduceMotion || !motionOn; },
    // Flips one preference ("motion", "particles", "contrast", "reveal" or "haptics"), remembers it, and returns the new value.
    toggle(name) {
      if (!Object.hasOwn(KEYS, name)) throw new Error(`Unknown preference: ${name}`);
      const next = !state[name]();
      if (name === "motion") motionOn = next;
      else if (name === "particles") particlesOn = next;
      else if (name === "contrast") contrastOn = next;
      else if (name === "haptics") hapticsOn = next;
      else revealOn = next;
      savePref(KEYS[name], next);
      return next;
    }
  };
}
