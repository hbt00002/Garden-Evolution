// Sharing a finished run: a picture card (the world the player reached, the
// score, the top plant) plus a line of text and the game's address, through the
// phone's own share sheet. Where pictures cannot be shared the text and the
// link go alone, and where nothing can be shared (most desktops) they are
// copied so the player can paste them anywhere.
//
// Phones only open the share sheet straight after a tap, so the card is drawn
// as soon as the end card appears; the tap then shares it without waiting.

export const GAME_URL = "https://play.gardenevolution.workers.dev";
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;   // 4:5, how most apps show a picture in a chat or a feed

// The line of text that goes with the card, in the player's language. prefix
// ("Today's Garden, 22 Oct:") says which garden it was, when everyone had the same one.
export function shareMessage({ mode, score, worldName, plantName, language, text, prefix = "" }) {
  const points = Number(score).toLocaleString(language);
  const template = mode === "victory" ? text.shareVictory : mode === "milestone" ? text.shareMilestone : text.shareNoMoves;
  const line = template.replace("{score}", points).replace("{world}", worldName).replace("{plant}", plantName);
  return prefix ? `${prefix} ${line}` : line;
}

const loadImage = src => new Promise((resolve, reject) => {
  const image = new Image();
  image.decoding = "async";
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error(`could not load ${src}`));
  image.src = src;
});

// What the world behind the game looks like right now, as a picture, or null.
// engine: the Phaser game drawing the world. plate: the element whose CSS
// background is the last world's painting (that world draws its lights on a
// transparent canvas in front of it).
export async function captureBackdrop({ engine, plate, stage }) {
  if (!engine?.renderer?.snapshot) return null;
  const layers = [];
  if (stage === 5 && plate) {
    const match = getComputedStyle(plate).backgroundImage.match(/url\("?([^")]+)"?\)/);
    if (match) {
      try { layers.push(await loadImage(match[1])); } catch (error) { /* draw the canvas alone */ }
    }
  }
  // Phaser takes the picture on its next frame; with motion off its loop sleeps
  // and that frame never comes, so do not wait for it for long.
  const frame = await new Promise(resolve => {
    const giveUp = setTimeout(() => resolve(null), 1500);
    try { engine.renderer.snapshot(image => { clearTimeout(giveUp); resolve(image); }); }
    catch (error) { clearTimeout(giveUp); resolve(null); }
  });
  if (frame) {
    if (!frame.complete) await new Promise(resolve => { frame.onload = resolve; frame.onerror = resolve; });
    if (frame.naturalWidth) layers.push(frame);
  }
  return layers.length ? layers : null;
}

