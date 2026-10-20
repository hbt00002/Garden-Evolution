// The card that ends a run: "no more moves", the 2048 milestone (play on) and
// the 8192 victory. It shows the score, the best, the world reached and the
// top plant, offers the name form when the run can be ranked, and moves focus to
// the right button once its entrance has settled.
import { stageFor, stageMeta } from "./levels.js";
import { loadPlayerName } from "./storage.js";

// elements: the card and its parts (see script.js).
// text() / language(): the current language's strings and code.
// snapshot(): { score, best, maxValueReached, bestCombo, ranked, currentStage } for the run on screen.
// onShow(): called as the card opens (the game cools its combo).
// playGameOver(): the sound for a finished run.
export function createEndCard({ elements, prefs, text: getText, language, snapshot, onShow, playGameOver }) {
  const {
    overlay: overlayEl, finalScore: finalScoreEl, finalBest: finalBestEl, finalTitle: finalTitleEl,
    finalExplanation: finalExplanationEl, scoreForm: scoreFormEl, playerName: playerNameEl,
    submitBtn: submitScoreBtn, status: scoreSubmitStatusEl, continueBtn: continueMilestoneBtn,
    playAgainBtn, finalWorld: finalWorldEl, finalTile: finalTileEl, finalCombo: finalComboEl,
    finalEmblem: finalEmblemEl, unrankedNote: unrankedNoteEl, milestoneArt: milestoneArtEl, victoryArt: victoryArtEl
  } = elements;
  const finalScoreLabelEl = finalScoreEl.previousElementSibling;
  const scoreFormLabelEl = scoreFormEl.querySelector("label");
  let readyTimer = null;

  function localize() {
    const text = getText();
    overlayEl.querySelectorAll("[data-i18n]").forEach(el => {
      const value = text[el.dataset.i18n];
      if (value) el.textContent = value;
    });
    playerNameEl.placeholder = text.yourName;
    if (snapshot().currentStage) {
      const overlayStage = overlayEl.hidden ? snapshot().currentStage : stageFor(Math.max(2, snapshot().maxValueReached));
      const mode = overlayEl.dataset.mode;
      finalWorldEl.textContent = !overlayEl.hidden && mode === "milestone"
        ? text.milestoneKicker
        : !overlayEl.hidden && mode === "victory"
          ? text.victoryKicker
          : stageMeta(overlayStage, language()).name;
    }
  }
  function emitEndingParticles(artEl) {
    artEl.querySelectorAll(".milestone-mote").forEach(node => node.remove());
    if (prefs.reduceMotion || !prefs.particlesOn) return;
    const kinds = ["leaf", "spark", "firefly"];
    for (let index = 0; index < 18; index++) {
      const mote = document.createElement("i");
      const angle = (Math.PI * 2 * index) / 18 + Math.random() * .22;
      const distance = 58 + Math.random() * 42;
      mote.className = `milestone-mote milestone-mote--${kinds[index % kinds.length]}`;
      mote.style.setProperty("--mote-x", `${Math.cos(angle) * distance}px`);
      mote.style.setProperty("--mote-y", `${Math.sin(angle) * distance - 14}px`);
      mote.style.setProperty("--mote-delay", `${(index % 6) * 34}ms`);
      mote.style.setProperty("--mote-spin", `${90 + Math.random() * 240}deg`);
      artEl.appendChild(mote);
      mote.addEventListener("animationend", () => mote.remove(), { once:true });
    }
  }

  function show(mode) {
    onShow();
    const text = getText();
    const run = snapshot();
    const milestone = mode === "milestone";
    finalTitleEl.dataset.i18n = milestone ? "milestoneTitle" : mode === "victory" ? "victoryTitle" : "noMoves";
    finalExplanationEl.dataset.i18n = milestone ? "milestoneText" : mode === "victory" ? "victoryText" : "noMovesText";
    scoreFormLabelEl.dataset.i18n = mode === "victory" ? "saveFinalScore" : "joinLeaderboard";
    finalScoreLabelEl.dataset.i18n = milestone ? "currentScore" : "final";
    overlayEl.dataset.mode = mode;
    localize();
    const endingStage = stageFor(Math.max(2, run.maxValueReached));
    finalScoreEl.textContent = Number(run.score).toLocaleString(language());
    finalBestEl.textContent = Number(run.best).toLocaleString(language());
    finalWorldEl.textContent = milestone ? text.milestoneKicker : mode === "victory" ? text.victoryKicker : stageMeta(endingStage, language()).name;
    finalTileEl.textContent = Number(run.maxValueReached || 2).toLocaleString(language());
    finalComboEl.textContent = `${run.bestCombo || 0}×`;
    finalEmblemEl.textContent = stageMeta(endingStage, language()).emblem;
    playerNameEl.value = loadPlayerName();
    const ranked = run.ranked;
    scoreFormEl.hidden = milestone || !ranked;
    unrankedNoteEl.hidden = milestone || ranked;
    scoreFormEl.classList.remove("success");
    scoreSubmitStatusEl.textContent = "";
    submitScoreBtn.disabled = false;
    submitScoreBtn.textContent = text.submit;
    continueMilestoneBtn.hidden = !milestone;
    playAgainBtn.hidden = milestone;
    overlayEl.dataset.stage = endingStage;
    overlayEl.hidden = false;
    overlayEl.classList.remove("ready");
    requestAnimationFrame(() => {
      overlayEl.classList.add("show");
      if (milestone) emitEndingParticles(milestoneArtEl);
      else if (mode === "victory") emitEndingParticles(victoryArtEl);
    });
    clearTimeout(readyTimer);
    readyTimer = setTimeout(() => {
      overlayEl.classList.add("ready");
      (milestone ? continueMilestoneBtn : ranked ? playerNameEl : playAgainBtn).focus();
    }, milestone ? 350 : 850);
    if (!milestone) playGameOver();
  }
  function hide() {
    clearTimeout(readyTimer);
    overlayEl.classList.remove("ready");
    overlayEl.classList.remove("show");
    overlayEl.hidden = true;
  }

  return {
    show,
    hide,
    // Re-translate the card (the language changed while it is open or closed).
    localize,
    element: overlayEl
  };
}
