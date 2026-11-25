// The combo: the "×3" badge that appears when merges come on consecutive
// moves, the bloom-flow energy it feeds (which the world and the piano react
// to, see bloom-flow.js) and the little pulse on the score and the board.
import { createBloomFlow } from "./bloom-flow.js";
import { pixelIcon } from "./pixel-icons.js";

const TICK_MS = 200;
const FLOW_TIERS = [3, 5, 8];

// The badge's flower shows the energy (0-8): a bud, opening from 3, open from
// 5, in full bloom at 8. It closes again by itself as the energy fades.
export function bloomStage(flow) {
  if (flow >= FLOW_TIERS[2]) return "flowerPeak";
  if (flow >= FLOW_TIERS[1]) return "flower";
  if (flow >= FLOW_TIERS[0]) return "budOpen";
  return "bud";
}

// elements: hud (the badge), flower (its flower), value (the "×3" text),
// score and board (they pulse on a merge).
// prefs: see preferences.js.
// quiet(): true while the page is hidden or a dialog is open, when the energy
//   should settle rather than keep ticking.
// onMerges(streak, mergeCount): a move merged tiles (the game plays the piano).
// onTier(): the energy crossed 3, 5 or 8 (the world answers with a flourish).
export function createComboHud({ elements, prefs, quiet, onMerges, onTier, flow: bloomFlow = createBloomFlow() }) {
  const { hud: hudEl, flower: flowerEl, value: valueEl, score: scoreEl, board: boardEl } = elements;
  let flow = 0;
  let stage = null;
  let flowTimer = null;

  // Tell the page (the world listens) how energetic the garden is, 0-8.
  function publishFlow(value) {
    flow = value;
    // Drawn again only when it changes stage: a few times a streak, not on
    // every tick of the energy.
    const next = bloomStage(flow);
    if (next !== stage) {
      stage = next;
      flowerEl.innerHTML = pixelIcon(stage);
    }
    window.dispatchEvent(new CustomEvent("garden:combo", { detail: { combo: flow } }));
  }

  // The energy drops to nothing at once.
  function cool() {
    clearTimeout(flowTimer);
    flowTimer = null;
    bloomFlow.cool();
    publishFlow(0);
  }

  function tick() {
    flowTimer = null;
    const next = bloomFlow.level(performance.now());
    if (next !== flow) publishFlow(next);
    // At most five small updates per second, only while energy remains.
    if (next > 0) flowTimer = setTimeout(tick, TICK_MS);
  }

  // A new game: no streak, no best, no energy.
  function reset() {
    bloomFlow.reset();
    hudEl.hidden = true;
    cool();
  }

  // A restored game keeps its streak and best; the energy starts cold.
  function restore(streak, best) {
    bloomFlow.restore(streak, best);
  }

  // A move was made (mergeCount may be 0, which ends the streak). Returns
  // { streak, best } for the game to keep.
  function update(mergeCount) {
    const previousFlow = bloomFlow.level(performance.now());
    const state = bloomFlow.move(mergeCount, performance.now());
    valueEl.textContent = `×${state.streak}`;
    hudEl.hidden = state.streak < 2;
    // A one-pixel-art hop when the streak grows.
    if (!hudEl.hidden && !prefs.reduceMotion) {
      hudEl.animate([
        { transform: "translateY(0)" }, { transform: "translateY(-3px)", offset: .4 }, { transform: "translateY(0)" }
      ], { duration: 180, easing: "steps(3, end)" });
    }
    publishFlow(state.flow);
    if (mergeCount > 0) onMerges(state.streak, mergeCount);
    if (FLOW_TIERS.some(tier => previousFlow < tier && state.flow >= tier)) onTier();
    if (quiet()) cool();
    else if (flowTimer === null && flow > 0) flowTimer = setTimeout(tick, TICK_MS);
    return { streak: state.streak, best: state.best };
  }

  // A small bounce on the score and the board when tiles merge (stronger for a double merge).
  function pulse(mergeCount) {
    if (prefs.reduceMotion || mergeCount < 1) return;
    scoreEl.getAnimations().forEach(animation => animation.cancel());
    boardEl.getAnimations().forEach(animation => animation.cancel());
    scoreEl.animate([
      { transform: "scale(1)" }, { transform: "scale(1.28)", offset: .45 }, { transform: "scale(1)" }
    ], { duration: 240, easing: "cubic-bezier(.2,1.7,.35,1)" });
    // Size only: an animated filter repaints the whole board every frame, which
    // a mid-range phone (Galaxy M31) could not keep up with while tiles slid.
    const strong = mergeCount > 1;
    boardEl.animate([
      { transform: "scale(1)" },
      { transform: `scale(${strong ? 1.012 : 1.006})`, offset: strong ? .42 : .48 },
      { transform: "scale(1)" }
    ], { duration: strong ? 250 : 220, easing: "ease-out" });
  }

  return { reset, restore, cool, update, pulse };
}
