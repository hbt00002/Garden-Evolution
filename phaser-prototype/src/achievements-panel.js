// The achievements dialog: how many are unlocked, the player's stats, and every
// achievement with its description and progress. It draws from
// achievements.js; the game gives it the dialog's elements, the language and a
// few hooks, and calls open().
import { focusTitle } from "./focus-trap.js";
import { artValueFor, plantName, stageMeta } from "./levels.js";
import { pixelIcon } from "./pixel-icons.js";
import { tileArtUrl } from "./tile-art.js";
import { dayKey } from "./daily.js";

// elements: { modal, closeBtn, summary, stats, list }
// text() / language(): the current language's strings and code.
// onOpen(): the game cools its combo; returnTarget(): the button that gets
// focus back; syncInert(): makes the game behind the dialog unreachable.
export function createAchievementsPanel({ achievements, elements, text: getText, language, onOpen, returnTarget, syncInert }) {
  const { modal, closeBtn, title, summary, stats: statsEl, list: listEl } = elements;
  let opener = null;

  const number = value => Number(value).toLocaleString(language());

  // "Reach Spring Bloom", "Score 10,000 points in one game"…
  function describe(achievement) {
    const text = getText();
    switch (achievement.kind) {
      case "world": return text.achWorld.replace("{world}", stageMeta(achievement.stage, language()).name);
      case "plant": return text.achPlant.replace("{plant}", plantName(achievement.target, language()));
      case "combo": return text.achCombo.replace("{n}", achievement.target);
      case "score": return text.achScore.replace("{n}", number(achievement.target));
      case "games": return text.achGames.replace("{n}", number(achievement.target));
      case "streak": return text.achStreak.replace("{n}", achievement.target);
      case "daily": return text.achDaily;
      case "share": return text.achShare;
      case "view": return text.achView;
      default: return text.achFirstGame;
    }
  }

  function renderStats() {
    const text = getText();
    const stats = achievements.stats;
    const rows = [
      [text.statGames, number(stats.gamesFinished)],
      [text.statBestScore, number(stats.bestScore)],
      [text.statBestPlant, stats.bestTile ? plantName(stats.bestTile, language()) : "—"],
      [text.statBestCombo, stats.bestCombo ? `${stats.bestCombo}×` : "—"],
      [text.statDailies, number(stats.dailiesPlayed)],
      [text.statStreak, `${achievements.currentStreak(dayKey())} / ${stats.bestDailyStreak}`]
    ];
    statsEl.replaceChildren(...rows.map(([label, value]) => {
      const item = document.createElement("div");
      const term = document.createElement("dt");
      term.textContent = label;
      const detail = document.createElement("dd");
      detail.textContent = value;
      item.append(term, detail);
      return item;
    }));
  }

  function renderList() {
    const text = getText();
    const all = achievements.list();
    const done = all.filter(a => a.unlocked).length;
    summary.textContent = text.achSummary.replace("{done}", done).replace("{total}", all.length);
    listEl.replaceChildren(...all.map(achievement => {
      const item = document.createElement("li");
      item.className = "ach-item" + (achievement.unlocked ? " unlocked" : "");
      item.dataset.id = achievement.id;
      const icon = document.createElement("span");
      icon.className = "ach-icon";
      icon.setAttribute("aria-hidden", "true");
      // A plant's own picture, or one of the game's pixel icons.
      if (typeof achievement.icon === "number") {
        const img = document.createElement("img");
        img.src = tileArtUrl(artValueFor(achievement.icon).assetValue);
        img.alt = "";
        img.decoding = "async";
        img.draggable = false;
        icon.appendChild(img);
      } else {
        icon.innerHTML = pixelIcon(achievement.icon);
      }
      const body = document.createElement("div");
      body.className = "ach-body";
      const name = document.createElement("strong");
      name.textContent = text[`ach_${achievement.id}`];
      const detail = document.createElement("small");
      detail.textContent = describe(achievement);
      body.append(name, detail);
      if (achievement.counted && !achievement.unlocked && achievement.value > 0) {
        const bar = document.createElement("span");
        bar.className = "ach-progress";
        bar.setAttribute("aria-hidden", "true");
        const fill = document.createElement("i");
        fill.style.width = `${(achievement.value / achievement.target) * 100}%`;
        bar.appendChild(fill);
        const count = document.createElement("small");
        count.className = "ach-count";
        count.textContent = `${achievement.value} / ${achievement.target}`;
        body.append(bar, count);
      }
      const mark = document.createElement("span");
      mark.className = "ach-mark";
      mark.textContent = achievement.unlocked ? "✓" : "";
      mark.setAttribute("aria-hidden", "true");
      // Screen readers hear whether it is done, not a tick.
      item.setAttribute("aria-label", `${name.textContent}. ${detail.textContent}.${achievement.unlocked ? " ✓" : ""}`);
      item.append(icon, body, mark);
      return item;
    }));
  }

  // The list shows the language and where each achievement stands; it is drawn
  // again only when one of those has changed. Rebuilding it on every open made
  // the window slow to appear on a phone.
  let drawnKey = null;
  let pending = 0;
  const listKey = () => `${language()}|${achievements.list().map(a => `${a.unlocked ? 1 : 0}${a.value}`).join(",")}`;

  function renderListIfStale() {
    const key = listKey();
    if (key === drawnKey) return;
    renderList();
    drawnKey = key;
  }

  function render() {
    renderStats();
    renderListIfStale();
  }

  // Draws a stale list in the phone's spare time, while the window is closed
  // (the game calls this when the way to the window, the settings, opens).
  const whenIdle = window.requestIdleCallback
    ? fn => window.requestIdleCallback(fn, { timeout: 500 })
    : fn => setTimeout(fn, 50);
  function prepare() {
    if (pending || !modal.hidden || listKey() === drawnKey) return;
    pending = whenIdle(() => { pending = 0; if (modal.hidden) renderListIfStale(); });
  }

  function open(event) {
    opener = event?.currentTarget || null;
    onOpen();
    render();
    modal.hidden = false;
    syncInert();
    document.body.style.overflow = "hidden";
    // The title, not a button: see focusTitle in focus-trap.js.
    requestAnimationFrame(() => focusTitle(title));
  }

  function close() {
    modal.hidden = true;
    document.body.style.overflow = "";
    syncInert();
    (opener && opener.getClientRects().length ? opener : returnTarget())?.focus?.();
    opener = null;
  }

  closeBtn.addEventListener("click", close);
  modal.addEventListener("click", event => { if (event.target === modal) close(); });

  return {
    open,
    close,
    prepare,
    isOpen: () => !modal.hidden,
    // Re-draw (the language changed, or something unlocked while it is open).
    refresh: () => { if (!modal.hidden) render(); },
    describe
  };
}
