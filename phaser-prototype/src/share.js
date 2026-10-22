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

// The line of text that goes with the card, in the player's language.
export function shareMessage({ mode, score, worldName, plantName, language, text }) {
  const points = Number(score).toLocaleString(language);
  const template = mode === "victory" ? text.shareVictory : mode === "milestone" ? text.shareMilestone : text.shareNoMoves;
  return template.replace("{score}", points).replace("{world}", worldName).replace("{plant}", plantName);
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

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
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
// result: { mode, score, worldName, worldKicker, plantName, plantArt (an image URL), language }
// backdrop: what captureBackdrop returned (or null for a plain garden-green card)
export async function drawShareCard({ result, text, backdrop, doc = document }) {
  try {
    await Promise.all([
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
  top.addColorStop(0, "rgba(8,16,16,.62)");
  top.addColorStop(1, "rgba(8,16,16,0)");
  context.fillStyle = top;
  context.fillRect(0, 0, CARD_WIDTH, 360);
  const bottom = context.createLinearGradient(0, CARD_HEIGHT - 640, 0, CARD_HEIGHT);
  bottom.addColorStop(0, "rgba(8,16,16,0)");
  bottom.addColorStop(1, "rgba(8,16,16,.7)");
  context.fillStyle = bottom;
  context.fillRect(0, CARD_HEIGHT - 640, CARD_WIDTH, 640);

  context.textBaseline = "alphabetic";
  context.shadowColor = "rgba(0,0,0,.45)";
  context.shadowBlur = 12;
  context.shadowOffsetY = 3;

  // The game's name and the world reached.
  context.fillStyle = "#fffaf0";
  context.textAlign = "center";
  fitText(context, "Garden Evolution", '700 {size}px "Oxanium", "Trebuchet MS", sans-serif', 96, CARD_WIDTH - 120);
  context.fillText("Garden Evolution", CARD_WIDTH / 2, 150);
  const headline = result.mode === "victory" ? text.victoryKicker : result.mode === "milestone" ? text.milestoneKicker : result.worldKicker;
  context.fillStyle = "rgba(255,250,240,.86)";
  fitText(context, headline.toUpperCase(), '800 {size}px "Quicksand", system-ui, sans-serif', 34, CARD_WIDTH - 160);
  context.fillText(headline.toUpperCase(), CARD_WIDTH / 2, 214);

  // The result panel.
  context.shadowColor = "rgba(0,0,0,.35)";
  context.shadowBlur = 30;
  context.shadowOffsetY = 10;
  const panel = { x: 70, y: CARD_HEIGHT - 520, width: CARD_WIDTH - 140, height: 380 };
  roundedRect(context, panel.x, panel.y, panel.width, panel.height, 42);
  context.fillStyle = "rgba(255,250,240,.95)";
  context.fill();
  context.shadowColor = "transparent";

  // The top plant's picture.
  if (result.plantArt) {
    try {
      const art = await loadImage(result.plantArt);
      roundedRect(context, panel.x + 40, panel.y + 40, 300, 300, 34);
      context.fillStyle = "#f4ead8";
      context.fill();
      context.drawImage(art, panel.x + 52, panel.y + 52, 276, 276);
    } catch (error) { /* the panel still has the numbers */ }
  }

  const textLeft = panel.x + 380;
  const textWidth = panel.x + panel.width - 40 - textLeft;
  context.textAlign = "left";
  context.fillStyle = "#7a6a52";
  fitText(context, text.score.toUpperCase(), '800 {size}px "Quicksand", system-ui, sans-serif', 32, textWidth);
  context.fillText(text.score.toUpperCase(), textLeft, panel.y + 92);
  context.fillStyle = "#3f2f1f";
  const points = Number(result.score).toLocaleString(result.language);
  fitText(context, points, '700 {size}px "Oxanium", "Trebuchet MS", sans-serif', 128, textWidth, 48);
  context.fillText(points, textLeft, panel.y + 212);
  context.fillStyle = "#4c6b2c";
  fitText(context, result.plantName, '700 {size}px "Quicksand", system-ui, sans-serif', 44, textWidth);
  context.fillText(result.plantName, textLeft, panel.y + 278);
  context.fillStyle = "#7a6a52";
  fitText(context, result.worldName, '600 {size}px "Quicksand", system-ui, sans-serif', 32, textWidth);
  context.fillText(result.worldName, textLeft, panel.y + 326);

  // Where to play.
  context.textAlign = "center";
  context.fillStyle = "rgba(255,250,240,.92)";
  context.shadowColor = "rgba(0,0,0,.45)";
  context.shadowBlur = 10;
  context.font = '700 34px "Quicksand", system-ui, sans-serif';
  context.fillText(GAME_URL.replace("https://", ""), CARD_WIDTH / 2, CARD_HEIGHT - 70);

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

// The Share button on the end card.
// getResult(): the run on screen (see drawShareCard), or null when there is none.
// capture(): captureBackdrop for the current world.
// onOutcome(outcome): tell the player what happened ("copied", "unavailable").
export function createShareButton({ button, text, getResult, capture, onOutcome, nav = navigator }) {
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
        return await drawShareCard({ result, text: text(), backdrop });
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
