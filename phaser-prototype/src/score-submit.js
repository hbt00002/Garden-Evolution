// Saving a finished run to the leaderboard: the name form on the end card and
// the "this is lower than your current score" confirmation. The server replays
// the recorded moves and accepts the score only if the finished game matches,
// so what is sent is the record of the run, not just a number.
import { LOWER_SCORE_COPY } from "./i18n.js";
import { leaderboardRequest } from "./leaderboard-api.js";
import { stageFor } from "./levels.js";
import { loadDeviceId, savePlayerName } from "./storage.js";
import { cleanName } from "./player-name.js";

// elements: the end card's form and the confirmation dialog.
// getRun(): { ranked, session, score, maxValueReached, bestCombo, moves } for the run on screen.
// onSaved(data): called once a score is accepted (the game shows the leaderboard);
// data.daily is set when it joined today's garden.
// onFailed(reason, final): a send did not go through; final when trying again
// cannot help (today's garden already sent, a banned device).
export function createScoreSubmit({ elements, text: getText, language, getRun, syncInert, onSaved, onFailed = () => {} }) {
  const {
    form: scoreFormEl, playerName: playerNameEl, submitBtn: submitScoreBtn, status: scoreSubmitStatusEl,
    confirm: lowerScoreConfirmEl, confirmTitle: lowerScoreTitleEl, confirmMessage: lowerScoreMessageEl,
    cancel: cancelLowerScoreBtn, accept: confirmLowerScoreBtn
  } = elements;
  let scoreSubmitted = false;

  function confirmLowerScore(currentScore, newScore) {
    const copy = LOWER_SCORE_COPY[language()] || LOWER_SCORE_COPY.en;
    lowerScoreTitleEl.textContent = copy[0];
    lowerScoreMessageEl.textContent = copy[1]
      .replace("{newScore}", Number(newScore).toLocaleString(language()))
      .replace("{currentScore}", Number(currentScore).toLocaleString(language()));
    cancelLowerScoreBtn.textContent = copy[2];
    confirmLowerScoreBtn.textContent = copy[3];
    lowerScoreConfirmEl.hidden = false;
    syncInert();
    document.body.classList.add("score-confirm-open");
    window.dispatchEvent(new CustomEvent("garden:score-confirm", { detail: { open: true } }));
    confirmLowerScoreBtn.focus();
    return new Promise(resolve => {
      const finish = accepted => {
        lowerScoreConfirmEl.hidden = true;
        syncInert();
        document.body.classList.remove("score-confirm-open");
        window.dispatchEvent(new CustomEvent("garden:score-confirm", { detail: { open: false } }));
        cancelLowerScoreBtn.removeEventListener("click", cancel);
        confirmLowerScoreBtn.removeEventListener("click", confirm);
        lowerScoreConfirmEl.removeEventListener("click", backdrop);
        document.removeEventListener("keydown", escape);
        resolve(accepted);
      };
      const cancel = () => finish(false);
      const confirm = () => finish(true);
      const backdrop = event => { if (event.target === lowerScoreConfirmEl) cancel(); };
      const escape = event => { if (event.key === "Escape") cancel(); };
      cancelLowerScoreBtn.addEventListener("click", cancel);
      confirmLowerScoreBtn.addEventListener("click", confirm);
      lowerScoreConfirmEl.addEventListener("click", backdrop);
      document.addEventListener("keydown", escape);
    });
  }

  async function submitScore(event) {
    event.preventDefault();
    if (scoreSubmitted) return;
    const playerName = cleanName(playerNameEl.value);
    const text = getText();
    if (playerName.length < 2) {
      scoreSubmitStatusEl.textContent = text.nameTooShort;
      playerNameEl.focus();
      return;
    }
    submitScoreBtn.disabled = true;
    submitScoreBtn.textContent = text.sending;
    scoreSubmitStatusEl.textContent = "";
    try {
      // The record is verified against the session's seed, so only the
      // session this run was dealt from can be presented.
      const run = getRun();
      if (!run.ranked) throw new Error(text.sessionError);
      const session = run.session;
      const deviceId = loadDeviceId();
      // Without storage there is no device id, and the server needs one.
      if (!deviceId) throw new Error("device_required");
      const payload = {
          playerName,
          score: run.score,
          maxTile: Math.max(2, run.maxValueReached),
          bestCombo: run.bestCombo,
          comboRules: 2,
          reachedStage: stageFor(Math.max(2, run.maxValueReached)),
          moves: run.moves,
          deviceId,
          session
      };
      const send = replaceLowerScore => leaderboardRequest({
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ ...payload, replaceLowerScore })
        });
      let response = await send(false);
      let data = await response.json().catch(() => ({}));
      if (response.status === 409 && data.code === "lower_score_confirmation_required") {
        const accepted = await confirmLowerScore(data.currentScore, run.score);
        if (!accepted) {
          submitScoreBtn.disabled = false;
          submitScoreBtn.textContent = getText().submit;
          scoreSubmitStatusEl.textContent = "";
          return;
        }
        response = await send(true);
        data = await response.json().catch(() => ({}));
      }
      if (data.code === "name_not_allowed") throw new Error("name_not_allowed");
      if (data.code === "device_required") throw new Error("device_required");
      if (data.code === "daily_already_played") throw new Error("daily_already_played");
      if (response.status === 403 && data.code === "banned") throw new Error("banned");
      if (response.status === 429) throw new Error("score_rate_limited");
      if (!response.ok) throw new Error("score_submit_failed");
      scoreSubmitted = true;
      // Show the all-time board with the player's new rank.
      onSaved(data);
      savePlayerName(data.playerName || playerName);
      playerNameEl.value = "";
      scoreFormEl.classList.add("success");
      scoreSubmitStatusEl.textContent = text.submitSuccess;
    } catch (error) {
      // Today's garden already has this device's score, or this device may not
      // send scores: sending again cannot help.
      const final = error.message === "daily_already_played" || error.message === "banned";
      onFailed(error.message, final);
      submitScoreBtn.disabled = final;
      submitScoreBtn.textContent = text.submit;
      if (error.message === "name_not_allowed") playerNameEl.focus();
      scoreSubmitStatusEl.textContent = error.message === "banned" ? text.submitBanned
        : final ? text.dailyAlreadyPlayed
        : error.message === "name_not_allowed" ? text.nameNotAllowed
        : error.message === "device_required" ? text.submitNeedsStorage
        : error.message === "score_rate_limited" ? text.submitRateLimited
        : error.message === "score_submit_failed" ? text.submitError
        : (error.message || text.submitError);
    }
  }

  scoreFormEl.addEventListener("submit", submitScore);

  return {
    // A new run may be saved again.
    reset() { scoreSubmitted = false; }
  };
}