// Draws `image` to cover the whole card, cropped in the middle, keeping the
// pixel art crisp.
function cover(context, image, focusX = 0.5) {
  const scale = Math.max(CARD_WIDTH / image.naturalWidth, CARD_HEIGHT / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.drawImage(image, (CARD_WIDTH - width) * focusX, (CARD_HEIGHT - height) / 2, width, height);
}

// Shrinks the font until the text fits `maxWidth`.
function fitText(context, value, font, size, maxWidth, minSize = 20) {
  let current = size;
  context.font = `${font.replace("{size}", current)}`;
  while (context.measureText(value).width > maxWidth && current > minSize) {
    current -= 2;
    context.font = `${font.replace("{size}", current)}`;
  }
  return current;
}

// The card itself, as a PNG blob.
// result: { mode, score, worldName, worldKicker, plantName, plantArt (an image URL), language, daily }
// (daily: today's garden, whose kicker names the day and replaces the ending's)
// backdrop: what captureBackdrop returned (or null for a plain garden-green card)
// The chipped corners every paper card in the game has, as a canvas path.
function chippedRect(context, x, y, width, height, cut) {
  context.beginPath();
  context.moveTo(x + cut, y);
  context.lineTo(x + width - cut, y);
  context.lineTo(x + width, y + cut);
  context.lineTo(x + width, y + height - cut);
  context.lineTo(x + width - cut, y + height);
  context.lineTo(x + cut, y + height);
  context.lineTo(x, y + height - cut);
  context.lineTo(x, y + cut);
  context.closePath();
}

// The world's inks when the page has none to give (the first world's).
export const DEFAULT_INK = { accent: "#205b9c", badge: "#d7e9f7", badgeText: "#1d4f86" };
const PAPER = "#efe6d0";
const PAPER_INK = "#3b2f22";
const PAPER_INK_SOFT = "#6f624c";
const WOOD = "#7a5534";
const WOOD_LIP = "#2f2116";

// The card in the game's own language: the world behind, the title in the
// pixel font, the ending on a chip in the world's ink, the plant, and the score
// on a strip of paper between two wooden rods.
// ink: { accent, badge, badgeText }, the world's inks (see createShareButton).
export async function drawShareCard({ result, text, backdrop, ink = DEFAULT_INK, doc = document }) {
  try {
    await Promise.all([
      doc.fonts?.load?.('700 96px "Pixelify Sans"'),
      doc.fonts?.load?.('700 96px "Oxanium"'),
      doc.fonts?.load?.('700 36px "Quicksand"')
    ]);
  } catch (error) { /* the fallback fonts will do */ }

  const canvas = doc.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = false;

  // The world, or a garden-green field when there is no picture of it.
  if (backdrop?.length) {
    backdrop.forEach(layer => cover(context, layer));
  } else {
    const field = context.createLinearGradient(0, 0, 0, CARD_HEIGHT);
    field.addColorStop(0, "#8ccb63");
    field.addColorStop(1, "#3f7b3b");
    context.fillStyle = field;
    context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  }

  // Shade top and bottom so the writing reads over any world.
  const top = context.createLinearGradient(0, 0, 0, 360);
  top.addColorStop(0, "rgba(8,16,16,.6)");
  top.addColorStop(1, "rgba(8,16,16,0)");
  context.fillStyle = top;
  context.fillRect(0, 0, CARD_WIDTH, 360);
  const bottom = context.createLinearGradient(0, CARD_HEIGHT - 520, 0, CARD_HEIGHT);
  bottom.addColorStop(0, "rgba(8,16,16,0)");
  bottom.addColorStop(1, "rgba(8,16,16,.6)");
  context.fillStyle = bottom;
  context.fillRect(0, CARD_HEIGHT - 520, CARD_WIDTH, 520);

  context.textBaseline = "alphabetic";
  context.textAlign = "center";

  // The game's name: the pixel font with a hard shadow in the world's ink.
  context.shadowColor = ink.accent;
  context.shadowBlur = 0;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 6;
  context.fillStyle = "#fffaf0";
  fitText(context, "Garden Evolution", '700 {size}px "Pixelify Sans", "Oxanium", sans-serif', 96, CARD_WIDTH - 120);
  context.fillText("Garden Evolution", CARD_WIDTH / 2, 150);
  context.shadowColor = "transparent";
  context.shadowOffsetY = 0;

  // The ending (or the day) on a chip in the world's ink badge.
  const headline = result.daily ? result.worldKicker : result.mode === "victory" ? text.victoryKicker : result.mode === "milestone" ? text.milestoneKicker : result.worldKicker;
  // (Quicksand: the pixel font's 5 reads as an S, and the headline has numbers.)
  fitText(context, headline, '700 {size}px "Quicksand", system-ui, sans-serif', 40, CARD_WIDTH - 220);
  const chipWidth = Math.min(CARD_WIDTH - 160, context.measureText(headline).width + 64);
  const chip = { x: (CARD_WIDTH - chipWidth) / 2, y: 182, width: chipWidth, height: 64 };
  context.fillStyle = ink.badge;
  chippedRect(context, chip.x, chip.y, chip.width, chip.height, 8);
  context.fill();
  context.fillStyle = ink.badgeText;
  context.fillText(headline, CARD_WIDTH / 2, chip.y + 46);

  // The top plant, standing in the world.
  if (result.plantArt) {
    try {
      const art = await loadImage(result.plantArt);
      context.drawImage(art, (CARD_WIDTH - 440) / 2, 300, 440, 440);
    } catch (error) { /* the paper still has the numbers */ }
  }

  // The score on paper between two wooden rods.
  const panel = { x: 90, y: CARD_HEIGHT - 500, width: CARD_WIDTH - 180, height: 320 };
  context.shadowColor = "rgba(0,0,0,.35)";
  context.shadowBlur = 28;
  context.shadowOffsetY = 12;
  context.fillStyle = PAPER;
  context.fillRect(panel.x, panel.y, panel.width, panel.height);
  context.shadowColor = "transparent";
  context.shadowBlur = 0;
  context.shadowOffsetY = 0;
  context.fillStyle = "rgba(120,95,60,.06)";
  for (let y = panel.y + 4; y < panel.y + panel.height; y += 12) context.fillRect(panel.x, y, panel.width, 4);
  for (const rodY of [panel.y - 12, panel.y + panel.height - 12]) {
    context.fillStyle = WOOD;
    context.fillRect(panel.x - 24, rodY, panel.width + 48, 24);
    context.fillStyle = WOOD_LIP;
    context.fillRect(panel.x - 24, rodY + 24, panel.width + 48, 6);
  }

  const textWidth = panel.width - 80;
  context.fillStyle = PAPER_INK_SOFT;
  fitText(context, text.score, '700 {size}px "Quicksand", system-ui, sans-serif', 34, textWidth);
  context.fillText(text.score, CARD_WIDTH / 2, panel.y + 74);
  context.fillStyle = PAPER_INK;
  const points = Number(result.score).toLocaleString(result.language);
  fitText(context, points, '800 {size}px "Oxanium", "Trebuchet MS", sans-serif', 128, textWidth, 48);
  context.fillText(points, CARD_WIDTH / 2, panel.y + 196);
  const line = [result.plantName, result.worldName].filter(Boolean).join(" · ");
  context.fillStyle = ink.accent;
  fitText(context, line, '700 {size}px "Pixelify Sans", "Oxanium", sans-serif', 44, textWidth, 24);
  context.fillText(line, CARD_WIDTH / 2, panel.y + 266);

  // Where to play.
  context.fillStyle = "#fffaf0";
  context.shadowColor = ink.accent;
  context.shadowOffsetY = 3;
  context.font = '700 34px "Quicksand", system-ui, sans-serif';
  context.fillText(GAME_URL.replace("https://", ""), CARD_WIDTH / 2, CARD_HEIGHT - 60);

  return new Promise((resolve, reject) => canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error("no picture"))), "image/png"));
}

