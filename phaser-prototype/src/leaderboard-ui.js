// The leaderboard dialog: the boards (all time, this week, the last 24 hours
// and today's garden), the player's own rank card, the tabs and keyboard
// handling, and opening and closing. It draws from what leaderboard-api.js fetches and from the pure row
// logic in leaderboard-view.js. The game gives it the dialog's elements, the
// current language and a few hooks, and calls open().
import { PERIODS, buildRows, plantIndex, topPercent } from "./leaderboard-view.js";
import { plantName as plantNameIn } from "./levels.js";
import { tileArtUrl } from "./tile-art.js";
import { loadDeviceId } from "./storage.js";

// elements: { modal, closeBtn, list, me, tabs, tabBar, daily, dailyWhen, dailyPlay }
// text(): the current language's strings; language(): its code.
// onOpen(): called when the dialog opens (the game cools its combo and closes
// the restart prompt); returnTarget(): the button to give focus back to;
// syncInert(): makes the game behind the dialog unreachable.
// daily: { when(): "22 Oct · New garden in 5 hours", action(): the play
// button's label, or null when the player is already in today's garden,
// play(): start it }.
export function createLeaderboardUi({ api, elements, text: getText, language, onOpen, returnTarget, syncInert, daily }) {
  const {
    modal: leaderboardModalEl, closeBtn: leaderboardCloseBtn, list: leaderboardListEl,
    me: leaderboardMeEl, tabs: leaderboardTabs, tabBar,
    daily: dailyBarEl, dailyWhen: dailyWhenEl, dailyPlay: dailyPlayBtn
  } = elements;
  let leaderboardPeriod = "all";
  let leaderboardToken = 0;

  // A board row's plant, or nothing for a value that is not a plant.
  const plantName = maxTile => (plantIndex(maxTile) < 0 ? "" : plantNameIn(maxTile, language()));

  // The plant's pixel art, so a row shows at a glance how far the run got.
  function plantIcon(maxTile) {
    const icon = document.createElement("span");
    icon.className = "lb-plant";
    if (plantIndex(maxTile) < 0) return icon;
    const img = document.createElement("img");
    img.src = tileArtUrl(maxTile);
    img.alt = "";
    img.width = 30;
    img.height = 30;
    img.loading = "lazy";
    img.decoding = "async";
    img.draggable = false;
    img.addEventListener("error", () => img.remove(), { once: true });
    icon.appendChild(img);
    return icon;
  }

  function entryDetail(entry) {
    const parts = [plantName(entry.max_tile)];
    if (entry.best_combo > 1) parts.push(`${entry.best_combo}×`);
    return parts.filter(Boolean).join(" · ");
  }

  function leaderboardMessage(message) {
    const note = document.createElement("p");
    note.className = "leaderboard-message";
    note.textContent = message;
    return note;
  }

  function renderLeaderboardLoading() {
    const text = getText();
    const list = document.createElement("ol");
    list.className = "lb-rows lb-skeleton";
    list.setAttribute("aria-label", text.loadingScores);
    for (let i = 0; i < 6; i++) {
      const item = document.createElement("li");
      item.className = "leaderboard-entry";
      list.appendChild(item);
    }
    leaderboardListEl.setAttribute("aria-busy", "true");
    leaderboardListEl.replaceChildren(list);
  }

  // The pinned card: the player's own rank, always visible without scrolling.
  function renderLeaderboardMe(me, ready) {
    const text = getText();
    leaderboardMeEl.replaceChildren();
    leaderboardMeEl.hidden = !ready;
    if (!ready) return;
    const ranked = Boolean(me?.rank);
    leaderboardMeEl.classList.toggle("empty", !ranked);
    if (!ranked) {
      const prompt = document.createElement("p");
      prompt.className = "lb-me-prompt";
      prompt.textContent = leaderboardPeriod === "daily" ? text.dailyJoinPrompt : text.lbJoinPrompt;
      leaderboardMeEl.appendChild(prompt);
      return;
    }
    const place = document.createElement("div");
    place.className = "lb-me-place";
    const label = document.createElement("span");
    label.className = "lb-me-label";
    label.textContent = text.lbYourRank;
    const rank = document.createElement("strong");
    rank.className = "lb-me-rank";
    rank.textContent = `#${me.rank}`;
    place.append(label, rank);

    const who = document.createElement("div");
    who.className = "lb-me-who";
    const name = document.createElement("strong");
    name.textContent = me.entry.player_name;
    const detail = document.createElement("small");
    detail.textContent = entryDetail(me.entry);
    who.append(name, detail);

    const result = document.createElement("div");
    result.className = "lb-me-result";
    const points = document.createElement("strong");
    points.textContent = Number(me.entry.score).toLocaleString(language());
    const standing = document.createElement("small");
    standing.textContent = text.lbOfPlayers.replace("{total}", Number(me.total).toLocaleString(language()));
    result.append(points, standing);
    const percent = me.total >= 20 ? topPercent(me.rank, me.total) : null;
    if (percent !== null && percent <= 50) {
      const badge = document.createElement("span");
      badge.className = "lb-me-top";
      badge.textContent = text.lbTop.replace("{percent}", percent);
      result.appendChild(badge);
    }
    leaderboardMeEl.append(place, plantIcon(me.entry.max_tile), who, result);
  }

  function renderLeaderboardRows(period, entries, me) {
    const text = getText();
    leaderboardListEl.removeAttribute("aria-busy");
    if (!entries.length) {
      leaderboardListEl.replaceChildren(leaderboardMessage(
        period === "all" ? text.leaderboardEmpty : period === "daily" ? text.dailyEmpty : text.lbEmptyPeriod
      ));
      return;
    }
    const list = document.createElement("ol");
    list.className = "lb-rows";
    for (const row of buildRows(entries, me)) {
      const item = document.createElement("li");
      if (row.type === "gap") {
        item.className = "lb-gap";
        item.setAttribute("aria-hidden", "true");
        item.textContent = "⋯";
        list.appendChild(item);
        continue;
      }
      item.className = "leaderboard-entry" + (row.rank <= 3 ? " top" : "") + (row.own ? " own" : "");
      item.dataset.rank = String(row.rank);
      if (row.own) item.setAttribute("aria-current", "true");
      const rank = document.createElement("span");
      rank.className = "leaderboard-rank";
      rank.textContent = String(row.rank);
      rank.setAttribute("aria-label", `${text.rank} ${row.rank}`);
      const player = document.createElement("div");
      player.className = "leaderboard-player";
      const who = document.createElement("div");
      who.className = "lb-who";
      const name = document.createElement("strong");
      name.textContent = row.entry.player_name;
      if (row.own) {
        const you = document.createElement("em");
        you.className = "lb-you";
        you.textContent = text.lbYou;
        name.append(" ", you);
      }
      const detail = document.createElement("small");
      detail.textContent = entryDetail(row.entry);
      who.append(name, detail);
      player.append(plantIcon(row.entry.max_tile), who);
      const points = document.createElement("span");
      points.className = "leaderboard-score";
      points.textContent = Number(row.entry.score).toLocaleString(language());
      item.append(rank, player, points);
      list.appendChild(item);
    }
    leaderboardListEl.replaceChildren(list);
    leaderboardListEl.scrollTop = 0;
  }

  function renderLeaderboardError(period, error) {
    const text = getText();
    renderLeaderboardMe(null, false);
    leaderboardListEl.removeAttribute("aria-busy");
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "btn lb-retry";
    retry.textContent = text.lbRetry;
    retry.addEventListener("click", () => { api.forget(period); fetchLeaderboard(period); });
    leaderboardListEl.replaceChildren(
      leaderboardMessage(error?.name === "AbortError" ? text.requestTimeout : text.loadScoresError),
      retry
    );
  }

  async function fetchLeaderboard(period = leaderboardPeriod) {
    const token = ++leaderboardToken;
    if (!api.isFresh(period)) renderLeaderboardLoading();
    const deviceId = loadDeviceId();
    const [list, me] = await Promise.allSettled([
      api.board(period),
      deviceId ? api.me(period, deviceId) : Promise.reject(new Error("no_device"))
    ]);
    // A newer request (another tab, another open) owns the screen now.
    if (token !== leaderboardToken) return;
    if (list.status === "rejected") {
      renderLeaderboardError(period, list.reason);
      return;
    }
    const mine = me.status === "fulfilled" ? me.value : null;
    renderLeaderboardMe(mine, me.status === "fulfilled");
    renderLeaderboardRows(period, list.value, mine);
  }

  // The daily tab says which day it is and when the next one comes, and
  // offers to play it (unless that is what the player is doing).
  function renderDailyBar() {
    dailyBarEl.hidden = leaderboardPeriod !== "daily";
    if (dailyBarEl.hidden) return;
    dailyWhenEl.textContent = daily.when();
    const label = daily.action();
    dailyPlayBtn.hidden = !label;
    if (label) dailyPlayBtn.textContent = label;
  }

  function setLeaderboardPeriod(period, { focus = false } = {}) {
    if (!PERIODS.includes(period)) return;
    leaderboardPeriod = period;
    renderDailyBar();
    for (const tab of leaderboardTabs) {
      const active = tab.dataset.period === period;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    }
    leaderboardListEl.setAttribute("aria-labelledby", `lbTab-${period}`);
    fetchLeaderboard(period);
  }

  function openLeaderboard() {
    onOpen();
    leaderboardModalEl.hidden = false;
    syncInert();
    document.body.style.overflow = "hidden";
    setLeaderboardPeriod(leaderboardPeriod);
    requestAnimationFrame(() => leaderboardCloseBtn.focus());
  }

  function closeLeaderboard() {
    leaderboardModalEl.hidden = true;
    document.body.style.overflow = "";
    syncInert();
    returnTarget().focus();
  }

  leaderboardCloseBtn.addEventListener("click", closeLeaderboard);
  dailyPlayBtn.addEventListener("click", () => {
    leaderboardModalEl.hidden = true;
    document.body.style.overflow = "";
    syncInert();
    daily.play();
  });
  leaderboardTabs.forEach(tab => tab.addEventListener("click", () => setLeaderboardPeriod(tab.dataset.period)));
  tabBar.addEventListener("keydown", event => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    const at = PERIODS.indexOf(leaderboardPeriod);
    let next = null;
    if (step) next = PERIODS[(at + step + PERIODS.length) % PERIODS.length];
    else if (event.key === "Home") next = PERIODS[0];
    else if (event.key === "End") next = PERIODS[PERIODS.length - 1];
    if (next === null) return;
    event.preventDefault();
    setLeaderboardPeriod(next, { focus: true });
  });
  leaderboardModalEl.addEventListener("click", event => { if (event.target === leaderboardModalEl) closeLeaderboard(); });

  return {
    open: openLeaderboard,
    close: closeLeaderboard,
    // Reload what is showing (the language changed).
    refresh: () => { renderDailyBar(); fetchLeaderboard(); },
    // After a score is saved: forget the old boards and show the one it joined.
    showNext(period = "all") {
      api.forgetAll();
      leaderboardPeriod = PERIODS.includes(period) ? period : "all";
    },
    isOpen: () => !leaderboardModalEl.hidden
  };
}
