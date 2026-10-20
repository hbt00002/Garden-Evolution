// The combo: the "3×" counter that appears when merges come on consecutive
// moves, the bloom-flow energy it feeds (which the world and the piano react
// to, see bloom-flow.js) and the little pulse on the score and the board.
import { createBloomFlow } from "./bloom-flow.js";

const TICK_MS = 200;
const FLOW_TIERS = [3, 5, 8];

// elements: hud (the counter's box, with the energy bar as its <i>), value (the
// "3×" text), score and board (they pulse on a merge).
// prefs: see preferences.js.
// quiet(): true while the page is hidden or a dialog is open, when the energy
//   should settle rather than keep ticking.
// onMerges(streak, mergeCount): a move merged tiles (the game plays the piano).
// onTier(): the energy crossed 3, 5 or 8 (the world answers with a flourish).
export function createComboHud({ elements, prefs, quiet, onMerges, onTier, flow: bloomFlow = createBloomFlow() }) {
  const { hud: hudEl, value: valueEl, score: scoreEl, board: boardEl } = elements;
  let flow = 0;
  let flowTimer = null;

  // Tell the page (the world listens) how energetic the garden is, 0-8.
  function publishFlow(value) {
    flow = value;
    hudEl.querySelector("i").style.transform = `scaleX(${flow / 8})`;
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
    valueEl.textContent = `${state.streak}×`;
    hudEl.hidden = state.streak < 2;
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
    const strong = mergeCount > 1;
    boardEl.animate([
      { transform: "scale(1)", filter: "saturate(1)" },
      { transform: `scale(${strong ? 1.012 : 1.006})`, filter: `saturate(${strong ? 1.08 : 1})`, offset: strong ? .42 : .48 },
      { transform: "scale(1)", filter: "saturate(1)" }
    ], { duration: strong ? 250 : 220, easing: "ease-out" });
  }

  return { reset, restore, cool, update, pulse };
}