// Shares through the best way the browser has. Returns what happened:
// "image", "text", "copied", "cancelled" or "unavailable".
export async function shareResult({ card, message, url = GAME_URL, nav = navigator }) {
  const isCancel = error => error?.name === "AbortError";
  if (card && typeof File === "function") {
    const file = new File([card], "garden-evolution.png", { type: "image/png" });
    if (nav.canShare?.({ files: [file] })) {
      try {
        // Many apps drop `url` when a file comes with it, so the address goes in the text.
        await nav.share({ files: [file], text: `${message} ${url}` });
        return "image";
      } catch (error) {
        if (isCancel(error)) return "cancelled";
        // fall back to sharing the words
      }
    }
  }
  if (nav.share) {
    try {
      await nav.share({ text: message, url });
      return "text";
    } catch (error) {
      if (isCancel(error)) return "cancelled";
    }
  }
  try {
    await nav.clipboard.writeText(`${message} ${url}`);
    return "copied";
  } catch (error) {
    return "unavailable";
  }
}

// The world's inks as the page has them now (scroll.css sets them per world).
function pageInk() {
  try {
    const css = getComputedStyle(document.getElementById("overlay") || document.documentElement);
    const read = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
    return { accent: read("--ink-accent", DEFAULT_INK.accent), badge: read("--ink-badge", DEFAULT_INK.badge), badgeText: read("--ink-badge-text", DEFAULT_INK.badgeText) };
  } catch (error) {
    return DEFAULT_INK;
  }
}

// The Share button on the end card.
// getResult(): the run on screen (see drawShareCard), or null when there is none.
// capture(): captureBackdrop for the current world.
// onOutcome(outcome): tell the player what happened ("copied", "unavailable").
export function createShareButton({ button, text, getResult, capture, onOutcome, nav = navigator, inkOf = pageInk }) {
  let prepared = null;           // { key, card: Promise<Blob|null> }

  const keyOf = result => JSON.stringify([result.mode, result.score, result.worldName, result.plantName, result.language]);

  // Draw the card now, so a tap can share it at once.
  function prepare() {
    const result = getResult();
    if (!result) return;
    const key = keyOf(result);
    if (prepared?.key === key) return;
    const card = (async () => {
      try {
        const backdrop = await capture();
        return await drawShareCard({ result, text: text(), backdrop, ink: inkOf() });
      } catch (error) {
        return null;               // sharing still works without the picture
      }
    })();
    prepared = { key, card };
  }

  function forget() { prepared = null; }

  button.addEventListener("click", async () => {
    const result = getResult();
    if (!result) return;
    prepare();
    const card = await prepared.card;
    const message = shareMessage({ ...result, text: text() });
    const outcome = await shareResult({ card, message, nav });
    onOutcome?.(outcome);
  });

  return { prepare, forget };
}
