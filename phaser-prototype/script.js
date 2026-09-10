"use strict";
import { createBloomFlow } from "./src/bloom-flow.js";
import { canMergeValues, endingForMergedValue } from "./src/game-rules.js";

/* ============================================================
   Garden Evolution — a relaxing 2048-inspired garden game
   DOM game logic backed by Phaser scenes and a Cloudflare Worker API.
   ============================================================ */

(() => {
  const SIZE = 4;
  const SLIDE_MS = 115;
  const MERGE_MS = 210;
  const SWIPE_THRESHOLD = 24;

  /* ---------- Evolution chain ----------
     Each tile gets a distinct background tone and inline SVG art.
     bg = tile fill; fg = number text color on that fill.
  */
  const LEVELS = [
    { v: 2, name: "Seed", bg: "#efe0c6", fg: "#7a5c34",
      svg: `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="78" rx="20" ry="7" fill="#8c6438" opacity=".35"/><path d="M50 22 C30 22 24 50 32 72 C36 82 64 82 68 72 C76 50 70 22 50 22 Z" fill="#b87e44"/><path d="M44 26 C32 30 28 52 34 68 C37 76 46 76 44 26 Z" fill="#d49b59" opacity=".75"/><path d="M50 22 Q58 35 52 50" stroke="#7a4e22" stroke-width="3" stroke-linecap="round" fill="none" opacity=".6"/><circle cx="48" cy="22" r="3.5" fill="#8cc152"/></svg>` },
    { v: 4, name: "Sprout", bg: "#e6f0cf", fg: "#5d7a2e",
      svg: `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="80" rx="26" ry="8" fill="#6b8b3a" opacity=".3"/><path d="M30 80 Q50 74 70 80 Q50 86 30 80Z" fill="#a07446"/><path d="M50 80 Q48 50 50 34" stroke="#689932" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M50 48 C25 40 18 18 48 30 C48 42 36 50 50 48 Z" fill="#7ab648"/><path d="M50 48 C75 40 82 18 52 30 C52 42 64 50 50 48 Z" fill="#9dd35a"/><path d="M48 30 Q34 32 26 26" stroke="#bfe07a" stroke-width="2" fill="none" opacity=".8"/></svg>` },
    { v: 8, name: "Young Plant", bg: "#d6efda", fg: "#3f6b35",
      svg: `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="82" rx="24" ry="7" fill="#5c7a38" opacity=".3"/><path d="M50 82 V32" stroke="#5b8a2c" stroke-width="6" stroke-linecap="round"/><path d="M50 64 C22 56 16 34 48 46 C48 58 34 66 50 64 Z" fill="#6b9b36"/><path d="M50 52 C78 44 84 22 52 34 C52 46 66 54 50 52 Z" fill="#7ab648"/><path d="M50 40 C28 30 24 10 48 22 C48 32 36 40 50 40 Z" fill="#9dd35a"/><circle cx="50" cy="20" r="4.5" fill="#bfe07a"/></svg>` },
    { v: 16, name: "Flower", bg: "#f7dde2", fg: "#9c4a64",
      svg: `<svg viewBox="0 0 100 100"><path d="M50 84 V46" stroke="#5b8a2c" stroke-width="5" stroke-linecap="round"/><path d="M50 70 Q30 64 26 52 Q40 50 50 62Z" fill="#7ab648"/><path d="M50 62 Q70 56 74 44 Q60 42 50 54Z" fill="#9dd35a"/><g><circle cx="50" cy="34" r="13" fill="#f78fb3"/><circle cx="65" cy="44" r="12" fill="#f78fb3"/><circle cx="35" cy="44" r="12" fill="#f78fb3"/><circle cx="40" cy="22" r="12" fill="#f78fb3"/><circle cx="60" cy="22" r="12" fill="#f78fb3"/><circle cx="50" cy="34" r="10" fill="#fce4ec"/><circle cx="50" cy="34" r="7" fill="#f6d743"/></g></svg>` },
    { v: 32, name: "Bush", bg: "#cfe6b4", fg: "#3f6b28",
      svg: `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="78" rx="34" ry="10" fill="#4a6b28" opacity=".35"/><circle cx="34" cy="56" r="22" fill="#5b8a2c"/><circle cx="66" cy="56" r="22" fill="#6b9b36"/><circle cx="50" cy="42" r="24" fill="#7ab648"/><circle cx="38" cy="38" r="16" fill="#9dd35a"/><circle cx="60" cy="38" r="14" fill="#bfe07a" opacity=".8"/><circle cx="32" cy="50" r="3.5" fill="#f78fb3"/><circle cx="68" cy="48" r="3.5" fill="#f78fb3"/><circle cx="50" cy="30" r="4" fill="#f6d743"/></svg>` },
    { v: 64, name: "Sapling", bg: "#c2d9c2", fg: "#3a5c44",
      svg: `<svg viewBox="0 0 100 100"><path d="M50 86 V48" stroke="#7a5224" stroke-width="8" stroke-linecap="round"/><circle cx="50" cy="36" r="26" fill="#5b8a2c"/><circle cx="34" cy="42" r="18" fill="#6b9b36"/><circle cx="66" cy="42" r="18" fill="#7ab648"/><circle cx="50" cy="24" r="16" fill="#9dd35a"/><circle cx="42" cy="30" r="7" fill="#bfe07a" opacity=".75"/></svg>` },
    { v: 128, name: "Young Tree", bg: "#a8c9a0", fg: "#2f5230",
      svg: `<svg viewBox="0 0 100 100"><path d="M50 88 V44" stroke="#6b4520" stroke-width="10" stroke-linecap="round"/><circle cx="50" cy="36" r="30" fill="#4a7a24"/><circle cx="32" cy="42" r="20" fill="#5b8a2c"/><circle cx="68" cy="42" r="20" fill="#6b9b36"/><circle cx="50" cy="22" r="20" fill="#7ab648"/><circle cx="42" cy="28" r="10" fill="#9dd35a" opacity=".7"/></svg>` },
    { v: 256, name: "Mature Tree", bg: "#8eb07e", fg: "#244a26",
      svg: `<svg viewBox="0 0 100 100"><path d="M46 90 V46" stroke="#5c3818" stroke-width="12" stroke-linecap="round"/><path d="M54 90 V46" stroke="#7a4e22" stroke-width="7" stroke-linecap="round"/><circle cx="50" cy="36" r="34" fill="#3f6b1e"/><circle cx="30" cy="42" r="22" fill="#4a7a24"/><circle cx="70" cy="42" r="22" fill="#5b8a2c"/><circle cx="50" cy="20" r="22" fill="#6b9b36"/><circle cx="40" cy="28" r="12" fill="#7ab648" opacity=".7"/><circle cx="60" cy="30" r="10" fill="#9dd35a" opacity=".7"/></svg>` },
    { v: 512, name: "Fruit Tree", bg: "#e6c79a", fg: "#7a4a22",
      svg: `<svg viewBox="0 0 100 100"><path d="M48 90 V46" stroke="#6b4520" stroke-width="11" stroke-linecap="round"/><circle cx="50" cy="36" r="34" fill="#4a7a24"/><circle cx="30" cy="42" r="22" fill="#5b8a2c"/><circle cx="70" cy="42" r="22" fill="#6b9b36"/><circle cx="50" cy="20" r="22" fill="#7ab648"/><circle cx="34" cy="36" r="5.5" fill="#e84a4a"/><circle cx="64" cy="34" r="5.5" fill="#e84a4a"/><circle cx="52" cy="48" r="5.5" fill="#e84a4a"/><circle cx="42" cy="22" r="5" fill="#e84a4a"/><circle cx="60" cy="22" r="5" fill="#e84a4a"/></svg>` },
    { v: 1024, name: "Ancient Tree", bg: "#6f8a60", fg: "#1e3a1a",
      svg: `<svg viewBox="0 0 100 100"><path d="M42 90 Q46 66 50 46" stroke="#4a2d13" stroke-width="14" stroke-linecap="round" fill="none"/><path d="M58 90 Q54 66 50 46" stroke="#6b4520" stroke-width="10" stroke-linecap="round" fill="none"/><circle cx="50" cy="34" r="38" fill="#2d5216"/><circle cx="26" cy="42" r="26" fill="#3f6b1e"/><circle cx="74" cy="42" r="26" fill="#4a7a24"/><circle cx="50" cy="18" r="26" fill="#5b8a2c"/><circle cx="38" cy="28" r="14" fill="#7ab648" opacity=".65"/><circle cx="62" cy="26" r="12" fill="#9dd35a" opacity=".65"/></svg>` },
    { v: 2048, name: "Golden Tree", bg: "#f2d985", fg: "#6b4d12",
      svg: `<svg viewBox="0 0 100 100"><path d="M48 90 V44" stroke="#6b4520" stroke-width="11" stroke-linecap="round"/><circle cx="50" cy="36" r="34" fill="#e8b421"/><circle cx="30" cy="42" r="22" fill="#f0c43a"/><circle cx="70" cy="42" r="22" fill="#f4d04e"/><circle cx="50" cy="20" r="22" fill="#f7d86a"/><circle cx="42" cy="28" r="11" fill="#fcea94" opacity=".8"/><circle cx="50" cy="36" r="8" fill="#ffffff" opacity=".7"/></svg>` },
    { v: 4096, name: "Tree of Life", bg: "#b8e0a0", fg: "#2a5a1a",
      svg: `<svg viewBox="0 0 100 100"><circle cx="50" cy="38" r="42" fill="#f4d76e" opacity=".25"/><path d="M48 90 V44" stroke="#5c3818" stroke-width="11" stroke-linecap="round"/><circle cx="50" cy="36" r="32" fill="#2f8b3a"/><circle cx="32" cy="42" r="20" fill="#3fa84a"/><circle cx="68" cy="42" r="20" fill="#52c056"/><circle cx="50" cy="22" r="20" fill="#f4d04e"/><g stroke="#fcea94" stroke-width="2.5" stroke-linecap="round"><line x1="50" y1="4" x2="50" y2="10"/><line x1="16" y1="38" x2="22" y2="38"/><line x1="78" y1="38" x2="84" y2="38"/></g><circle cx="50" cy="36" r="8" fill="#ffffff"/></svg>` },
    { v: 8192, name: "Celestial Tree", bg: "#9eb8d6", fg: "#2a3a5e",
      svg: `<svg viewBox="0 0 100 100"><circle cx="50" cy="38" r="44" fill="#cfe8ff" opacity=".22"/><path d="M48 90 V44" stroke="#4a637d" stroke-width="10" stroke-linecap="round"/><circle cx="50" cy="36" r="32" fill="#8cb9e0"/><circle cx="32" cy="42" r="20" fill="#a4cbef"/><circle cx="68" cy="42" r="20" fill="#bfe0ff"/><circle cx="50" cy="22" r="20" fill="#e0f0ff"/><g fill="#ffffff"><circle cx="38" cy="28" r="2.5"/><circle cx="62" cy="26" r="2.5"/><circle cx="50" cy="42" r="2"/></g><circle cx="50" cy="36" r="8" fill="#ffffff" opacity=".9"/><circle cx="50" cy="36" r="4" fill="#f4d76e" opacity=".8"/></svg>` }
  ];

  // Modern shared tile pack. The original inline-SVG pack is intentionally
  // retained above as a lossless fallback and is also archived separately.
  const TILE_PALETTE = [
    ["#f4ead8", "#70502e"], ["#e8f1d5", "#4c6b2c"], ["#dcebd2", "#385f36"],
    ["#f3e0e2", "#85475c"], ["#d7e7c1", "#3e632e"], ["#b7d09b", "#315b35"],
    ["#82aa74", "#214a2d"], ["#496e4b", "#173522"], ["#5f7d5e", "#173a25"],
    ["#71866a", "#173a25"], ["#f0c9d5", "#75344f"], ["#b8dca8", "#25531f"],
    ["#aebfdd", "#283d66"]
  ];
  LEVELS.forEach((level, index) => {
    level.sprite = index;
    level.bg = TILE_PALETTE[index][0];
    level.fg = TILE_PALETTE[index][1];
  });
  LEVELS[8].name = "Mini Forest";
  LEVELS[9].name = "Ancient Tree";
  LEVELS[10].name = "Sakura Crown";

  const BY_VALUE = {};
  LEVELS.forEach(l => (BY_VALUE[l.v] = l));
  function levelFor(v) {
    return BY_VALUE[v] || { v, name: "Bloomed", bg: LEVELS[LEVELS.length - 1].bg, fg: "#fff", svg: LEVELS[LEVELS.length - 1].svg };
  }

  /* ---------- Environment stages (by highest tile value) ---------- */
  // Returns 1..5
  function stageFor(maxValue) {
    if (maxValue <= 64) return 1;
    if (maxValue <= 256) return 2;
    if (maxValue <= 512) return 3;
    if (maxValue <= 1024) return 4;
    return 5;
  }

  /* ---------- DOM refs ---------- */
  const boardEl = document.getElementById("board");
  const gridEl = document.getElementById("grid");
  const tilesEl = document.getElementById("tiles");
  const overlayEl = document.getElementById("overlay");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const finalScoreEl = document.getElementById("finalScore");
  const finalScoreLabelEl = finalScoreEl.previousElementSibling;
  const finalBestEl = document.getElementById("finalBest");
  const finalTitleEl = document.getElementById("finalTitle");
  const finalExplanationEl = document.getElementById("finalExplanation");
  const newBtn = document.getElementById("newBtn");
  const playAgainBtn = document.getElementById("playAgainBtn");
  const continueMilestoneBtn = document.getElementById("continueMilestoneBtn");
  const leaderboardBtn = document.getElementById("leaderboardBtn");
  const leaderboardModalEl = document.getElementById("leaderboardModal");
  const leaderboardCloseBtn = document.getElementById("leaderboardClose");
  const leaderboardListEl = document.getElementById("leaderboardList");
  const scoreFormEl = document.getElementById("scoreForm");
  const scoreFormLabelEl = scoreFormEl.querySelector("label");
  const playerNameEl = document.getElementById("playerName");
  const submitScoreBtn = document.getElementById("submitScoreBtn");
  const scoreSubmitStatusEl = document.getElementById("scoreSubmitStatus");
  const lowerScoreConfirmEl = document.getElementById("lowerScoreConfirm");
  const lowerScoreTitleEl = document.getElementById("lowerScoreTitle");
  const lowerScoreMessageEl = document.getElementById("lowerScoreMessage");
  const cancelLowerScoreBtn = document.getElementById("cancelLowerScore");
  const confirmLowerScoreBtn = document.getElementById("confirmLowerScore");
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsPanel = document.getElementById("settingsPanel");
  const settingsBackdrop = document.getElementById("settingsBackdrop");
  const settingsCloseBtn = document.getElementById("settingsClose");
  const startScreenEl = document.getElementById("startScreen");
  const startPlayBtn = document.getElementById("startPlayBtn");
  const startSettingsBtn = document.getElementById("startSettingsBtn");
  const startLeaderboardBtn = document.getElementById("startLeaderboardBtn");
  const musicVolumeEl = document.getElementById("musicVolume");
  const musicVolumeValueEl = document.getElementById("musicVolumeValue");
  const pianoToggle = document.getElementById("pianoToggle");
  const sfxToggle = document.getElementById("sfxToggle");
  const motionToggle = document.getElementById("motionToggle");
  const particlesToggle = document.getElementById("particlesToggle");
  const contrastToggle = document.getElementById("contrastToggle");
  const performanceNoteEl = document.getElementById("performanceNote");
  const languageSelect = document.getElementById("languageSelect");
  const envEl = document.getElementById("env");
  const envSkyEl = document.querySelector(".env-sky");
  const envParticlesEl = document.getElementById("envParticles");
  const toastEl = document.getElementById("toast");
  const stageKickerEl = document.getElementById("stageKicker");
  const stageNameEl = document.getElementById("stageName");
  const stageNextEl = document.getElementById("stageNext");
  const stageFillEl = document.getElementById("stageFill");
  const stageDots = Array.from(document.querySelectorAll(".stage-dot"));
  const comboHudEl = document.getElementById("comboHud");
  const comboValueEl = document.getElementById("comboValue");
  const worldEventLayerEl = document.getElementById("worldEventLayer");
  const finalWorldEl = document.getElementById("finalWorld");
  const finalTileEl = document.getElementById("finalTile");
  const finalComboEl = document.getElementById("finalCombo");
  const finalEmblemEl = document.getElementById("finalEmblem");
  const milestoneArtEl = document.getElementById("milestoneArt");
  const victoryArtEl = document.getElementById("victoryArt");

  /* ---------- State ---------- */
  let grid;
  let tiles;
  let nextId;
  let score;
  let best;
  let goldenAchieved;
  let victoryAchieved;
  let busy;
  let queuedDirection = null;
  let cellSize;
  let gap;
  let currentStage = 0;
  let maxValueReached = 0;
  let combo = 0;
  let bestCombo = 0;
  const bloomFlow = createBloomFlow();
  let flow = 0;
  let flowTimer = null;
  let completedMoves = 0;
  let gameGeneration = 0;
  const restartPanel = document.getElementById("newGameConfirm");
  const cancelRestart = document.getElementById("cancelNewGame");
  const confirmRestart = document.getElementById("confirmNewGame");
  let worldEventTimer = null;
  let scoreSubmitted = false;
  let reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const STAGE_META = [
    { name: "Winter Beginning", next: 128, line: "A quiet beginning beneath the snow.", emblem: "❄" },
    { name: "Snowmelt Valley", next: 512, line: "The snow begins to sing.", emblem: "◌" },
    { name: "Spring Bloom", next: 1024, line: "Every corner wakes with life.", emblem: "✿" },
    { name: "Alpine Sakura", next: 2048, line: "Petals rise over the alpine garden.", emblem: "❀" },
    { name: "Moonlit Garden", next: null, line: "The completed garden glows at night.", emblem: "☾" }
  ];

  const TRANSLATIONS = {
    en: { hint:"Swipe or use arrow keys to grow your garden.",score:"Score",best:"Best",leaderboard:"Leaderboard",hallOfFame:"Garden Hall of Fame",newGame:"New Game",settings:"Settings",language:"Language",music:"Music",soundEffects:"Sound Effects",livingBackground:"Living Background",extraParticles:"Extra Particles",highContrast:"High Contrast",performance:"Performance adapts automatically.",combo:"Bloom Combo",noMoves:"No Moves Left",noMovesText:"The board is full and no plants can merge.",final:"Final",topPlant:"Top Plant",bestCombo:"Best Combo",joinLeaderboard:"Join the leaderboard",submit:"Submit",playAgain:"Play Again",nextWorld:"Next world at",fullyEvolved:"World fully evolved",world:"World",of:"of",yourName:"Your name",balanced:"Balanced mode is active for smoother play.",fullDetail:"Full detail mode is active." },
    tr: { hint:"Bahçeni büyütmek için kaydır veya yön tuşlarını kullan.",score:"Skor",best:"En İyi",leaderboard:"Liderlik Tablosu",hallOfFame:"Bahçe Şöhretler Salonu",newGame:"Yeni Oyun",settings:"Ayarlar",language:"Dil",music:"Müzik",soundEffects:"Ses Efektleri",livingBackground:"Canlı Arka Plan",extraParticles:"Ekstra Parçacıklar",highContrast:"Yüksek Kontrast",performance:"Performans otomatik olarak ayarlanır.",combo:"Çiçek Kombosu",noMoves:"Hamle Kalmadı",noMovesText:"Board doldu ve birleşebilecek bitki kalmadı.",final:"Final",topPlant:"En Büyük Bitki",bestCombo:"En İyi Kombo",joinLeaderboard:"Liderlik tablosuna katıl",submit:"Kaydet",playAgain:"Tekrar Oyna",nextWorld:"Sonraki dünya",fullyEvolved:"Dünya tamamen gelişti",world:"Dünya",of:"/",yourName:"Adın",balanced:"Daha akıcı oyun için dengeli mod aktif.",fullDetail:"Tam detay modu aktif." },
    zh: {hint:"滑动或使用方向键来培育你的花园。",score:"得分",best:"最佳",leaderboard:"排行榜",hallOfFame:"花园名人堂",newGame:"新游戏",settings:"设置",language:"语言",music:"音乐",soundEffects:"音效",livingBackground:"动态背景",extraParticles:"额外粒子",highContrast:"高对比度",performance:"性能会自动调整。",combo:"绽放连击",noMoves:"无可用移动",noMovesText:"棋盘已满，没有植物可以合并。",final:"最终",topPlant:"最高植物",bestCombo:"最佳连击",joinLeaderboard:"加入排行榜",submit:"提交",playAgain:"再玩一次",nextWorld:"下一世界",fullyEvolved:"世界已完全进化",world:"世界",of:"/",yourName:"你的名字",balanced:"平衡模式已启用。",fullDetail:"完整细节模式已启用。"},
    ja: {hint:"スワイプまたは矢印キーで庭を育てよう。",score:"スコア",best:"ベスト",leaderboard:"ランキング",hallOfFame:"ガーデン殿堂",newGame:"ニューゲーム",settings:"設定",language:"言語",music:"音楽",soundEffects:"効果音",livingBackground:"動く背景",extraParticles:"追加パーティクル",highContrast:"高コントラスト",performance:"パフォーマンスは自動調整されます。",combo:"ブルームコンボ",noMoves:"動かせません",noMovesText:"ボードが埋まり、結合できる植物がありません。",final:"最終",topPlant:"最高の植物",bestCombo:"最高コンボ",joinLeaderboard:"ランキングに参加",submit:"登録",playAgain:"もう一度",nextWorld:"次の世界",fullyEvolved:"世界は完全に進化しました",world:"ワールド",of:"/",yourName:"名前",balanced:"バランスモードが有効です。",fullDetail:"フルディテールモードが有効です。"},
    ko: {hint:"스와이프하거나 방향키로 정원을 키우세요.",score:"점수",best:"최고",leaderboard:"순위표",hallOfFame:"정원 명예의 전당",newGame:"새 게임",settings:"설정",language:"언어",music:"음악",soundEffects:"효과음",livingBackground:"움직이는 배경",extraParticles:"추가 파티클",highContrast:"고대비",performance:"성능이 자동 조정됩니다.",combo:"블룸 콤보",noMoves:"이동 불가",noMovesText:"보드가 가득 차 합칠 식물이 없습니다.",final:"최종",topPlant:"최고 식물",bestCombo:"최고 콤보",joinLeaderboard:"순위표 참가",submit:"등록",playAgain:"다시 하기",nextWorld:"다음 세계",fullyEvolved:"세계가 완전히 진화했습니다",world:"월드",of:"/",yourName:"이름",balanced:"균형 모드가 활성화되었습니다.",fullDetail:"전체 디테일 모드가 활성화되었습니다."},
    es: {hint:"Desliza o usa las flechas para cultivar tu jardín.",score:"Puntos",best:"Récord",leaderboard:"Clasificación",hallOfFame:"Salón de la Fama",newGame:"Nueva partida",settings:"Ajustes",language:"Idioma",music:"Música",soundEffects:"Efectos",livingBackground:"Fondo animado",extraParticles:"Partículas",highContrast:"Alto contraste",performance:"El rendimiento se adapta automáticamente.",combo:"Combo floral",noMoves:"Sin movimientos",noMovesText:"El tablero está lleno y no hay plantas para combinar.",final:"Final",topPlant:"Mejor planta",bestCombo:"Mejor combo",joinLeaderboard:"Únete a la clasificación",submit:"Enviar",playAgain:"Jugar de nuevo",nextWorld:"Siguiente mundo",fullyEvolved:"Mundo totalmente evolucionado",world:"Mundo",of:"de",yourName:"Tu nombre",balanced:"Modo equilibrado activo.",fullDetail:"Modo de detalle completo activo."},
    pt: {hint:"Deslize ou use as setas para cultivar seu jardim.",score:"Pontos",best:"Recorde",leaderboard:"Classificação",hallOfFame:"Hall da Fama",newGame:"Novo jogo",settings:"Configurações",language:"Idioma",music:"Música",soundEffects:"Efeitos sonoros",livingBackground:"Fundo animado",extraParticles:"Partículas extras",highContrast:"Alto contraste",performance:"O desempenho é ajustado automaticamente.",combo:"Combo floral",noMoves:"Sem movimentos",noMovesText:"O tabuleiro está cheio e nenhuma planta pode se combinar.",final:"Final",topPlant:"Melhor planta",bestCombo:"Melhor combo",joinLeaderboard:"Entrar na classificação",submit:"Enviar",playAgain:"Jogar novamente",nextWorld:"Próximo mundo",fullyEvolved:"Mundo totalmente evoluído",world:"Mundo",of:"de",yourName:"Seu nome",balanced:"Modo equilibrado ativo.",fullDetail:"Modo de detalhes completos ativo."},
    fr: {hint:"Glissez ou utilisez les flèches pour faire pousser votre jardin.",score:"Score",best:"Record",leaderboard:"Classement",hallOfFame:"Panthéon du jardin",newGame:"Nouvelle partie",settings:"Réglages",language:"Langue",music:"Musique",soundEffects:"Effets sonores",livingBackground:"Décor animé",extraParticles:"Particules",highContrast:"Contraste élevé",performance:"Les performances s’adaptent automatiquement.",combo:"Combo floral",noMoves:"Aucun mouvement",noMovesText:"Le plateau est plein et aucune plante ne peut fusionner.",final:"Final",topPlant:"Meilleure plante",bestCombo:"Meilleur combo",joinLeaderboard:"Rejoindre le classement",submit:"Valider",playAgain:"Rejouer",nextWorld:"Monde suivant",fullyEvolved:"Monde entièrement évolué",world:"Monde",of:"sur",yourName:"Votre nom",balanced:"Mode équilibré actif.",fullDetail:"Mode détails complets actif."},
    de: {hint:"Wische oder nutze die Pfeiltasten, um deinen Garten wachsen zu lassen.",score:"Punkte",best:"Rekord",leaderboard:"Bestenliste",hallOfFame:"Garten-Ruhmeshalle",newGame:"Neues Spiel",settings:"Einstellungen",language:"Sprache",music:"Musik",soundEffects:"Soundeffekte",livingBackground:"Animierter Hintergrund",extraParticles:"Extra-Partikel",highContrast:"Hoher Kontrast",performance:"Die Leistung wird automatisch angepasst.",combo:"Blüten-Combo",noMoves:"Keine Züge",noMovesText:"Das Spielfeld ist voll und keine Pflanzen können verschmelzen.",final:"Final",topPlant:"Beste Pflanze",bestCombo:"Beste Combo",joinLeaderboard:"Bestenliste beitreten",submit:"Senden",playAgain:"Nochmal spielen",nextWorld:"Nächste Welt",fullyEvolved:"Welt vollständig entwickelt",world:"Welt",of:"von",yourName:"Dein Name",balanced:"Ausgeglichener Modus aktiv.",fullDetail:"Volle Details aktiv."},
    ru: {hint:"Проведите пальцем или используйте стрелки, чтобы вырастить сад.",score:"Счёт",best:"Рекорд",leaderboard:"Лидеры",hallOfFame:"Зал славы сада",newGame:"Новая игра",settings:"Настройки",language:"Язык",music:"Музыка",soundEffects:"Звуки",livingBackground:"Живой фон",extraParticles:"Частицы",highContrast:"Высокий контраст",performance:"Производительность настраивается автоматически.",combo:"Цветочное комбо",noMoves:"Нет ходов",noMovesText:"Поле заполнено, объединить растения нельзя.",final:"Итог",topPlant:"Лучшее растение",bestCombo:"Лучшее комбо",joinLeaderboard:"Войти в таблицу",submit:"Отправить",playAgain:"Играть снова",nextWorld:"Следующий мир",fullyEvolved:"Мир полностью развит",world:"Мир",of:"из",yourName:"Ваше имя",balanced:"Сбалансированный режим активен.",fullDetail:"Полная детализация активна."}
  };
  const LOWER_SCORE_COPY = {
    en: ["Lower score", "Your new score ({newScore}) is lower than your current score ({currentScore}). If you continue, your high score will be lost. Are you sure?", "Cancel", "Yes, submit"],
    tr: ["Daha düşük skor", "Yeni skorunuz ({newScore}), güncel skorunuzdan ({currentScore}) daha düşük. Devam ederseniz yüksek skorunuz kaybolacaktır. Göndermek istediğinize emin misiniz?", "Vazgeç", "Evet, gönder"],
    zh: ["分数较低", "新分数（{newScore}）低于当前分数（{currentScore}）。继续后最高分将被替换。确定提交吗？", "取消", "仍然提交"],
    ja: ["低いスコア", "新しいスコア（{newScore}）は現在のスコア（{currentScore}）より低いです。続行するとハイスコアが失われます。送信しますか？", "キャンセル", "送信する"],
    ko: ["더 낮은 점수", "새 점수({newScore})가 현재 점수({currentScore})보다 낮습니다. 계속하면 최고 점수가 사라집니다. 제출할까요?", "취소", "제출"],
    es: ["Puntuación inferior", "Tu nueva puntuación ({newScore}) es inferior a la actual ({currentScore}). Si continúas, perderás tu récord. ¿Quieres enviarla?", "Cancelar", "Sí, enviar"],
    pt: ["Pontuação menor", "Sua nova pontuação ({newScore}) é menor que a atual ({currentScore}). Se continuar, seu recorde será perdido. Deseja enviar?", "Cancelar", "Sim, enviar"],
    fr: ["Score inférieur", "Votre nouveau score ({newScore}) est inférieur au score actuel ({currentScore}). En continuant, votre record sera perdu. Voulez-vous l’envoyer ?", "Annuler", "Oui, envoyer"],
    de: ["Niedrigere Punktzahl", "Deine neue Punktzahl ({newScore}) ist niedriger als deine aktuelle ({currentScore}). Wenn du fortfährst, geht dein Rekord verloren. Trotzdem senden?", "Abbrechen", "Ja, senden"],
    ru: ["Более низкий счёт", "Новый результат ({newScore}) ниже текущего ({currentScore}). Если продолжить, рекорд будет потерян. Отправить результат?", "Отмена", "Да, отправить"]
  };
  const LOCALIZED_STAGES = {
    tr:[["Kışın Başlangıcı","Karların altında sessiz bir başlangıç."],["Kar Erimesi Vadisi","Kar şarkı söylemeye başlıyor."],["İlkbahar Çiçekleri","Her köşe yaşamla uyanıyor."],["Alp Sakuraları","Yapraklar Alp bahçesinin üzerinde yükseliyor."],["Ay Işıklı Bahçe","Tamamlanan bahçe gecenin içinde parlıyor."]],
    zh:[["冬日初始","雪下静谧的开始。"],["融雪山谷","积雪开始歌唱。"],["春日绽放","每个角落都苏醒了。"],["高山樱花","花瓣飞越高山花园。"],["月光花园","完成的花园在夜色中闪耀。"]],
    ja:[["冬の始まり","雪の下の静かな始まり。"],["雪解けの谷","雪が歌い始める。"],["春の開花","すべての場所が目覚める。"],["アルプス桜","花びらが高山の庭を舞う。"],["月夜の庭","完成した庭が夜に輝く。"]],
    ko:[["겨울의 시작","눈 아래 고요한 시작."],["눈 녹는 계곡","눈이 노래하기 시작합니다."],["봄의 개화","모든 곳이 생명으로 깨어납니다."],["알프스 벚꽃","꽃잎이 고산 정원 위로 날립니다."],["달빛 정원","완성된 정원이 밤에 빛납니다."]],
    es:[["Comienzo invernal","Un comienzo tranquilo bajo la nieve."],["Valle del deshielo","La nieve comienza a cantar."],["Floración primaveral","Cada rincón despierta a la vida."],["Sakura alpino","Los pétalos vuelan sobre el jardín alpino."],["Jardín lunar","El jardín completo brilla de noche."]],
    pt:[["Início do inverno","Um começo tranquilo sob a neve."],["Vale do degelo","A neve começa a cantar."],["Flores da primavera","Cada canto desperta para a vida."],["Sakura alpina","Pétalas voam sobre o jardim alpino."],["Jardim ao luar","O jardim completo brilha à noite."]],
    fr:[["Début de l’hiver","Un début paisible sous la neige."],["Vallée du dégel","La neige commence à chanter."],["Floraison printanière","Chaque recoin s’éveille à la vie."],["Sakura alpin","Les pétales survolent le jardin alpin."],["Jardin au clair de lune","Le jardin achevé brille dans la nuit."]],
    de:[["Winterbeginn","Ein stiller Anfang unter dem Schnee."],["Tal der Schneeschmelze","Der Schnee beginnt zu singen."],["Frühlingsblüte","Jede Ecke erwacht zum Leben."],["Alpen-Sakura","Blütenblätter schweben über den Alpengarten."],["Mondscheingarten","Der vollendete Garten leuchtet bei Nacht."]],
    ru:[["Начало зимы","Тихое начало под снегом."],["Долина таяния","Снег начинает петь."],["Весеннее цветение","Каждый уголок пробуждается."],["Альпийская сакура","Лепестки летят над альпийским садом."],["Лунный сад","Завершённый сад сияет ночью."]]
  };
  const PLAY_LABELS = { en:"Play", tr:"Oyna", zh:"开始游戏", ja:"プレイ", ko:"플레이", es:"Jugar", pt:"Jogar", fr:"Jouer", de:"Spielen", ru:"Играть" };
  const BLOOM_LABELS = {
    en: ["Your current garden will be cleared.", "Cancel", "Start new garden", "Bloom Streak", "Best Streak"],
    tr: ["Mevcut bahçen temizlenecek.", "İptal", "Yeni bahçe başlat", "Birleşme Serisi", "En İyi Seri"],
    zh: ["当前花园将被清空。", "取消", "开始新花园", "连续合并", "最佳连合"],
    ja: ["現在の庭がリセットされます。", "キャンセル", "新しい庭を始める", "連続合成", "最高連続合成"],
    ko: ["현재 정원이 초기화됩니다.", "취소", "새 정원 시작", "연속 합치기", "최고 연속 합치기"],
    es: ["Se borrará tu jardín actual.", "Cancelar", "Crear otro jardín", "Racha floral", "Mejor racha"],
    pt: ["Seu jardim atual será apagado.", "Cancelar", "Criar novo jardim", "Sequência floral", "Melhor sequência"],
    fr: ["Votre jardin actuel sera effacé.", "Annuler", "Créer un jardin", "Série florale", "Meilleure série"],
    de: ["Dein aktueller Garten wird gelöscht.", "Abbrechen", "Neuen Garten starten", "Blütenserie", "Beste Serie"],
    ru: ["Текущий сад будет очищен.", "Отмена", "Начать новый сад", "Серия слияний", "Лучшая серия"]
  };
  for (const [language, labels] of Object.entries(BLOOM_LABELS)) {
    Object.assign(TRANSLATIONS[language], Object.fromEntries(
      ["restartWarning", "cancelRestart", "confirmRestart", "combo", "bestCombo"].map((key, i) => [key, labels[i]])
    ));
  }
  const COMBO_PIANO_LABELS = {
    en:"Combo Piano", tr:"Kombo Piyanosu", zh:"连击钢琴", ja:"コンボピアノ", ko:"콤보 피아노",
    es:"Piano de combo", pt:"Piano de combo", fr:"Piano de combo", de:"Combo-Klavier", ru:"Комбо-пианино"
  };
  for (const [language, label] of Object.entries(COMBO_PIANO_LABELS)) {
    TRANSLATIONS[language].comboPiano = label;
  }
  const ENDING_COPY = {
    en: {
      milestoneKicker:"2048 · MILESTONE", milestoneTitle:"Golden Tree", milestoneText:"The garden is complete. Keep growing to reach 8192.", continueGame:"Continue",
      victoryKicker:"8192 · FINALE", victoryTitle:"Garden Complete", victoryText:"You reached 8192. The largest plants can no longer merge.", saveFinalScore:"Save your score", currentScore:"Current"
    },
    tr: {
      milestoneKicker:"2048 · DÖNÜM NOKTASI", milestoneTitle:"Altın Ağaç", milestoneText:"Bahçe tamamlandı. 8192'ye ulaşmak için büyümeye devam edebilirsin.", continueGame:"Devam Et",
      victoryKicker:"8192 · FİNAL", victoryTitle:"Bahçe Tamamlandı", victoryText:"8192'ye ulaştın. En büyük bitkiler artık birleşmez.", saveFinalScore:"Skorunu kaydet", currentScore:"Güncel"
    },
    zh: {
      milestoneKicker:"2048 · 里程碑", milestoneTitle:"黄金树", milestoneText:"花园已经完成。继续培育，向8192前进。", continueGame:"继续",
      victoryKicker:"8192 · 终章", victoryTitle:"花园完成", victoryText:"你已达到8192。最大的植物无法再合并。", saveFinalScore:"保存分数", currentScore:"当前"
    },
    ja: {
      milestoneKicker:"2048 · 節目", milestoneTitle:"黄金の木", milestoneText:"庭が完成しました。8192を目指して育て続けられます。", continueGame:"続ける",
      victoryKicker:"8192 · フィナーレ", victoryTitle:"庭が完成しました", victoryText:"8192に到達しました。最大の植物はこれ以上合成できません。", saveFinalScore:"スコアを保存", currentScore:"現在"
    },
    ko: {
      milestoneKicker:"2048 · 이정표", milestoneTitle:"황금 나무", milestoneText:"정원이 완성되었습니다. 8192를 향해 계속 키울 수 있습니다.", continueGame:"계속하기",
      victoryKicker:"8192 · 피날레", victoryTitle:"정원 완성", victoryText:"8192에 도달했습니다. 가장 큰 식물은 더 이상 합칠 수 없습니다.", saveFinalScore:"점수 저장", currentScore:"현재"
    },
    es: {
      milestoneKicker:"2048 · HITO", milestoneTitle:"Árbol Dorado", milestoneText:"El jardín está completo. Puedes seguir creciendo hasta 8192.", continueGame:"Continuar",
      victoryKicker:"8192 · FINAL", victoryTitle:"Jardín completado", victoryText:"Has alcanzado 8192. Las plantas más grandes ya no pueden combinarse.", saveFinalScore:"Guarda tu puntuación", currentScore:"Actual"
    },
    pt: {
      milestoneKicker:"2048 · MARCO", milestoneTitle:"Árvore Dourada", milestoneText:"O jardim está completo. Você pode continuar crescendo até 8192.", continueGame:"Continuar",
      victoryKicker:"8192 · FINAL", victoryTitle:"Jardim concluído", victoryText:"Você chegou a 8192. As maiores plantas não podem mais se combinar.", saveFinalScore:"Salve sua pontuação", currentScore:"Atual"
    },
    fr: {
      milestoneKicker:"2048 · ÉTAPE", milestoneTitle:"Arbre d'Or", milestoneText:"Le jardin est achevé. Vous pouvez continuer à pousser jusqu'à 8192.", continueGame:"Continuer",
      victoryKicker:"8192 · FINALE", victoryTitle:"Jardin terminé", victoryText:"Vous avez atteint 8192. Les plus grandes plantes ne peuvent plus fusionner.", saveFinalScore:"Enregistrer votre score", currentScore:"Actuel"
    },
    de: {
      milestoneKicker:"2048 · MEILENSTEIN", milestoneTitle:"Goldener Baum", milestoneText:"Der Garten ist vollendet. Du kannst bis 8192 weiterwachsen.", continueGame:"Weiterspielen",
      victoryKicker:"8192 · FINALE", victoryTitle:"Garten vollendet", victoryText:"Du hast 8192 erreicht. Die größten Pflanzen können nicht weiter verschmelzen.", saveFinalScore:"Punktzahl speichern", currentScore:"Aktuell"
    },
    ru: {
      milestoneKicker:"2048 · РУБЕЖ", milestoneTitle:"Золотое дерево", milestoneText:"Сад завершён. Можно продолжить рост до 8192.", continueGame:"Продолжить",
      victoryKicker:"8192 · ФИНАЛ", victoryTitle:"Сад завершён", victoryText:"Вы достигли 8192. Самые крупные растения больше не объединяются.", saveFinalScore:"Сохранить результат", currentScore:"Текущий"
    }
  };
  for (const [language, copy] of Object.entries(ENDING_COPY)) {
    Object.assign(TRANSLATIONS[language], copy);
  }
  const LEADERBOARD_COPY = {
    en: { rank:"Rank", plant:"Plant", leaderboardEmpty:"No scores yet. Be the first gardener!", loadingScores:"Loading scores…", loadScoresError:"The leaderboard is temporarily unavailable. Please try again.", requestTimeout:"The leaderboard request timed out. Please try again.", nameTooShort:"Please enter at least 2 characters.", sending:"Sending…", submitSuccess:"Your score has joined the garden!", submitError:"Your score could not be submitted. Please try again.", sessionError:"Your game session could not be verified. Please try again." },
    tr: { rank:"Sıra", plant:"Bitki", leaderboardEmpty:"Henüz skor yok. İlk bahçıvan sen ol!", loadingScores:"Skorlar yükleniyor…", loadScoresError:"Liderlik tablosuna şu anda ulaşılamıyor. Lütfen tekrar dene.", requestTimeout:"Liderlik tablosu isteği zaman aşımına uğradı. Lütfen tekrar dene.", nameTooShort:"Lütfen en az 2 karakter gir.", sending:"Gönderiliyor…", submitSuccess:"Skorun bahçeye katıldı!", submitError:"Skorun gönderilemedi. Lütfen tekrar dene.", sessionError:"Oyun oturumun doğrulanamadı. Lütfen tekrar dene." },
    zh: { rank:"排名", plant:"植物", leaderboardEmpty:"还没有分数。成为第一位园丁吧！", loadingScores:"正在加载分数…", loadScoresError:"排行榜暂时不可用，请重试。", requestTimeout:"排行榜请求超时，请重试。", nameTooShort:"请输入至少2个字符。", sending:"正在提交…", submitSuccess:"你的分数已加入花园！", submitError:"无法提交分数，请重试。", sessionError:"无法验证游戏会话，请重试。" },
    ja: { rank:"順位", plant:"植物", leaderboardEmpty:"まだスコアがありません。最初の庭師になりましょう！", loadingScores:"スコアを読み込み中…", loadScoresError:"ランキングは一時的に利用できません。もう一度お試しください。", requestTimeout:"ランキングへの接続がタイムアウトしました。", nameTooShort:"2文字以上入力してください。", sending:"送信中…", submitSuccess:"スコアが庭に加わりました！", submitError:"スコアを送信できませんでした。", sessionError:"ゲームセッションを確認できませんでした。" },
    ko: { rank:"순위", plant:"식물", leaderboardEmpty:"아직 점수가 없습니다. 첫 번째 정원사가 되어 보세요!", loadingScores:"점수를 불러오는 중…", loadScoresError:"순위표를 일시적으로 사용할 수 없습니다. 다시 시도해 주세요.", requestTimeout:"순위표 요청 시간이 초과되었습니다.", nameTooShort:"2자 이상 입력해 주세요.", sending:"전송 중…", submitSuccess:"점수가 정원에 등록되었습니다!", submitError:"점수를 제출할 수 없습니다.", sessionError:"게임 세션을 확인할 수 없습니다." },
    es: { rank:"Puesto", plant:"Planta", leaderboardEmpty:"Aún no hay puntuaciones. ¡Sé el primer jardinero!", loadingScores:"Cargando puntuaciones…", loadScoresError:"La clasificación no está disponible temporalmente. Inténtalo de nuevo.", requestTimeout:"La solicitud de clasificación agotó el tiempo.", nameTooShort:"Introduce al menos 2 caracteres.", sending:"Enviando…", submitSuccess:"¡Tu puntuación se ha unido al jardín!", submitError:"No se pudo enviar tu puntuación.", sessionError:"No se pudo verificar tu sesión de juego." },
    pt: { rank:"Posição", plant:"Planta", leaderboardEmpty:"Ainda não há pontuações. Seja o primeiro jardineiro!", loadingScores:"Carregando pontuações…", loadScoresError:"A classificação está temporariamente indisponível. Tente novamente.", requestTimeout:"A solicitação da classificação expirou.", nameTooShort:"Digite pelo menos 2 caracteres.", sending:"Enviando…", submitSuccess:"Sua pontuação entrou no jardim!", submitError:"Não foi possível enviar sua pontuação.", sessionError:"Não foi possível verificar sua sessão de jogo." },
    fr: { rank:"Rang", plant:"Plante", leaderboardEmpty:"Aucun score pour le moment. Soyez le premier jardinier !", loadingScores:"Chargement des scores…", loadScoresError:"Le classement est temporairement indisponible. Réessayez.", requestTimeout:"La demande de classement a expiré.", nameTooShort:"Saisissez au moins 2 caractères.", sending:"Envoi…", submitSuccess:"Votre score a rejoint le jardin !", submitError:"Votre score n'a pas pu être envoyé.", sessionError:"Votre session de jeu n'a pas pu être vérifiée." },
    de: { rank:"Rang", plant:"Pflanze", leaderboardEmpty:"Noch keine Punkte. Sei der erste Gärtner!", loadingScores:"Punktestände werden geladen…", loadScoresError:"Die Bestenliste ist vorübergehend nicht verfügbar. Versuche es erneut.", requestTimeout:"Die Anfrage an die Bestenliste ist abgelaufen.", nameTooShort:"Gib mindestens 2 Zeichen ein.", sending:"Wird gesendet…", submitSuccess:"Dein Ergebnis ist jetzt im Garten!", submitError:"Dein Ergebnis konnte nicht gesendet werden.", sessionError:"Deine Spielsitzung konnte nicht überprüft werden." },
    ru: { rank:"Место", plant:"Растение", leaderboardEmpty:"Результатов пока нет. Станьте первым садовником!", loadingScores:"Загрузка результатов…", loadScoresError:"Таблица лидеров временно недоступна. Попробуйте снова.", requestTimeout:"Время запроса таблицы лидеров истекло.", nameTooShort:"Введите не менее 2 символов.", sending:"Отправка…", submitSuccess:"Ваш результат добавлен в сад!", submitError:"Не удалось отправить результат.", sessionError:"Не удалось проверить игровую сессию." }
  };
  for (const [language, copy] of Object.entries(LEADERBOARD_COPY)) {
    Object.assign(TRANSLATIONS[language], copy);
  }
  let currentLanguage = "en";
  function stageMeta(stage){const base=STAGE_META[stage-1],localized=LOCALIZED_STAGES[currentLanguage]?.[stage-1];return localized?{...base,name:localized[0],line:localized[1]}:base;}
  function localizeGameOver(text) {
    overlayEl.querySelectorAll("[data-i18n]").forEach(el => {
      const value = text[el.dataset.i18n];
      if (value) el.textContent = value;
    });
    playerNameEl.placeholder = text.yourName;
    if (currentStage) {
      const overlayStage = overlayEl.hidden ? currentStage : stageFor(Math.max(2, maxValueReached));
      const mode = overlayEl.dataset.mode;
      finalWorldEl.textContent = !overlayEl.hidden && mode === "milestone"
        ? text.milestoneKicker
        : !overlayEl.hidden && mode === "victory"
          ? text.victoryKicker
          : stageMeta(overlayStage).name;
    }
  }
  function applyLanguage(language){
    currentLanguage=TRANSLATIONS[language]?language:"en";const text=TRANSLATIONS[currentLanguage];
    document.documentElement.lang=currentLanguage;languageSelect.value=currentLanguage;
    document.querySelectorAll("[data-i18n]").forEach(el=>{const value=text[el.dataset.i18n];if(value)el.textContent=value;});
    startPlayBtn.textContent=PLAY_LABELS[currentLanguage]||PLAY_LABELS.en;
    playerNameEl.placeholder=text.yourName;settingsBtn.setAttribute("aria-label",text.settings);musicVolumeEl.setAttribute("aria-label",text.music);
    performanceNoteEl.textContent=lowPowerDevice?text.balanced:text.fullDetail;
    localizeGameOver(text);
    if(currentStage)updateEvolutionUI(currentStage);
    try{localStorage.setItem("gardenEvolutionLanguage",currentLanguage);}catch(e){}
  }

  function updateEvolutionUI(stage) {
    const meta = stageMeta(stage), text=TRANSLATIONS[currentLanguage];
    stageKickerEl.textContent = currentLanguage === "tr" ? `${text.world} ${stage} / 5` : `${text.world} ${stage} ${text.of} 5`;
    stageNameEl.textContent = meta.name;
    stageNextEl.textContent = meta.next ? `${text.nextWorld} ${meta.next}` : text.fullyEvolved;
    stageFillEl.style.width = `${((stage - 1) / 4) * 100}%`;
    stageDots.forEach((dot, index) => dot.classList.toggle("active", index <= stage - 1));
  }

  /* ---------- Storage ---------- */
  function loadBest() {
    try { const v = localStorage.getItem("gardenEvolutionBest"); return v ? parseInt(v, 10) || 0 : 0; }
    catch (e) { return 0; }
  }
  function saveBest() { try { localStorage.setItem("gardenEvolutionBest", String(best)); } catch (e) {} }
  function loadPref(key, dflt) { try { const v = localStorage.getItem(key); return v === null ? dflt : v === "true"; } catch (e) { return dflt; } }
  function savePref(key, val) { try { localStorage.setItem(key, String(val)); } catch (e) {} }
  function loadPlayerName() { try { return localStorage.getItem("gardenEvolutionPlayerName") || ""; } catch (e) { return ""; } }
  function savePlayerName(name) { try { localStorage.setItem("gardenEvolutionPlayerName", name); } catch (e) {} }
  // Stable per-browser id so the leaderboard can keep one "best score" row
  // per device instead of growing forever. Not a security boundary (an
  // attacker can clear storage or fabricate a UUID) — it's a courtesy id
  // for normal players, paired server-side with session + rate limiting.
  function loadDeviceId() {
    try {
      let id = localStorage.getItem("gardenEvolutionDeviceId");
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("gardenEvolutionDeviceId", id);
      }
      return id;
    } catch (e) {
      return null;
    }
  }

  // Music volume intentionally starts fresh on every page load.
  let musicVolume = 100;
  let musicOn = true;
  let pianoOn = loadPref("gardenEvolutionComboPiano", true);
  let sfxOn = loadPref("gardenEvolutionSfx", true);
  let motionOn = loadPref("gardenEvolutionMotion", true);
  let particlesOn = loadPref("gardenEvolutionParticles", true);
  let contrastOn = loadPref("gardenEvolutionContrast", false);

  /* ---------- Layout ----------
     Single source of truth: CSS provides --gap and the board is square with
     padding = --gap. The inner play area (tiles container) is inset by --gap,
     so its width = boardWidth - 2*gap. Each cell = (inner - 3*gap)/4.
     Tiles are absolutely positioned with width/height = cellSize and
     translate by gap + c*(cellSize+gap). This guarantees exact alignment.
  */
  function readGap() {
    gap = parseFloat(getComputedStyle(boardEl).getPropertyValue("--gap")) || 10;
  }
  function measure() {
    readGap();
    const inner = boardEl.clientWidth - 2 * gap;
    cellSize = (inner - 3 * gap) / 4;
  }
  function cellPos(r, c) {
    // Keep settled tiles on the physical pixel grid. Fractional CSS transforms
    // can leave a pixel-art PNG on a bilinear compositing layer, which made an
    // occasional seed look softer depending on the cell and viewport width.
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const snap = value => Math.round(value * dpr) / dpr;
    return {
      x: snap(c * (cellSize + gap)),
      y: snap(r * (cellSize + gap))
    };
  }
  function applyLayout() {
    measure();
    Object.keys(tiles).forEach(id => {
      const t = tiles[id];
      if (!t) return;
      const p = cellPos(t.r, t.c);
      t.el.style.transition = "none";
      t.el.style.width = cellSize + "px";
      t.el.style.height = cellSize + "px";
      t.el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      const num = t.el.querySelector(".t-num");
      if (num) num.style.fontSize = Math.max(9, cellSize * 0.13) + "px";
    });
    void tilesEl.offsetWidth;
    Object.keys(tiles).forEach(id => { if (tiles[id] && tiles[id].el) tiles[id].el.style.transition = ""; });
  }

  /* ---------- Rendering ---------- */
  function renderTileContent(el, value) {
    const lvl = levelFor(value);
    const sprite = Number.isInteger(lvl.sprite) ? lvl.sprite : LEVELS.length - 1;
    el.dataset.value = value;
    el.dataset.tier = sprite + 1;
    el.style.background = lvl.bg;
    el.style.setProperty("--fg", lvl.fg);
    el.setAttribute("aria-label", `${lvl.name}, ${value}`);
    el.classList.toggle("glow", value >= 512);
    el.classList.toggle("golden", value >= 2048);
    const assetValue = LEVELS[sprite]?.v || 8192;
    el.innerHTML = `<img class="tile-art" src="/assets/tiles/v3/tile-${assetValue}.png" alt="" aria-hidden="true" draggable="false"><span class="t-num">${value}</span>`;
    // Critical containment is repeated inline so a stale stylesheet can never
    // let a newly-rendered sprite escape its tile while caches are refreshing.
    el.style.overflow = "hidden";
    const art = el.querySelector(".tile-art");
    Object.assign(art.style, {
      position: "absolute",
      inset: "4% 4% 9%",
      width: "92%",
      height: "87%",
      objectFit: "contain",
      objectPosition: "center",
      imageRendering: "pixelated",
      display: "block",
      pointerEvents: "none"
    });
  }

  function createTile(r, c, value, isNew) {
    const id = nextId++;
    const el = document.createElement("div");
    el.className = "tile";
    if (isNew) el.classList.add("spawn");
    renderTileContent(el, value);
    const p = cellPos(r, c);
    const tx = `translate(${p.x}px, ${p.y}px)`;
    el.style.setProperty("--tx", tx);
    el.style.width = cellSize + "px";
    el.style.height = cellSize + "px";
    el.style.transform = tx;
    tilesEl.appendChild(el);
    if (isNew && !reduceMotion) {
      el.addEventListener("animationend", () => el.classList.remove("spawn"), { once: true });
    } else {
      el.classList.remove("spawn");
    }
    tiles[id] = { value, r, c, el };
    grid[r][c] = id;
    return id;
  }

  function positionTile(id, r, c) {
    const t = tiles[id];
    if (!t) return;
    t.r = r; t.c = c;
    const p = cellPos(r, c);
    const tx = `translate(${p.x}px, ${p.y}px)`;
    t.el.style.setProperty("--tx", tx);
    t.el.style.transform = tx;
  }

  /* ---------- Game logic (unchanged 2048 rules) ---------- */
  function emptyCells() {
    const out = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (grid[r][c] == null) out.push([r, c]);
    return out;
  }

  function spawn() {
    const empty = emptyCells();
    if (!empty.length) return null;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    maxValueReached = Math.max(maxValueReached, value);
    return createTile(r, c, value, true);
  }

  function linesFor(dir) {
    const lines = [];
    if (dir === "left" || dir === "right") {
      for (let r = 0; r < SIZE; r++) {
        const cols = dir === "left" ? [0, 1, 2, 3] : [3, 2, 1, 0];
        lines.push(cols.map(c => ({ r, c })));
      }
    } else {
      for (let c = 0; c < SIZE; c++) {
        const rows = dir === "up" ? [0, 1, 2, 3] : [3, 2, 1, 0];
        lines.push(rows.map(r => ({ r, c })));
      }
    }
    return lines;
  }

  function move(dir) {
    if (menuMode || !restartPanel.hidden || !settingsPanel.hidden || !leaderboardModalEl.hidden || !overlayEl.hidden) return;
    if (busy) {
      // Keep the newest intention so fast key presses and mobile swipes never feel lost.
      queuedDirection = dir;
      return;
    }
    const lines = linesFor(dir);
    let moved = false;
    const slides = [];
    const merges = [];
    const newGrid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

    lines.forEach(line => {
      const ids = [];
      line.forEach(({ r, c }) => { const id = grid[r][c]; if (id != null) ids.push(id); });
      let write = 0;
      let i = 0;
      while (i < ids.length) {
        const id = ids[i];
        const next = ids[i + 1];
        const dest = line[write];
        if (next && canMergeValues(tiles[id].value, tiles[next].value)) {
          const newVal = tiles[id].value * 2;
          merges.push({ survivor: id, absorbed: next, value: newVal, r: dest.r, c: dest.c });
          slides.push({ id, r: dest.r, c: dest.c });
          slides.push({ id: next, r: dest.r, c: dest.c });
          newGrid[dest.r][dest.c] = id;
          moved = true;
          i += 2;
          write++;
        } else {
          slides.push({ id, r: dest.r, c: dest.c });
          if (tiles[id].r !== dest.r || tiles[id].c !== dest.c) moved = true;
          newGrid[dest.r][dest.c] = id;
          i++;
          write++;
        }
      }
    });

    if (!moved) return;
    busy = true;
    grid = newGrid;

    slides.forEach(s => positionTile(s.id, s.r, s.c));

    const generation = gameGeneration;
    const finalize = () => {
      if (generation !== gameGeneration) {
        return;
      }
      completedMoves++;
      let stageAdvancePending = false;
      let endingPending = null;
      updateCombo(merges.length);
      merges.forEach(m => {
        if (tiles[m.absorbed]) { tiles[m.absorbed].el.remove(); delete tiles[m.absorbed]; }
        const t = tiles[m.survivor];
        if (!t) return;
        t.value = m.value;
        renderTileContent(t.el, m.value);
        t.el.classList.add("merge");
        setTimeout(() => t.el && t.el.classList.remove("merge"), MERGE_MS);
        emitParticles(m.r, m.c, m.value);
        score += m.value;
        playMerge(m.value);
        if (m.value > maxValueReached) {
          maxValueReached = m.value;
          stageAdvancePending = true;
        }
        const ending = endingForMergedValue(m.value);
        if (ending === "milestone" && !goldenAchieved) {
          goldenAchieved = true;
          endingPending = "milestone";
          celebrate();
        }
        if (ending === "victory" && !victoryAchieved) {
          victoryAchieved = true;
          endingPending = "victory";
        }
      });
      pulseGameEnergy(merges.length);
      updateScore();
      // 8192 is the official ending. Do not add another random tile after the
      // winning merge; freeze the exact completed board behind the final card.
      if (endingPending !== "victory") spawn();
      if (endingPending === "victory") showGameOver("victory");
      else if (isGameOver()) showGameOver("noMoves");
      else if (endingPending === "milestone") showMilestone();
      // Keep scene creation/theme work off the merge-finalization frame. The
      // tile update and its forced animation layouts finish first.
      if (stageAdvancePending) requestAnimationFrame(maybeEvolveEnvironment);
      busy = false;
      const nextMove = queuedDirection;
      queuedDirection = null;
      if (nextMove && !overlayEl.classList.contains("show") && !victoryAchieved) {
        requestAnimationFrame(() => move(nextMove));
      }
    };

    if (reduceMotion) finalize();
    else setTimeout(finalize, SLIDE_MS);
  }

  function isGameOver() {
    if (emptyCells().length) return false;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const v = tiles[grid[r][c]].value;
        if (c + 1 < SIZE && tiles[grid[r][c + 1]].value === v) return false;
        if (r + 1 < SIZE && tiles[grid[r + 1][c]].value === v) return false;
      }
    }
    return true;
  }

  function updateScore() {
    scoreEl.textContent = score;
    if (score > best) { best = score; saveBest(); }
    bestEl.textContent = best;
  }

  function resetCombo() {
    combo = 0;
    bloomFlow.reset();
    comboHudEl.hidden = true;
    coolFlow();
  }

  function publishFlow(value) {
    flow = value;
    comboHudEl.querySelector("i").style.transform = `scaleX(${flow / 8})`;
    window.dispatchEvent(new CustomEvent("garden:combo", { detail: { combo: flow } }));
  }

  function coolFlow() {
    clearTimeout(flowTimer);
    flowTimer = null;
    bloomFlow.cool();
    publishFlow(0);
  }

  function tickFlow() {
    flowTimer = null;
    const next = bloomFlow.level(performance.now());
    if (next !== flow) publishFlow(next);
    // At most five small updates per second, only while energy remains.
    if (next > 0) flowTimer = setTimeout(tickFlow, 200);
  }

  function updateCombo(mergeCount) {
    const previousFlow = bloomFlow.level(performance.now());
    const state = bloomFlow.move(mergeCount, performance.now());
    combo = state.streak;
    bestCombo = state.best;
    comboValueEl.textContent = `${combo}×`;
    comboHudEl.hidden = combo < 2;
    publishFlow(state.flow);
    if (mergeCount > 0) playComboPiano(state.streak, mergeCount);
    if ([3, 5, 8].some(tier => previousFlow < tier && state.flow >= tier)) triggerWorldEvent(currentStage, true);
    if (document.hidden || !restartPanel.hidden || !settingsPanel.hidden || !leaderboardModalEl.hidden) coolFlow();
    else if (flowTimer === null && flow > 0) flowTimer = setTimeout(tickFlow, 200);
  }

  function pulseGameEnergy(mergeCount) {
    if (reduceMotion || mergeCount < 1) return;
    scoreEl.getAnimations().forEach(animation => animation.cancel());
    boardEl.getAnimations().forEach(animation => animation.cancel());
    scoreEl.animate([
      { transform:"scale(1)" },{ transform:"scale(1.28)", offset:.45 },{ transform:"scale(1)" }
    ], { duration:240, easing:"cubic-bezier(.2,1.7,.35,1)" });
    const strong = mergeCount > 1;
    boardEl.animate([
      { transform:"scale(1)", filter:"saturate(1)" },
      { transform:`scale(${strong ? 1.012 : 1.006})`, filter:`saturate(${strong ? 1.08 : 1})`, offset:strong ? .42 : .48 },
      { transform:"scale(1)", filter:"saturate(1)" }
    ], { duration:strong ? 250 : 220, easing:"ease-out" });
  }

  function emitEndingParticles(artEl) {
    artEl.querySelectorAll(".milestone-mote").forEach(node => node.remove());
    if (reduceMotion || !particlesOn) return;
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

  function showEndOverlay(mode) {
    coolFlow();
    const text = TRANSLATIONS[currentLanguage];
    const milestone = mode === "milestone";
    finalTitleEl.dataset.i18n = milestone ? "milestoneTitle" : mode === "victory" ? "victoryTitle" : "noMoves";
    finalExplanationEl.dataset.i18n = milestone ? "milestoneText" : mode === "victory" ? "victoryText" : "noMovesText";
    scoreFormLabelEl.dataset.i18n = mode === "victory" ? "saveFinalScore" : "joinLeaderboard";
    finalScoreLabelEl.dataset.i18n = milestone ? "currentScore" : "final";
    overlayEl.dataset.mode = mode;
    localizeGameOver(text);
    const endingStage = stageFor(Math.max(2, maxValueReached));
    finalScoreEl.textContent = Number(score).toLocaleString(currentLanguage);
    finalBestEl.textContent = Number(best).toLocaleString(currentLanguage);
    finalWorldEl.textContent = milestone ? text.milestoneKicker : mode === "victory" ? text.victoryKicker : stageMeta(endingStage).name;
    finalTileEl.textContent = Number(maxValueReached || 2).toLocaleString(currentLanguage);
    finalComboEl.textContent = `${bestCombo || 0}×`;
    finalEmblemEl.textContent = stageMeta(endingStage).emblem;
    playerNameEl.value = loadPlayerName();
    scoreFormEl.hidden = milestone;
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
    clearTimeout(showEndOverlay._readyTimer);
    showEndOverlay._readyTimer = setTimeout(() => {
      overlayEl.classList.add("ready");
      (milestone ? continueMilestoneBtn : playerNameEl).focus();
    }, milestone ? 350 : 850);
    if (!milestone) playGameOver();
  }
  function showGameOver(mode = "noMoves") { showEndOverlay(mode); }
  function showMilestone() { showEndOverlay("milestone"); }
  function hideGameOver() {
    clearTimeout(showEndOverlay._readyTimer);
    overlayEl.classList.remove("ready");
    overlayEl.classList.remove("show");
    overlayEl.hidden = true;
  }

  let leaderboardLoading = null;
  let leaderboardCache = null;

  // Signed play session used for leaderboard anti-cheat. Requested when a
  // new game starts (see newGame()) so its issue time reflects actual play
  // duration, not "however long it took to open the submit form".
  let gameSession = null;
  let gameSessionPromise = null;
  async function ensureGameSession() {
    if (gameSessionPromise) return gameSessionPromise;
    gameSessionPromise = (async () => {
      try {
        const response = await fetch("/api/session", {
          method: "POST",
          headers: { accept: "application/json" }
        });
        if (!response.ok) throw new Error("session_failed");
        gameSession = await response.json();
        return gameSession;
      } catch (error) {
        gameSession = null;
        gameSessionPromise = null;
        throw new Error(TRANSLATIONS[currentLanguage].sessionError);
      }
    })();
    return gameSessionPromise;
  }
  function renderLeaderboardEntries(entries) {
    const text = TRANSLATIONS[currentLanguage];
    if (!entries.length) {
      leaderboardListEl.innerHTML = `<p class="leaderboard-message">${text.leaderboardEmpty}</p>`;
      return;
    }
    leaderboardListEl.innerHTML = "";
    entries.forEach((entry, index) => {
      const row = document.createElement("div");
      row.className = "leaderboard-entry" + (index < 3 ? " top" : "");
      row.dataset.rank = String(index + 1);
      const rank = document.createElement("span");
      rank.className = "leaderboard-rank";
      rank.textContent = String(index + 1);
      rank.setAttribute("aria-label", `${text.rank} ${index + 1}`);
      const player = document.createElement("div");
      player.className = "leaderboard-player";
      const name = document.createElement("strong");
      name.textContent = entry.player_name;
      const detail = document.createElement("small");
      detail.textContent = `${text.world} ${entry.reached_stage} · ${text.plant} ${entry.max_tile} · ${entry.best_combo || 0}× ${text.combo}`;
      player.append(name, detail);
      const points = document.createElement("span");
      points.className = "leaderboard-score";
      points.textContent = Number(entry.score).toLocaleString(currentLanguage);
      row.append(rank, player, points);
      leaderboardListEl.appendChild(row);
    });
  }

  async function fetchLeaderboard() {
    const text = TRANSLATIONS[currentLanguage];
    if (leaderboardCache && Date.now() - leaderboardCache.time < 30000) {
      renderLeaderboardEntries(leaderboardCache.entries);
      return;
    }
    if (leaderboardLoading) return leaderboardLoading;
    leaderboardListEl.innerHTML = `<p class="leaderboard-message">${text.loadingScores}</p>`;
    leaderboardLoading = (async () => { try {
      const response = await leaderboardRequest({ headers: { accept: "application/json" } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("leaderboard_load_failed");
      const entries = Array.isArray(data.entries) ? data.entries : [];
      leaderboardCache = { time: Date.now(), entries };
      renderLeaderboardEntries(entries);
    } catch (error) {
      const message = error.name === "AbortError" ? text.requestTimeout : text.loadScoresError;
      leaderboardListEl.innerHTML = `<p class="leaderboard-message">${message}</p>`;
    } finally { leaderboardLoading = null; } })();
    return leaderboardLoading;
  }

  async function leaderboardRequest(options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const requestOptions = { ...options, signal: controller.signal };
      const response = await fetch("/api/leaderboard", requestOptions);
      const type = response.headers.get("content-type") || "";
      if (!type.includes("application/json")) {
        throw new Error("Leaderboard is temporarily unavailable.");
      }
      return response;
    } finally { clearTimeout(timeout); }
  }

  function openLeaderboard() {
    closeRestart(false);
    coolFlow();
    queuedDirection = null;
    leaderboardModalEl.hidden = false;
    document.body.style.overflow = "hidden";
    fetchLeaderboard();
    requestAnimationFrame(() => leaderboardCloseBtn.focus());
  }

  function closeLeaderboard() {
    leaderboardModalEl.hidden = true;
    document.body.style.overflow = "";
    const returnTarget = !startScreenEl.hidden ? startLeaderboardBtn : leaderboardBtn;
    returnTarget.focus();
  }

  function confirmLowerScore(currentScore, newScore) {
    const copy = LOWER_SCORE_COPY[currentLanguage] || LOWER_SCORE_COPY.en;
    lowerScoreTitleEl.textContent = copy[0];
    lowerScoreMessageEl.textContent = copy[1]
      .replace("{newScore}", Number(newScore).toLocaleString())
      .replace("{currentScore}", Number(currentScore).toLocaleString());
    cancelLowerScoreBtn.textContent = copy[2];
    confirmLowerScoreBtn.textContent = copy[3];
    lowerScoreConfirmEl.hidden = false;
    document.body.classList.add("score-confirm-open");
    window.dispatchEvent(new CustomEvent("garden:score-confirm", { detail: { open: true } }));
    confirmLowerScoreBtn.focus();
    return new Promise(resolve => {
      const finish = accepted => {
        lowerScoreConfirmEl.hidden = true;
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
    const playerName = playerNameEl.value.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, 16);
    const text = TRANSLATIONS[currentLanguage];
    if (playerName.length < 2) {
      scoreSubmitStatusEl.textContent = text.nameTooShort;
      playerNameEl.focus();
      return;
    }
    submitScoreBtn.disabled = true;
    submitScoreBtn.textContent = text.sending;
    scoreSubmitStatusEl.textContent = "";
    try {
      const session = await ensureGameSession();
      const deviceId = loadDeviceId();
      const payload = {
          playerName,
          score,
          maxTile: Math.max(2, maxValueReached),
          bestCombo,
          comboRules: 2,
          reachedStage: currentStage,
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
        const accepted = await confirmLowerScore(data.currentScore, score);
        if (!accepted) {
          submitScoreBtn.disabled = false;
          submitScoreBtn.textContent = TRANSLATIONS[currentLanguage].submit;
          scoreSubmitStatusEl.textContent = "";
          return;
        }
        response = await send(true);
        data = await response.json().catch(() => ({}));
      }
      if (!response.ok) throw new Error("score_submit_failed");
      scoreSubmitted = true;
      leaderboardCache = null;
      savePlayerName(data.playerName || playerName);
      playerNameEl.value = "";
      scoreFormEl.classList.add("success");
      scoreSubmitStatusEl.textContent = text.submitSuccess;
      setTimeout(openLeaderboard, 550);
    } catch (error) {
      submitScoreBtn.disabled = false;
      submitScoreBtn.textContent = text.submit;
      scoreSubmitStatusEl.textContent = error.message === "score_submit_failed" ? text.submitError : (error.message || text.submitError);
    }
  }

  /* ---------- Particles (board-local, transient) ---------- */
  function emitParticles(r, c, value) {
    if (reduceMotion || !particlesOn) return;
    const p = cellPos(r, c);
    const cx = p.x + cellSize / 2;
    const cy = p.y + cellSize / 2;
    const count = value >= 1024 ? 10 : value >= 256 ? 7 : 5;
    const golden = value >= 2048;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement("div");
      const stageParticle = ["stage-snow", "stage-leaf", "stage-pollen", "stage-petal", "stage-star"][Math.max(0, currentStage - 1)];
      dot.className = `particle ${stageParticle}` + (golden ? " gold" : "");
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.6;
      const dist = cellSize * (0.35 + Math.random() * 0.35);
      dot.style.setProperty("--dx", Math.cos(ang) * dist + "px");
      dot.style.setProperty("--dy", Math.sin(ang) * dist - cellSize * 0.15 + "px");
      dot.style.left = cx + "px";
      dot.style.top = cy + "px";
      tilesEl.appendChild(dot);
      dot.addEventListener("animationend", () => dot.remove(), { once: true });
    }
  }

  /* ---------- Golden Tree celebration ---------- */
  function celebrate() {
    showToast("The Sakura Crown has bloomed!");
    playGolden();
    if (reduceMotion) return;
    boardEl.classList.add("celebrate");
    setTimeout(() => boardEl.classList.remove("celebrate"), 1600);
    const cx = tilesEl.clientWidth / 2;
    const cy = tilesEl.clientHeight / 2;
    for (let i = 0; i < 22; i++) {
      const dot = document.createElement("div");
      dot.className = "particle gold big";
      const ang = Math.random() * Math.PI * 2;
      const dist = boardEl.clientWidth * (0.25 + Math.random() * 0.3);
      dot.style.setProperty("--dx", Math.cos(ang) * dist + "px");
      dot.style.setProperty("--dy", Math.sin(ang) * dist + "px");
      dot.style.left = cx + "px";
      dot.style.top = cy + "px";
      tilesEl.appendChild(dot);
      dot.addEventListener("animationend", () => dot.remove(), { once: true });
    }
    triggerEnvGust(true);
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    requestAnimationFrame(() => toastEl.classList.add("show"));
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toastEl.classList.remove("show");
      setTimeout(() => (toastEl.hidden = true), 300);
    }, 2400);
  }

  /* ============================================================
     AUDIO â€” procedural Web Audio
     - Warm, layered merge sound (low body + woody transient + airy poof + tonal accent)
     - Procedural ambient music with stage variations
     - Separate Music / SFX toggles
     ============================================================ */
  let audioCtx = null;
  let masterGain = null;
  let musicBus = null;
  let ambientBus = null;
  let sfxBus = null;
  const GAMEPLAY_MUSIC_GAIN = 0.62;
  const AMBIENT_VOLUME_BOOST = 2;

  function ensureAudio() {
    if (audioCtx) {
      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
      return;
    }
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.9;
      masterGain.connect(audioCtx.destination);
      musicBus = audioCtx.createGain();
      musicBus.gain.value = GAMEPLAY_MUSIC_GAIN * (musicVolume / 100);
      musicBus.connect(masterGain);
      ambientBus = audioCtx.createGain();
      // The calm procedural bed is intentionally twice its previous level.
      // Combo piano stays connected to musicBus directly and is unaffected.
      ambientBus.gain.value = AMBIENT_VOLUME_BOOST;
      ambientBus.connect(musicBus);
      sfxBus = audioCtx.createGain();
      sfxBus.gain.value = sfxOn ? 1 : 0;
      sfxBus.connect(masterGain);
    } catch (e) { audioCtx = null; }
  }

  /* ---- SFX building blocks ---- */
  function envNode(g, t0, attack, decay, peak) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  // Short low-frequency rounded body (sine, fast decay)
  function bodySound(freq, dur, vol, t0) {
    if (!audioCtx || !sfxOn) return;
    const t = t0 + 0.001;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.7, t + dur);
    envNode(g, t, 0.006, dur, vol);
    o.connect(g).connect(sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // Woody / plucked transient (triangle with fast pitch drop + lowpass)
  function woodySound(freq, dur, vol, t0) {
    if (!audioCtx || !sfxOn) return;
    const t = t0 + 0.004;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    const lp = audioCtx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 1400;
    o.type = "triangle";
    o.frequency.setValueAtTime(freq * 2.2, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.8, t + dur);
    envNode(g, t, 0.003, dur, vol);
    o.connect(lp).connect(g).connect(sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // Soft airy poof (filtered noise burst)
  function poofSound(dur, vol, t0) {
    if (!audioCtx || !sfxOn) return;
    const t = t0 + 0.002;
    const len = Math.floor(audioCtx.sampleRate * dur);
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const bp = audioCtx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 700; bp.Q.value = 0.7;
    const g = audioCtx.createGain();
    envNode(g, t, 0.004, dur, vol);
    src.connect(bp).connect(g).connect(sfxBus);
    src.start(t); src.stop(t + dur + 0.03);
  }

  // Pleasant tonal accent (soft sine, short)
  function accentSound(freq, dur, vol, t0) {
    if (!audioCtx || !sfxOn) return;
    const t = t0 + 0.006;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, t);
    envNode(g, t, 0.01, dur, vol);
    o.connect(g).connect(sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // Short harmonic shimmer (two detuned sines, higher register)
  function shimmerSound(freq, dur, vol, t0) {
    if (!audioCtx || !sfxOn) return;
    const t = t0 + 0.008;
    [1, 1.5].forEach((mult, idx) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq * mult * (1 + idx * 0.003), t);
      envNode(g, t, 0.015, dur, vol * (idx ? 0.5 : 1));
      o.connect(g).connect(sfxBus);
      o.start(t); o.stop(t + dur + 0.06);
    });
  }

  function playMerge(v) {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    const log = Math.log2(v);
    // Warm low body â€” lower for higher values
    const bodyFreq = 150 - Math.min(60, log * 5);
    bodySound(bodyFreq, 0.16, 0.32, t0);
    // Woody transient â€” slightly higher pitch for small merges
    woodySound(260 + log * 18, 0.09, 0.14, t0);
    // Airy poof
    poofSound(0.12, 0.06, t0);

    if (v >= 2048) {
      // Golden: richer, elegant â€” deep body + warm shimmer + tonal bloom
      bodySound(90, 0.28, 0.3, t0);
      accentSound(523.25, 0.5, 0.1, t0);          // C5
      accentSound(659.25, 0.5, 0.08, t0 + 0.05);  // E5
      accentSound(783.99, 0.6, 0.07, t0 + 0.1);   // G5
      shimmerSound(1046.5, 0.7, 0.06, t0 + 0.12); // C6 shimmer
    } else if (v >= 1024) {
      // High: deeper impact + short harmonic shimmer
      accentSound(440 + log * 12, 0.22, 0.09, t0 + 0.01);
      shimmerSound(660 + log * 10, 0.3, 0.06, t0 + 0.02);
    } else if (v >= 128) {
      // Medium: fuller woody impact + gentle tone
      accentSound(330 + log * 14, 0.18, 0.08, t0 + 0.01);
    } else {
      // Low: small soft pop â€” just body + poof + faint accent
      accentSound(440, 0.1, 0.04, t0 + 0.005);
    }
  }

  function playGolden() {
    if (!audioCtx) return;
    // Rich but elegant ascending chord with warm body
    const t0 = audioCtx.currentTime;
    bodySound(80, 0.5, 0.28, t0);
    [392, 523.25, 659.25, 783.99].forEach((f, i) => accentSound(f, 0.8 - i * 0.05, 0.09 - i * 0.005, t0 + i * 0.07));
    shimmerSound(1046.5, 1.0, 0.05, t0 + 0.2);
  }

  function playGameOver() {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    [330, 277, 220].forEach((f, i) => {
      accentSound(f, 0.6, 0.1, t0 + i * 0.16);
      bodySound(f * 0.5, 0.5, 0.12, t0 + i * 0.16);
    });
  }

  /* ============================================================
     AMBIENT MUSIC â€” slow procedural pad + occasional pentatonic notes
     The same lightweight system now runs through every gameplay stage.
     Combo energy is deliberately kept out of the bed; its only musical
     response is the separate rising piano accent below.
     ============================================================ */
  let musicTimer = null;
  let musicRunning = false;
  let menuMode = !startScreenEl.hidden;
  const menuMusic = new Audio("/assets/audio/bit-forest-intro.mp3");
  menuMusic.loop = true;
  menuMusic.preload = "auto";
  menuMusic.autoplay = true;
  menuMusic.playsInline = true;
  menuMusic.volume = 0.38 * (musicVolume / 100);

  function stopProceduralMusic() {
    musicRunning = false;
    if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
  }

  function startMenuMusic() {
    if (!menuMode || !musicOn) return;
    stopMusic();
    // Browsers may reject autoplay until the first real user gesture. The
    // global audio-unlock handler retries from that gesture without errors.
    menuMusic.play().catch(() => {});
  }

  function stopMenuMusic(reset = false) {
    menuMusic.pause();
    if (reset) {
      try { menuMusic.currentTime = 0; } catch (_) {}
    }
  }

  // Pentatonic scales per stage (C-based, relaxing)
  const STAGE_SCALES = [
    [261.63, 311.13, 349.23, 392, 466.16],               // stage1: C minor pent (soft morning)
    [293.66, 349.23, 392, 440, 523.25],                  // stage2: D pent (blooming)
    [261.63, 293.66, 329.63, 392, 440],                  // stage3: C major pent (rich green)
    [220, 261.63, 293.66, 329.63, 392],                  // stage4: A minor pent (warm sunset)
    [261.63, 329.63, 392, 466.16, 523.25]                // stage5: C sus pent (magical)
  ];
  const MUSIC_PROFILES = [
    { bpm: 58, density: 0.35, pad: 0.038, bell: 0.022, pulse: 0 },
    { bpm: 68, density: 0.48, pad: 0.042, bell: 0.026, pulse: 0.012 },
    { bpm: 78, density: 0.62, pad: 0.046, bell: 0.029, pulse: 0.018 },
    { bpm: 92, density: 0.78, pad: 0.05, bell: 0.032, pulse: 0.024 },
    { bpm: 106, density: 0.94, pad: 0.054, bell: 0.036, pulse: 0.032 }
  ];

  function playPad(freq, dur, vol, t0) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const o2 = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    const lp = audioCtx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 900;
    o.type = "sine"; o2.type = "sine";
    o.frequency.value = freq; o2.frequency.value = freq * 1.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    o.connect(lp); o2.connect(lp); lp.connect(g).connect(ambientBus);
    o.start(t0); o2.start(t0); o.stop(t0 + dur + 0.1); o2.stop(t0 + dur + 0.1);
  }

  function playBell(freq, dur, vol, t0) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ambientBus);
    o.start(t0); o.stop(t0 + dur + 0.1);
  }

  function playPluck(freq, dur, vol, t0) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    const lp = audioCtx.createBiquadFilter();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq, t0);
    lp.type = "lowpass"; lp.frequency.value = 1250;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(lp).connect(g).connect(ambientBus);
    o.start(t0); o.stop(t0 + dur + 0.04);
  }

  // A compact piano-like voice built from two harmonics. It is generated on
  // demand, so the combo feedback adds no audio file or download overhead.
  function pianoNote(freq, velocity, t0) {
    if (!audioCtx || !musicOn) return;
    const tone = audioCtx.createOscillator();
    const overtone = audioCtx.createOscillator();
    const toneGain = audioCtx.createGain();
    const overtoneGain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    const output = audioCtx.createGain();
    tone.type = "triangle";
    overtone.type = "sine";
    tone.frequency.setValueAtTime(freq, t0);
    overtone.frequency.setValueAtTime(freq * 2.01, t0);
    toneGain.gain.value = 0.82;
    overtoneGain.gain.value = 0.18;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(Math.min(5200, 1500 + freq * 3), t0);
    filter.frequency.exponentialRampToValueAtTime(850, t0 + 0.9);
    output.gain.setValueAtTime(0.0001, t0);
    output.gain.exponentialRampToValueAtTime(velocity, t0 + 0.008);
    output.gain.exponentialRampToValueAtTime(velocity * 0.34, t0 + 0.13);
    output.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.05);
    tone.connect(toneGain).connect(filter);
    overtone.connect(overtoneGain).connect(filter);
    filter.connect(output).connect(musicBus);
    tone.start(t0);
    overtone.start(t0);
    tone.stop(t0 + 1.1);
    overtone.stop(t0 + 1.1);
  }

  function playComboPiano(streak, mergeCount) {
    if (!audioCtx || audioCtx.state !== "running" || !musicOn || !pianoOn || streak < 1) return;
    const scale = STAGE_SCALES[Math.max(0, currentStage - 1)];
    const step = Math.min(14, streak - 1);
    const octave = Math.floor(step / scale.length);
    const note = scale[step % scale.length] * Math.pow(2, octave);
    const velocity = Math.min(0.105, 0.055 + step * 0.004);
    const now = audioCtx.currentTime + 0.055;
    pianoNote(note, velocity, now);
    // Multiple merges earn a quiet harmony without turning the calm bed into
    // a busy melody.
    if (mergeCount > 1) {
      const harmony = scale[(step + 2) % scale.length] * Math.pow(2, octave);
      pianoNote(harmony, velocity * 0.58, now + 0.07);
    }
  }

  function playPulse(freq, vol, t0) {
    if (!audioCtx || vol <= 0) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    o.connect(g).connect(ambientBus);
    o.start(t0); o.stop(t0 + 0.22);
  }

  function playStageRise(stage) {
    if (!audioCtx || !musicOn || stage <= 1) return;
    const scale = STAGE_SCALES[stage - 1];
    const t0 = audioCtx.currentTime + 0.04;
    [0, 1, 2, 4].forEach((index, i) => {
      playPluck(scale[index] * (stage >= 4 ? 2 : 1), 0.7, 0.045 + stage * 0.004, t0 + i * 0.12);
    });
    playPad(scale[0] * 0.5, 2.8, 0.055, t0);
    if (stage === 5) playBell(scale[4] * 2, 2.2, 0.055, t0 + 0.55);
  }

  function musicStep() {
    if (!audioCtx || audioCtx.state !== "running" || !musicOn) return;
    const stage = Math.max(1, currentStage || 1);
    const scale = STAGE_SCALES[stage - 1];
    const profile = MUSIC_PROFILES[stage - 1];
    const t0 = audioCtx.currentTime;
    const beat = 60 / profile.bpm;
    // The garden gains harmony, rhythm and octave range with every world.
    const root = scale[0] * 0.5;
    playPad(root, beat * 4.2, profile.pad, t0);
    if (stage >= 2) playPad(scale[2] * 0.5, beat * 4, profile.pad * 0.62, t0 + beat * 0.25);
    if (Math.random() < profile.density) {
      const note = scale[Math.floor(Math.random() * scale.length)];
      playBell(note, beat * 1.8, profile.bell, t0 + beat * (0.5 + Math.random()));
    }
    if (stage >= 2) {
      const pattern = stage >= 4 ? [0, 2, 1, 4] : [0, 1, 2];
      pattern.slice(0, stage - 1).forEach((index, i) => {
        playPluck(scale[index], beat * 0.7, 0.012 + stage * 0.003, t0 + beat * (i + 0.75));
      });
    }
    if (stage >= 3) {
      const pulses = stage === 3 ? 2 : 4;
      for (let i = 0; i < pulses; i++) playPulse(root, profile.pulse, t0 + i * beat);
    }
    if (stage >= 4 && Math.random() < profile.density) {
      playBell(scale[(Math.floor(Math.random() * 3) + 2)] * 2, beat * 1.4, profile.bell * 0.72, t0 + beat * 2.2);
    }
  }

  function startMusic() {
    if (menuMode || !audioCtx || audioCtx.state !== "running" || !musicOn) return;
    if (musicRunning) return;
    musicRunning = true;
    musicStep();
    const interval = () => (60 / MUSIC_PROFILES[Math.max(0, currentStage - 1)].bpm) * 4000;
    const tick = () => {
      if (!musicRunning || !audioCtx || audioCtx.state !== "running" || !musicOn) {
        stopMusic();
        return;
      }
      musicStep();
      musicTimer = setTimeout(tick, interval());
    };
    musicTimer = setTimeout(tick, interval());
  }
  function stopMusic() {
    stopProceduralMusic();
  }
  function setMusicVolume(value) {
    musicVolume = Math.min(100, Math.max(0, Number(value) || 0));
    musicOn = musicVolume > 0;
    menuMusic.volume = 0.38 * (musicVolume / 100);
    if (audioCtx && musicBus) musicBus.gain.value = GAMEPLAY_MUSIC_GAIN * (musicVolume / 100);
    if (!musicOn) {
      stopMenuMusic();
      stopMusic();
    } else if (menuMode) {
      startMenuMusic();
    } else if (audioCtx && audioCtx.state === "running") {
      startMusic();
    }
  }
  function setSfxEnabled(on) {
    sfxOn = on;
    savePref("gardenEvolutionSfx", on);
    if (audioCtx && sfxBus) sfxBus.gain.value = on ? 1 : 0;
  }
  function setPianoEnabled(on) {
    pianoOn = Boolean(on);
    savePref("gardenEvolutionComboPiano", pianoOn);
  }

  /* ============================================================
     EVOLVING ENVIRONMENT â€” Japanese countryside, 5 stages
     SVG layers + CSS crossfades + drifting particles.
     ============================================================ */
  const STAGE_SVG = [
    // Stage 1 â€” Radical Winter Mountain Overlook (asymmetrical high-altitude summit POV plunging into a deep valley)
    `<defs>
      <linearGradient id="s1sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#7291aa"/>
        <stop offset="50%" stop-color="#b0d6eb"/>
        <stop offset="100%" stop-color="#e2f0f7"/>
      </linearGradient>
      <linearGradient id="s1valleyfog" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#cae0ee" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="#cae0ee" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="s1ridgeGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1c2b38"/>
        <stop offset="50%" stop-color="#2d4052"/>
        <stop offset="100%" stop-color="#475f75"/>
      </linearGradient>
      <linearGradient id="s1snowGrad" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="60%" stop-color="#e6f2fa"/>
        <stop offset="100%" stop-color="#b8d4e8"/>
      </linearGradient>
      <linearGradient id="s1lake" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#a4c6de" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="#d4e8f5" stop-opacity="0.95"/>
      </linearGradient>
    </defs>

    <!-- Frosty Winter Sky & Soft Sun -->
    <rect width="1440" height="900" fill="url(#s1sky)"/>
    <circle cx="1120" cy="160" r="75" fill="#ffffff" opacity="0.35"/>
    <g opacity="0.12" class="env-rays">
      <polygon points="1120,160 450,900 720,900" fill="#ffffff"/>
      <polygon points="1120,160 800,900 1050,900" fill="#ffffff"/>
    </g>

    <!-- Layered alpine ridges with irregular shoulders and naturally broken snow lines. -->
    <path d="M0 430 Q58 356 122 282 Q166 318 218 366 Q304 314 394 238 Q465 286 574 352 Q662 305 758 258 Q844 303 974 371 Q1070 319 1194 252 Q1277 292 1440 360 L1440 620 L0 620Z" fill="#5c7a94" opacity="0.4"/>
    <path d="M104 302 Q120 280 136 300 L162 330 L191 313 L221 366 Q174 337 145 326 Q126 315 104 302Z" fill="#fff" opacity=".74"/>
    <path d="M365 264 Q394 238 421 261 L452 292 L485 272 Q520 313 574 352 Q505 320 459 301 Q414 284 365 264Z" fill="#fff" opacity=".84"/>
    <path d="M726 276 Q758 258 784 276 L813 311 L846 291 Q897 333 974 371 Q884 336 826 320 Q782 301 726 276Z" fill="#fff" opacity=".78"/>
    <path d="M1154 275 Q1194 252 1228 273 L1255 302 L1292 283 Q1354 327 1440 360 Q1346 329 1279 315 Q1220 295 1154 275Z" fill="#fff" opacity=".83"/>

    <path d="M0 486 Q85 425 178 361 Q263 398 377 442 Q478 390 616 321 Q711 365 855 421 Q966 374 1118 331 Q1220 374 1358 411 Q1402 391 1440 382 L1440 680 L0 680Z" fill="#446078" opacity="0.55"/>
    <path d="M148 383 Q178 361 204 377 L231 410 L275 392 Q316 420 377 442 Q299 414 247 416 Q207 399 148 383Z" fill="#fff" opacity=".72"/>
    <path d="M575 343 Q616 321 650 342 L683 381 L727 361 Q777 395 855 421 Q765 394 706 389 Q657 370 575 343Z" fill="#fff" opacity=".78"/>
    <path d="M1078 348 Q1118 331 1150 350 L1181 390 L1226 371 Q1280 397 1358 411 Q1267 396 1204 401 Q1153 375 1078 348Z" fill="#fff" opacity=".72"/>

    <!-- Deep Valley Basin & Frozen Glacial Lake -->
    <path d="M220 900 Q620 580 1440 540 L1440 900 Z" fill="#7593ab"/>
    <ellipse cx="980" cy="620" rx="380" ry="45" fill="url(#s1lake)"/>
    <g fill="none" stroke-linecap="round">
      <path d="M716 616 Q802 600 883 610 T1056 605" stroke="#f5fbff" stroke-width="3" opacity=".38"/>
      <path d="M820 630 L861 616 L897 628 L938 612 M897 628 L915 642 M861 616 L850 603" stroke="#789db7" stroke-width="2" opacity=".42"/>
      <path d="M1080 620 L1111 609 L1142 620 M1111 609 L1120 596" stroke="#799db6" stroke-width="1.7" opacity=".34"/>
      <ellipse cx="1005" cy="634" rx="48" ry="7" stroke="#fff" stroke-width="2" opacity=".22"/>
    </g>
    <g fill="#eff8fd" opacity=".48"><circle cx="760" cy="629" r="3"/><circle cx="778" cy="618" r="2"/><circle cx="964" cy="615" r="2.5"/><circle cx="1162" cy="624" r="3"/></g>
    <rect x="0" y="500" width="1440" height="180" fill="url(#s1valleyfog)" class="env-mist"/>

    <!-- Distant Shrinking Tree Clusters on Valley Spurs (Perspective Scaling) -->
    <g transform="translate(920, 560) scale(0.35)">
      <polygon points="0,-40 -18,10 -6,10 -24,40 24,40 6,10 18,10" fill="#2c3e4d"/>
      <polygon points="0,-40 -12,0 0,-5 12,0" fill="#ffffff" opacity="0.85"/>
      <polygon points="40,-30 25,10 33,10 20,35 60,35 47,10 55,10" fill="#2c3e4d"/>
      <polygon points="40,-30 30,0 40,-4 50,0" fill="#ffffff" opacity="0.85"/>
    </g>
    <g transform="translate(1220, 575) scale(0.45)">
      <polygon points="0,-40 -18,10 -6,10 -24,40 24,40 6,10 18,10" fill="#243442"/>
      <polygon points="0,-40 -12,0 0,-5 12,0" fill="#ffffff" opacity="0.85"/>
    </g>
    <!-- A quiet deer silhouette gives the frozen basin a distant sense of life. -->
    <g transform="translate(1065 552) scale(.42)" fill="#2b4050" opacity=".78">
      <ellipse cx="0" cy="7" rx="30" ry="15"/><path d="M22 2 Q31 -17 43 -27 L52 -22 Q43 -7 38 9Z"/>
      <ellipse cx="48" cy="-27" rx="11" ry="8"/><path d="M43 -33 L36 -46 L44 -39 L47 -52 M52 -33 L60 -45 L57 -36 L67 -42" stroke="#2b4050" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M-20 15 L-24 48 M-4 17 L-7 49 M16 16 L20 47 M28 12 L32 44" stroke="#2b4050" stroke-width="6" stroke-linecap="round"/>
      <path d="M-29 2 L-42 -8 L-34 9Z"/>
    </g>

    <!-- Midground Right Mountain Spur (Sloping Downward into Valley) -->
    <path d="M760 900 Q1020 590 1440 580 L1440 900 Z" fill="#364b5e"/>
    <path d="M800 900 Q1040 610 1440 600 L1440 900 Z" fill="url(#s1snowGrad)"/>

    <!-- FOREGROUND: Massive Asymmetrical Left Summit Ridge (High Overlook Vantage Point) -->
    <path d="M0 900 L0 260 Q220 480 660 900 Z" fill="url(#s1ridgeGrad)"/>
    <!-- Exposed Slate Rock Ledges -->
    <path d="M0 420 Q180 520 520 880 L440 900 Q140 550 0 470 Z" fill="#141f28"/>
    <!-- Wind-Carved Layered Snowdrifts & Contours -->
    <path d="M0 260 Q190 420 580 840 Q380 880 0 490 Z" fill="url(#s1snowGrad)"/>
    <path d="M0 340 Q150 450 460 780 Q320 820 0 410 Z" fill="#ffffff" opacity="0.9"/>
    <!-- Shaded Snow Contour Trough -->
    <path d="M40 360 Q170 480 440 760 Q340 790 20 380 Z" fill="#a4c4dc" opacity="0.6"/>

    <!-- Large Foreground Wind-Bent Frosted Fir Trees (Rooted on Summit Ridge) -->
    <g transform="translate(100, 360) rotate(-4)">
      <polygon points="0,-75 -30,15 -10,15 -38,65 38,65 10,15 30,15" fill="#182430"/>
      <polygon points="0,-75 -18,0 0,-10 18,0" fill="#ffffff" opacity="0.95"/>
      <polygon points="-10,15 -24,48 24,48 10,15" fill="#ffffff" opacity="0.85"/>
      <polygon points="-14,35 -28,60 28,60 14,35" fill="#ffffff" opacity="0.75"/>
    </g>
    <g transform="translate(180, 440) rotate(3)">
      <polygon points="0,-66 -20,-5 -7,-10 -33,46 -11,38 -39,58 31,58 10,34 25,39 8,-2 23,4" fill="#141f28"/>
      <path d="M0 -66 L-13 -9 L0 -16 L15 -4 L22 3 L8 -2Z" fill="#fff" opacity=".94"/>
      <path d="M-8 10 L-24 41 L-8 35 L20 39 L9 14Z" fill="#fff" opacity=".8"/>
    </g>
    <g transform="translate(250, 530) rotate(-7) scale(.92 1.08)">
      <polygon points="0,-46 -16,4 -5,0 -25,38 -9,32 -28,46 24,46 8,27 19,31 6,2 18,7" fill="#182430"/>
      <path d="M0 -46 L-10 -2 L1 -8 L14 1 L18 7 L6 2Z" fill="#fff" opacity=".94"/>
      <path d="M-6 10 L-17 31 L-7 27 L16 30 L7 12Z" fill="#fff" opacity=".8"/>
    </g>

    <g fill="none" stroke="#33495a" stroke-linecap="round">
      <path d="M298 575 Q305 552 315 574 M306 562 L297 550 M309 559 L320 548" stroke-width="4"/>
      <path d="M1320 606 Q1326 586 1334 605 M1326 593 L1318 584" stroke-width="3" opacity=".8"/>
    </g>
    <g transform="translate(315 583) rotate(8)"><path d="M-30 0 Q0 -9 32 0" stroke="#4b382d" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M-23 -3 Q0 -9 22 -3" stroke="#f4f9fc" stroke-width="4" fill="none" opacity=".85"/></g>

    <!-- Friendly snowman on the open right-hand snowfield. -->
    <g transform="translate(1215 700)">
      <ellipse cx="0" cy="94" rx="76" ry="16" fill="#66859d" opacity=".3"/>
      <ellipse cx="0" cy="55" rx="60" ry="62" fill="#e5f1f8"/>
      <ellipse cx="-15" cy="34" rx="34" ry="38" fill="#ffffff" opacity=".52"/>
      <circle cx="0" cy="-24" r="45" fill="#edf6fb"/>
      <ellipse cx="-12" cy="-38" rx="24" ry="19" fill="#ffffff" opacity=".55"/>

      <g fill="none" stroke="#4a382d" stroke-width="7" stroke-linecap="round">
        <path d="M-49 22 Q-78 1 -99 -24 M-99 -24 L-119 -13 M-99 -24 L-103 -48"/>
        <path d="M49 18 Q77 -5 97 -29 M97 -29 L118 -18 M97 -29 L101 -53"/>
      </g>

      <path d="M-39 -2 Q0 12 39 -2 L34 18 Q0 28 -34 16Z" fill="#c94d5f"/>
      <path d="M29 12 Q51 39 43 71 L25 56 L32 24Z" fill="#a9364d"/>
      <path d="M-41 -68 H40 L32 -91 H-26Z" fill="#263746"/>
      <rect x="-50" y="-73" width="100" height="13" rx="5" fill="#1a2834"/>
      <rect x="-26" y="-86" width="58" height="7" fill="#d8e6ef" opacity=".42"/>

      <g fill="#25333d"><circle cx="-15" cy="-34" r="5"/><circle cx="16" cy="-34" r="5"/></g>
      <path d="M2 -23 L38 -14 L2 -8Z" fill="#ed8d32"/>
      <path d="M-18 -2 Q0 10 19 -2" stroke="#344550" stroke-width="4" fill="none" stroke-linecap="round"/>
      <g fill="#364751"><circle cy="39" r="5"/><circle cy="62" r="5"/></g>

      <g fill="#ffffff" opacity=".78">
        <circle cx="-31" cy="-47" r="3"/><circle cx="22" cy="15" r="3.5"/><circle cx="-36" cy="48" r="4"/>
      </g>
    </g>`,

    // Stage 2 â€” Snowmelt / Early Spring: descended into a Swiss alpine valley.
    // Cool pale sky, leftover snow, thawing soil, icy meltwater. Not lush, not floral.
    `<defs>
      <linearGradient id="s2sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#78a9c9"/>
        <stop offset="42%" stop-color="#bed8e3"/>
        <stop offset="78%" stop-color="#dff0ec"/>
        <stop offset="100%" stop-color="#f0f3df"/>
      </linearGradient>
      <radialGradient id="s2sun" cx="0.78" cy="0.16" r="0.28">
        <stop offset="0%" stop-color="#fff7e4" stop-opacity="0.85"/>
        <stop offset="45%" stop-color="#f0e6c8" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="#f0e6c8" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="s2haze" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#d5e0e6" stop-opacity="0.7"/>
        <stop offset="100%" stop-color="#d5e0e6" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="s2stream" x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0%" stop-color="#9bb8c8" stop-opacity="0.75"/>
        <stop offset="55%" stop-color="#6f93a8" stop-opacity="0.88"/>
        <stop offset="100%" stop-color="#4d7388" stop-opacity="0.95"/>
      </linearGradient>
      <linearGradient id="s2meadow1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#91b875"/>
        <stop offset="100%" stop-color="#a9c783"/>
      </linearGradient>
      <linearGradient id="s2meadow2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#7fa565"/>
        <stop offset="100%" stop-color="#91b36f"/>
      </linearGradient>
      <linearGradient id="s2meadow3" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#6f9559"/>
        <stop offset="100%" stop-color="#82a667"/>
      </linearGradient>
      <linearGradient id="s2soil" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#6b5340" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#4a382c" stop-opacity="0.7"/>
      </linearGradient>
    </defs>

    <rect width="1440" height="900" fill="url(#s2sky)"/>
    <circle cx="1120" cy="145" r="150" fill="url(#s2sun)"/>
    <circle cx="1120" cy="145" r="38" fill="#fff6e0" opacity="0.7"/>
    <g class="env-clouds" fill="#eef3f6">
      <path d="M70 155 Q105 128 150 138 Q190 118 235 142 Q265 132 285 155 Q292 175 262 182 L90 182 Z" opacity="0.55"/>
      <path d="M680 128 Q715 102 760 112 Q800 92 848 118 Q878 108 898 130 Q908 150 878 158 L700 158 Z" opacity="0.42"/>
    </g>

    <path d="M0 455 L90 360 L170 410 L280 300 L390 390 L520 270 L640 365 L780 255 L920 350 L1060 280 L1200 355 L1320 290 L1440 360 L1440 560 L0 560Z" fill="#6d8494" opacity="0.55"/>
    <path d="M280 300 L318 355 L248 355 Z" fill="#f4f8fb" opacity="0.88"/>
    <path d="M520 270 L562 332 L478 332 Z" fill="#ffffff" opacity="0.92"/>
    <path d="M780 255 L828 328 L732 328 Z" fill="#ffffff" opacity="0.9"/>
    <path d="M1060 280 L1100 335 L1020 335 Z" fill="#f4f8fb" opacity="0.82"/>
    <path d="M1320 290 L1360 340 L1280 340 Z" fill="#eef4f8" opacity="0.78"/>

    <path d="M0 505 L160 430 L340 475 L530 410 L740 460 L960 405 L1180 455 L1440 420 L1440 620 L0 620Z" fill="#6f8d72" opacity="0.72"/>
    <path d="M200 455 Q260 442 310 462 Q250 472 200 455 Z" fill="#e8eef2" opacity="0.55"/>
    <path d="M560 430 Q630 416 690 438 Q620 448 560 430 Z" fill="#e8eef2" opacity="0.48"/>
    <path d="M1020 428 Q1090 412 1160 436 Q1085 446 1020 428 Z" fill="#dfe7ea" opacity="0.5"/>

    <path d="M0 555 Q380 508 760 538 T1440 518 L1440 900 L0 900Z" fill="url(#s2meadow1)"/>
    <path d="M0 628 Q360 582 780 612 T1440 592 L1440 900 L0 900Z" fill="url(#s2meadow2)"/>
    <path d="M0 718 Q400 672 820 702 T1440 682 L1440 900 L0 900Z" fill="url(#s2meadow3)"/>

    <path d="M40 640 Q120 618 190 648 Q110 662 40 640 Z" fill="#f2f6f8" opacity="0.72"/>
    <path d="M980 600 Q1060 582 1145 612 Q1055 624 980 600 Z" fill="#eef3f6" opacity="0.58"/>
    <path d="M420 700 Q490 684 545 708 Q475 718 420 700 Z" fill="#f7fafb" opacity="0.4"/>

    <rect x="0" y="470" width="1440" height="160" fill="url(#s2haze)" class="env-mist"/>

    <path d="M90 900 Q250 775 400 705 T660 625 T830 565 T960 518 L990 522 Q860 570 T690 632 T430 712 T270 785 T120 900 Z" fill="url(#s2soil)"/>

    <path class="env-stream" d="M110 900 Q255 778 405 708 T665 628 T835 568 T965 522 L978 526 Q848 572 T678 634 T418 714 T268 788 L125 900 Z" fill="url(#s2stream)"/>
    <path class="env-s2-waterline" d="M128 900 Q268 778 418 708 T678 628 T848 568 T972 524" stroke="#f4fbff" stroke-width="3" fill="none" opacity="0.58" stroke-linecap="round"/>
    <path class="env-s2-waterline" d="M142 888 Q275 770 422 702 T680 624" stroke="#c5e4ef" stroke-width="1.8" fill="none" opacity="0.42" style="animation-delay:-2s"/>
    <g class="env-s2-ripple" fill="none" stroke="#e9f7fb" stroke-width="2" opacity=".45">
      <ellipse cx="366" cy="744" rx="38" ry="7"/><ellipse cx="585" cy="652" rx="27" ry="5"/><ellipse cx="812" cy="575" rx="18" ry="3.5"/>
    </g>

    <!-- Two bank frogs hop at offset rhythms so the stream feels inhabited. -->
    <g transform="translate(300 790)">
      <ellipse class="env-frog-shadow" cx="0" cy="8" rx="18" ry="5" fill="#36583a" opacity=".3"/>
      <g class="env-frog-hop">
        <ellipse cx="0" cy="0" rx="15" ry="10" fill="#5f9b50"/>
        <circle cx="-9" cy="-8" r="6" fill="#75b962"/><circle cx="9" cy="-8" r="6" fill="#75b962"/>
        <circle cx="-9" cy="-9" r="2" fill="#18271a"/><circle cx="9" cy="-9" r="2" fill="#18271a"/>
        <g class="env-frog-blink" fill="#75b962"><circle cx="-9" cy="-9" r="2.6"/><circle cx="9" cy="-9" r="2.6"/></g>
        <path d="M-11 5 L-24 12 M11 5 L24 12 M-8 8 L-17 19 M8 8 L17 19" stroke="#4d8245" stroke-width="4" stroke-linecap="round"/>
        <ellipse class="env-frog-throat" cx="0" cy="7" rx="8" ry="5" fill="#b7d681"/>
        <path d="M-5 2 Q0 6 5 2" stroke="#d9eaa9" stroke-width="1.5" fill="none"/>
      </g>
    </g>
    <g transform="translate(1008 555) scale(.72)">
      <ellipse class="env-frog-shadow env-frog-shadow-late" cx="0" cy="8" rx="18" ry="5" fill="#36583a" opacity=".28"/>
      <g class="env-frog-hop env-frog-hop-late env-frog-late">
        <ellipse cx="0" cy="0" rx="15" ry="10" fill="#639d52"/>
        <circle cx="-9" cy="-8" r="6" fill="#7cba63"/><circle cx="9" cy="-8" r="6" fill="#7cba63"/>
        <circle cx="-9" cy="-9" r="2" fill="#18271a"/><circle cx="9" cy="-9" r="2" fill="#18271a"/>
        <g class="env-frog-blink" fill="#7cba63"><circle cx="-9" cy="-9" r="2.6"/><circle cx="9" cy="-9" r="2.6"/></g>
        <path d="M-11 5 L-24 12 M11 5 L24 12 M-8 8 L-17 19 M8 8 L17 19" stroke="#4f8445" stroke-width="4" stroke-linecap="round"/>
        <ellipse class="env-frog-throat" cx="0" cy="7" rx="8" ry="5" fill="#bdd987"/>
      </g>
    </g>

    <!-- A small alpine homestead gives the thawing valley a warm focal point. -->
    <g transform="translate(1010 505)">
      <rect x="0" y="18" width="92" height="58" rx="3" fill="#d8b37b"/>
      <path d="M-12 22 L45 -18 L104 22 Z" fill="#7d4634"/>
      <rect x="38" y="43" width="20" height="33" rx="2" fill="#6b4932"/>
      <rect x="10" y="37" width="18" height="16" rx="2" fill="#f4dca0"/>
      <rect x="68" y="37" width="18" height="16" rx="2" fill="#f4dca0"/>
      <path d="M92 8 Q105 -6 116 8" stroke="#eef3f5" stroke-width="6" fill="none" opacity=".55"/>
    </g>
    <g transform="translate(736 602) rotate(-8)">
      <path d="M-50 0 Q0 -20 50 0" stroke="#76543a" stroke-width="10" fill="none"/>
      <path d="M-48 -4 Q0 -24 48 -4" stroke="#c39862" stroke-width="5" fill="none"/>
      <path d="M-38 -2 V24 M38 -2 V24" stroke="#60432f" stroke-width="5"/>
    </g>

    <g fill="#355246" opacity="0.58">
      <polygon points="610,478 601,508 619,508"/><polygon points="632,472 623,504 641,504"/>
    </g>

    <g transform="translate(68, 605) scale(0.82)" class="env-fg-sway">
      <path d="M0 82 Q-5 20 4 -62 M0 -5 Q-34 -30 -58 -64 M2 -18 Q38 -46 62 -72" stroke="#775940" stroke-width="14" stroke-linecap="round" fill="none"/>
      <g fill="#78a35e"><circle cx="-58" cy="-65" r="35"/><circle cx="-24" cy="-86" r="40"/><circle cx="15" cy="-91" r="43"/><circle cx="57" cy="-70" r="36"/><circle cx="20" cy="-48" r="39"/></g>
      <g fill="#b2ca7f" opacity=".8"><circle cx="-32" cy="-96" r="16"/><circle cx="12" cy="-104" r="18"/><circle cx="51" cy="-76" r="15"/></g>
    </g>
    <g transform="translate(128, 690) scale(1.05)" class="env-fg-sway">
      <path d="M0 130 Q-8 50 -18 -20 Q-28 -80 -42 -150" stroke="#3a2a1c" stroke-width="15" stroke-linecap="round" fill="none"/>
      <path d="M-12 20 Q22 -30 58 -88" stroke="#3a2a1c" stroke-width="8" stroke-linecap="round" fill="none"/>
      <path d="M-22 -40 Q-4 -95 18 -148" stroke="#3a2a1c" stroke-width="6" stroke-linecap="round" fill="none"/>
      <path d="M-8 -10 Q-38 -40 -62 -28" stroke="#3a2a1c" stroke-width="5" fill="none"/>
      <circle cx="-42" cy="-148" r="7" fill="#7d9a58" opacity="0.85"/>
      <circle cx="-18" cy="-132" r="6" fill="#8aaa62" opacity="0.75"/>
      <circle cx="12" cy="-142" r="6.5" fill="#7d9a58" opacity="0.8"/>
      <circle cx="52" cy="-86" r="6" fill="#8aaa62" opacity="0.7"/>
      <circle cx="-58" cy="-30" r="5" fill="#6f8c4e" opacity="0.7"/>
      <circle cx="-8" cy="-70" r="5" fill="#8aaa62" opacity="0.65"/>
    </g>
    <g transform="translate(248, 548) scale(0.5)" class="env-fg-sway">
      <path d="M0 58 Q2 4 -4 -78 M-2 -12 Q-34 -35 -48 -58 M-2 -30 Q28 -52 44 -72" stroke="#e4e0d2" stroke-width="13" stroke-linecap="round" fill="none"/>
      <g fill="#88ad69"><circle cx="-46" cy="-60" r="29"/><circle cx="-14" cy="-82" r="34"/><circle cx="20" cy="-83" r="35"/><circle cx="46" cy="-66" r="28"/></g>
    </g>
    <g transform="translate(300, 575) scale(0.48)" class="env-fg-sway">
      <path d="M0 90 Q-6 30 -14 -40 Q-20 -80 -28 -118" stroke="#3a2a1c" stroke-width="9" fill="none"/>
      <path d="M-10 10 Q18 -20 40 -55" stroke="#3a2a1c" stroke-width="5" fill="none"/>
      <circle cx="-28" cy="-118" r="5" fill="#7d9a58" opacity="0.7"/>
      <circle cx="8" cy="-95" r="4.5" fill="#8aaa62" opacity="0.65"/>
      <circle cx="38" cy="-52" r="4" fill="#7d9a58" opacity="0.6"/>
    </g>

    <g transform="translate(1248, 698) scale(1.08)" class="env-fg-sway">
      <path d="M0 88 Q-2 22 2 -50 M0 12 Q-42 -24 -66 -60 M2 -12 Q42 -46 72 -78" stroke="#76563d" stroke-width="15" stroke-linecap="round" fill="none"/>
      <g fill="#6f9d58"><circle cx="-66" cy="-62" r="38"/><circle cx="-30" cy="-86" r="44"/><circle cx="12" cy="-96" r="48"/><circle cx="58" cy="-77" r="42"/><circle cx="25" cy="-45" r="46"/></g>
      <g fill="#a8c77b" opacity=".82"><circle cx="-44" cy="-99" r="19"/><circle cx="4" cy="-113" r="22"/><circle cx="52" cy="-87" r="18"/><circle cx="-4" cy="-57" r="16"/></g>
    </g>
    <g transform="translate(1378, 628) scale(0.72)" class="env-fg-sway">
      <path d="M0 70 Q2 12 -5 -68 M-1 -5 Q-35 -28 -52 -55" stroke="#75573f" stroke-width="13" stroke-linecap="round" fill="none"/>
      <g fill="#82a965"><circle cx="-52" cy="-57" r="31"/><circle cx="-20" cy="-76" r="37"/><circle cx="18" cy="-73" r="35"/><circle cx="42" cy="-48" r="28"/></g>
    </g>
    <g transform="translate(1148, 618) scale(0.78)" class="env-fg-sway">
      <path d="M0 115 Q-8 42 -16 -18 Q-24 -70 -38 -118" stroke="#3e2e20" stroke-width="12" stroke-linecap="round" fill="none"/>
      <path d="M-10 18 Q22 -22 52 -70" stroke="#3e2e20" stroke-width="7" fill="none"/>
      <circle cx="-38" cy="-116" r="6" fill="#7d9a58" opacity="0.8"/>
      <circle cx="-8" cy="-98" r="5" fill="#8aaa62" opacity="0.7"/>
      <circle cx="48" cy="-68" r="5.5" fill="#7d9a58" opacity="0.72"/>
      <circle cx="12" cy="-50" r="4.5" fill="#6f8c4e" opacity="0.65"/>
    </g>
    <g transform="translate(1072, 538) scale(0.46)" class="env-fg-sway">
      <path d="M0 80 Q-6 28 -12 -30 Q-18 -70 -26 -102" stroke="#3e2e20" stroke-width="8" fill="none"/>
      <circle cx="-26" cy="-100" r="4.5" fill="#7d9a58" opacity="0.65"/>
      <circle cx="6" cy="-72" r="4" fill="#8aaa62" opacity="0.6"/>
    </g>

    <!-- Mixed early-spring broadleaf trees soften the conifer-heavy valley. -->
    <g transform="translate(365 610)" class="env-fg-sway">
      <path d="M0 74 Q5 12 -8 -72 M-2 10 Q-38 -18 -55 -52 M-5 -18 Q28 -40 43 -70" stroke="#806046" stroke-width="10" stroke-linecap="round" fill="none"/>
      <g fill="#86ad68"><circle cx="-55" cy="-55" r="25"/><circle cx="-25" cy="-70" r="30"/><circle cx="8" cy="-80" r="34"/><circle cx="42" cy="-67" r="27"/><circle cx="20" cy="-42" r="31"/></g>
      <g fill="#b3cc83" opacity=".8"><circle cx="-36" cy="-78" r="13"/><circle cx="4" cy="-91" r="15"/><circle cx="38" cy="-73" r="12"/></g>
    </g>
    <g transform="translate(1180 650) scale(.9)" class="env-fg-sway">
      <path d="M0 92 Q-2 25 8 -72 M5 0 Q-28 -26 -48 -58 M7 -18 Q42 -42 57 -70" stroke="#795b43" stroke-width="11" stroke-linecap="round" fill="none"/>
      <g fill="#78a45f"><circle cx="-48" cy="-60" r="27"/><circle cx="-16" cy="-79" r="31"/><circle cx="18" cy="-82" r="35"/><circle cx="53" cy="-65" r="28"/><circle cx="22" cy="-43" r="33"/></g>
      <g fill="#abc97e" opacity=".78"><circle cx="-24" cy="-88" r="14"/><circle cx="17" cy="-94" r="16"/><circle cx="49" cy="-69" r="12"/></g>
    </g>

    <!-- Acacia: airy, horizontally spreading crown with fresh compound foliage. -->
    <g transform="translate(190 665) scale(1.12)">
      <g class="env-fg-sway">
      <path d="M0 105 Q-2 35 8 -36 M5 10 Q-48 -20 -91 -48 M8 -12 Q56 -38 104 -45 M-18 -5 Q-52 -52 -58 -82" stroke="#76563d" stroke-width="14" stroke-linecap="round" fill="none"/>
      <g fill="#83ad63">
        <ellipse cx="-92" cy="-51" rx="39" ry="23"/><ellipse cx="-55" cy="-66" rx="43" ry="25"/><ellipse cx="-12" cy="-70" rx="42" ry="27"/>
        <ellipse cx="35" cy="-62" rx="44" ry="25"/><ellipse cx="80" cy="-51" rx="39" ry="23"/><ellipse cx="111" cy="-43" rx="29" ry="18"/>
      </g>
      <g fill="#b7d285" opacity=".82"><ellipse cx="-72" cy="-76" rx="24" ry="12"/><ellipse cx="-24" cy="-88" rx="25" ry="13"/><ellipse cx="31" cy="-78" rx="26" ry="13"/><ellipse cx="83" cy="-62" rx="22" ry="11"/></g>
      <g fill="#f2efd0" opacity=".82"><circle cx="-61" cy="-63" r="3"/><circle cx="-35" cy="-79" r="2.5"/><circle cx="22" cy="-68" r="3"/><circle cx="65" cy="-54" r="2.5"/></g>
      </g>
    </g>

    <!-- Hornbeam: denser upright oval crown with layered spring leaves. -->
    <g transform="translate(1250 680) scale(1.12)">
      <g class="env-fg-sway">
      <path d="M0 104 Q4 30 -2 -62 M0 18 Q-32 -12 -48 -52 M1 -6 Q34 -36 48 -70" stroke="#70604c" stroke-width="15" stroke-linecap="round" fill="none"/>
      <g fill="#719a59"><ellipse cx="-35" cy="-61" rx="36" ry="43"/><ellipse cx="0" cy="-88" rx="43" ry="51"/><ellipse cx="36" cy="-65" rx="37" ry="45"/><ellipse cx="3" cy="-43" rx="48" ry="40"/></g>
      <g fill="#9fc276" opacity=".86"><ellipse cx="-20" cy="-97" rx="20" ry="26"/><ellipse cx="14" cy="-111" rx="19" ry="25"/><ellipse cx="38" cy="-77" rx="18" ry="23"/><ellipse cx="-5" cy="-52" rx="22" ry="18"/></g>
      <g fill="#c5d995" opacity=".68"><ellipse cx="-25" cy="-80" rx="10" ry="15"/><ellipse cx="8" cy="-95" rx="11" ry="16"/><ellipse cx="26" cy="-54" rx="10" ry="14"/></g>
      </g>
    </g>

    <!-- Sparse snowdrop, crocus and primrose clusters: spring has just arrived. -->
    <g opacity=".92">
      <g transform="translate(180 755)"><path d="M0 18 V0 M14 18 V4 M28 18 V-2" stroke="#4f7d45" stroke-width="3"/><ellipse cx="0" cy="-3" rx="6" ry="4" fill="#fffdf4"/><ellipse cx="14" cy="1" rx="6" ry="4" fill="#d9e9ff"/><ellipse cx="28" cy="-5" rx="6" ry="4" fill="#fffdf4"/></g>
      <g transform="translate(1050 704)"><path d="M0 16 V0 M16 16 V-2 M32 16 V2" stroke="#4f7d45" stroke-width="3"/><circle cx="0" cy="-3" r="5" fill="#e8d8f2"/><circle cx="16" cy="-5" r="5" fill="#f4e39a"/><circle cx="32" cy="-1" r="5" fill="#f1d7ea"/></g>
      <g transform="translate(1285 790)"><path d="M0 18 V0 M18 18 V2 M36 18 V-3" stroke="#4f7d45" stroke-width="3"/><circle cx="0" cy="-3" r="5" fill="#fff6c1"/><circle cx="18" cy="-1" r="5" fill="#eee0f6"/><circle cx="36" cy="-6" r="5" fill="#fff6c1"/></g>
    </g>

    <!-- Foreground living frame: restrained new leaves, never over the board. -->
    <g class="env-s2-branch" transform="translate(-35 80)">
      <path d="M0 0 Q120 25 255 112 Q320 152 370 205" stroke="#4b3828" stroke-width="15" stroke-linecap="round" fill="none"/>
      <path d="M118 52 Q170 25 222 34 M210 95 Q270 78 320 94" stroke="#4b3828" stroke-width="7" stroke-linecap="round" fill="none"/>
      <g fill="#91aa68"><ellipse cx="166" cy="32" rx="14" ry="7" transform="rotate(-18 166 32)"/><ellipse cx="218" cy="38" rx="12" ry="6" transform="rotate(20 218 38)"/><ellipse cx="274" cy="76" rx="13" ry="7" transform="rotate(-12 274 76)"/><ellipse cx="321" cy="96" rx="11" ry="6" transform="rotate(24 321 96)"/></g>
      <g fill="#b5c987" opacity=".8"><ellipse cx="140" cy="48" rx="9" ry="5"/><ellipse cx="245" cy="70" rx="9" ry="5"/><ellipse cx="345" cy="137" rx="8" ry="4"/></g>
    </g>

    <g class="env-s2-grass" stroke="#58733f" stroke-width="5" stroke-linecap="round" fill="none">
      <path d="M18 900 Q30 842 48 808 M48 900 Q58 830 86 790 M82 900 Q96 846 118 820 M1260 900 Q1272 838 1290 804 M1300 900 Q1314 824 1340 786 M1350 900 Q1360 840 1390 812"/>
    </g>
    <g class="env-s2-grass slow" stroke="#769052" stroke-width="3.5" stroke-linecap="round" fill="none" opacity=".8">
      <path d="M210 900 Q218 860 236 836 M260 900 Q270 852 288 824 M1120 900 Q1130 852 1150 824 M1170 900 Q1182 858 1200 836"/>
    </g>

    <path d="M28 858 Q52 812 76 858 M48 858 Q68 800 92 858 M96 868 Q118 824 142 868" stroke="#4f6a3a" stroke-width="5.5" stroke-linecap="round" fill="none"/>
    <path d="M1228 848 Q1252 800 1276 848 M1248 848 Q1268 792 1292 848 M1298 858 Q1322 812 1346 858" stroke="#4f6a3a" stroke-width="5.5" stroke-linecap="round" fill="none"/>
    <path d="M668 728 Q688 690 708 728 M688 728 Q702 686 722 728" stroke="#4f6a3a" stroke-width="4" stroke-linecap="round" fill="none"/>
    <g transform="translate(236, 778)" opacity="0.85">
      <path d="M0 8 Q2 -10 0 -22" stroke="#4a6a38" stroke-width="2" fill="none"/>
      <ellipse cx="0" cy="-24" rx="3.5" ry="5" fill="#f4f6f2"/>
    </g>
    <g transform="translate(1092, 762)" opacity="0.75">
      <path d="M0 8 Q2 -8 1 -18" stroke="#4a6a38" stroke-width="2" fill="none"/>
      <ellipse cx="1" cy="-20" rx="3" ry="4.5" fill="#f4f6f2"/>
    </g>`,
    // Stage 3 â€” Blooming Spring (life returning, wildflowers across meadows, floral haze)
    `<defs>
      <linearGradient id="s3sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#78c9ed"/><stop offset="55%" stop-color="#c9eee1"/><stop offset="100%" stop-color="#f0f6df"/></linearGradient>
      <linearGradient id="s3stream" x1="0" y1="0" x2=".3" y2="1"><stop offset="0%" stop-color="#a5e4df"/><stop offset="100%" stop-color="#559fbd"/></linearGradient>
      <linearGradient id="s3haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f7edf2" stop-opacity=".48"/><stop offset="100%" stop-color="#e8f8ec" stop-opacity="0"/></linearGradient>
      <radialGradient id="s3sun" cx=".5" cy=".5" r=".5"><stop offset="0%" stop-color="#fffdf0" stop-opacity=".96"/><stop offset="35%" stop-color="#fff4b8" stop-opacity=".74"/><stop offset="100%" stop-color="#fff4b8" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1440" height="900" fill="url(#s3sky)"/>
    <circle cx="1160" cy="145" r="86" fill="url(#s3sun)" class="env-sun-glow"/>
    <circle cx="1160" cy="145" r="31" fill="#fff9d8" opacity=".88"/>
    <g class="env-clouds" fill="#fff" opacity=".62"><path d="M70 155 Q115 118 165 140 Q215 110 270 150 Q290 175 250 184 H95Z"/><path d="M710 120 Q750 92 795 112 Q835 88 880 122 Q900 146 866 154 H728Z"/></g>
    <!-- Three organic alpine depth layers with softened ridges and distant forest. -->
    <path d="M0 438 Q90 382 172 408 Q250 350 340 406 Q430 337 520 400 Q610 350 705 412 Q790 354 885 410 Q985 338 1080 404 Q1180 348 1260 395 Q1355 352 1440 410 V560 H0Z" fill="#b5d2ca" opacity=".48"/>
    <path d="M0 505 L118 420 Q150 392 182 424 L278 478 L404 362 Q438 326 476 370 L618 455 L758 382 Q793 346 830 389 L972 462 L1140 367 Q1180 334 1215 376 L1325 425 L1440 388 V590 H0Z" fill="#78a79d" opacity=".68"/>
    <path d="M0 548 Q145 468 282 516 Q410 444 542 505 Q675 442 808 508 Q955 446 1088 510 Q1260 445 1440 500 V620 H0Z" fill="#618f7a" opacity=".62"/>
    <g fill="#eef6f3" opacity=".76"><path d="M404 362 Q440 326 476 370 L454 361 L440 382 L428 360Z"/><path d="M758 382 Q793 346 830 389 L808 378 L795 398 L782 376Z"/><path d="M1140 367 Q1180 334 1215 376 L1192 365 L1178 386 L1165 363Z"/></g>
    <g fill="#426f5e" opacity=".48"><path d="M74 525 l9 -25 9 25Z M98 521 l8 -22 8 22Z M245 505 l9 -25 9 25Z M270 510 l8 -22 8 22Z M580 493 l9 -25 9 25Z M606 500 l8 -22 8 22Z M900 490 l9 -25 9 25Z M927 498 l8 -22 8 22Z M1290 480 l9 -25 9 25Z M1320 488 l8 -22 8 22Z"/></g>
    <path d="M0 560 Q350 500 720 540 T1440 520 L1440 900 H0Z" fill="#83c36b"/>
    <rect y="520" width="1440" height="145" fill="url(#s3haze)" class="env-mist"/>
    <path d="M0 650 Q380 590 760 630 T1440 610 V900 H0Z" fill="#67b653"/>
    <path d="M0 738 Q380 690 780 720 T1440 700 V900 H0Z" fill="#4f9e3d"/>
    <!-- Clear spring stream curls around the board. -->
    <path class="env-stream" d="M95 900 Q245 790 430 710 T720 625 T930 540 L962 548 Q820 622 730 666 T450 742 T145 900Z" fill="url(#s3stream)"/>
    <path class="env-s2-waterline" d="M120 900 Q265 794 444 716 T730 634 T945 545" stroke="#e9ffff" stroke-width="3" fill="none" opacity=".65"/>
    <!-- Mid-distance life along the upper stream: groves, flowers and insects. -->
    <g opacity=".9">
      <g transform="translate(275 585)"><path d="M0 54 Q2 10 -3 -35" stroke="#72563f" stroke-width="9"/><g fill="#5da456"><circle cx="-25" cy="-40" r="27"/><circle cx="5" cy="-54" r="32"/><circle cx="35" cy="-38" r="25"/></g><g fill="#94cf72"><circle cx="-6" cy="-62" r="14"/><circle cx="29" cy="-45" r="12"/></g></g>
      <g transform="translate(1065 570) scale(.92)"><path d="M0 58 Q-1 12 5 -38" stroke="#765942" stroke-width="10"/><g fill="#52994e"><ellipse cx="-30" cy="-42" rx="29" ry="34"/><ellipse cx="4" cy="-59" rx="35" ry="40"/><ellipse cx="39" cy="-41" rx="29" ry="35"/></g><g fill="#88c96a"><ellipse cx="-8" cy="-70" rx="15" ry="19"/><ellipse cx="30" cy="-50" rx="14" ry="18"/></g></g>
      <g transform="translate(1210 590) scale(.72)"><path d="M0 55 V-32" stroke="#806047" stroke-width="9"/><g fill="#68a95d"><circle cx="-24" cy="-38" r="25"/><circle cx="4" cy="-52" r="29"/><circle cx="31" cy="-36" r="23"/></g></g>
    </g>
    <!-- Left midground grove fills the open bank without competing with the board. -->
    <g transform="translate(365 625) scale(.82)">
      <g class="env-fg-sway">
        <path d="M0 64 Q2 12 -2 -48 M0 -4 Q-28 -27 -43 -51 M1 -17 Q27 -38 43 -56" stroke="#765740" stroke-width="11" stroke-linecap="round" fill="none"/>
        <g fill="#5fa055"><circle cx="-42" cy="-53" r="28"/><circle cx="-13" cy="-72" r="34"/><circle cx="21" cy="-73" r="35"/><circle cx="48" cy="-51" r="27"/><circle cx="11" cy="-38" r="34"/></g>
        <g fill="#91c66f" opacity=".82"><circle cx="-19" cy="-82" r="15"/><circle cx="18" cy="-85" r="16"/><circle cx="43" cy="-57" r="13"/></g>
      </g>
      <!-- Small hive hangs where trunk meets the canopy. -->
      <g transform="translate(15 -37)"><path d="M0 -17 V-9" stroke="#624831" stroke-width="3"/><ellipse cy="0" rx="10" ry="14" fill="#d9a83b"/><path d="M-8 -6 H8 M-10 0 H10 M-8 6 H8" stroke="#9c7127" stroke-width="2"/><circle cx="3" cy="7" r="2.5" fill="#5b4026"/></g>
    </g>
    <g transform="translate(465 620) scale(.64)"><g class="env-fg-sway"><path d="M0 60 Q-1 10 3 -43" stroke="#795a43" stroke-width="11"/><g fill="#65a65a"><ellipse cx="-28" cy="-48" rx="29" ry="34"/><ellipse cx="5" cy="-65" rx="36" ry="41"/><ellipse cx="38" cy="-46" rx="28" ry="34"/></g><g fill="#9acb75" opacity=".78"><ellipse cx="-5" cy="-76" rx="15" ry="19"/><ellipse cx="31" cy="-53" rx="13" ry="17"/></g></g></g>
    <g transform="translate(430 641)"><g class="env-s2-grass slow"><g fill="#679956"><circle cx="-30" cy="4" r="20"/><circle cx="-7" cy="-3" r="25"/><circle cx="20" cy="3" r="22"/><circle cx="42" cy="8" r="17"/></g><g fill="#91bc70" opacity=".78"><circle cx="-10" cy="-13" r="10"/><circle cx="27" cy="-6" r="9"/></g></g></g>
    <g transform="translate(400 570)"><g class="env-bee env-insect-late"><ellipse rx="8" ry="5" fill="#efbd3e"/><path d="M-3 -5 V5 M3 -5 V5" stroke="#4b3b24" stroke-width="2"/><ellipse cx="-4" cy="-6" rx="5" ry="3" fill="#eaf8ff" opacity=".78"/></g></g>
    <!-- Shrub and brush layers make the upper banks feel inhabited and deep. -->
    <g opacity=".92">
      <g transform="translate(95 620)"><g class="env-s2-grass slow"><path d="M0 22 Q15 -18 30 20 M18 22 Q38 -30 52 18 M42 22 Q60 -16 75 20" stroke="#486f42" stroke-width="6" fill="none" stroke-linecap="round"/><g fill="#719f5c"><circle cx="8" cy="6" r="16"/><circle cx="31" cy="0" r="21"/><circle cx="57" cy="6" r="18"/><circle cx="75" cy="11" r="14"/></g></g></g>
      <g transform="translate(345 625)"><path d="M0 18 Q8 -18 20 12 M12 17 Q35 -28 47 14 M38 18 Q58 -16 70 15" stroke="#795b43" stroke-width="4" fill="none" stroke-linecap="round"/><g fill="#83ad68"><circle cx="12" cy="8" r="13"/><circle cx="34" cy="2" r="17"/><circle cx="57" cy="8" r="14"/></g><g fill="#f1e6c0"><circle cx="23" cy="-2" r="2.5"/><circle cx="45" cy="2" r="2.5"/></g></g>
      <g transform="translate(1000 610)"><g class="env-s2-grass"><path d="M0 25 Q18 -24 32 21 M22 24 Q45 -34 60 20 M50 25 Q70 -20 86 22" stroke="#4c7544" stroke-width="6" fill="none" stroke-linecap="round"/><g fill="#6fa65c"><circle cx="9" cy="10" r="17"/><circle cx="34" cy="1" r="23"/><circle cx="64" cy="7" r="20"/><circle cx="88" cy="13" r="15"/></g></g></g>
      <g transform="translate(1270 620)"><path d="M0 20 Q12 -20 25 15 M15 20 Q35 -27 48 16 M42 20 Q60 -13 73 18" stroke="#77583f" stroke-width="4" fill="none" stroke-linecap="round"/><g fill="#7aa761"><circle cx="10" cy="10" r="15"/><circle cx="34" cy="3" r="19"/><circle cx="58" cy="10" r="16"/></g></g>
    </g>
    <g opacity=".95">
      <g stroke="#397b47" stroke-width="3"><path d="M120 655 V630 M150 660 V626 M185 652 V624 M225 660 V632 M1005 640 V615 M1040 648 V618 M1090 642 V612 M1160 650 V620 M1220 646 V616"/></g>
      <g fill="#ef6f94"><circle cx="120" cy="627" r="6"/><circle cx="225" cy="629" r="6"/><circle cx="1040" cy="615" r="6"/><circle cx="1160" cy="617" r="6"/></g>
      <g fill="#f5d25d"><circle cx="150" cy="623" r="6"/><circle cx="1005" cy="612" r="6"/><circle cx="1220" cy="613" r="6"/></g>
      <g fill="#ad82df"><circle cx="185" cy="621" r="6"/><circle cx="1090" cy="609" r="6"/></g>
    </g>
    <g transform="translate(235 610)"><g class="env-butterfly"><path d="M0 0 Q-13 -12 -17 2 Q-10 11 0 4 Q10 11 17 2 Q13 -12 0 0Z" fill="#e984b7"/><circle r="2" fill="#62425d"/></g></g>
    <g transform="translate(1140 600)"><g class="env-butterfly env-insect-late"><path d="M0 0 Q-12 -11 -16 2 Q-9 10 0 4 Q9 10 16 2 Q12 -11 0 0Z" fill="#8f7bd9"/><circle r="2" fill="#4e4265"/></g></g>
    <g transform="translate(1030 625)"><g class="env-bee"><ellipse rx="8" ry="5" fill="#efbd3e"/><path d="M-3 -5 V5 M3 -5 V5" stroke="#4b3b24" stroke-width="2"/><ellipse cx="-4" cy="-6" rx="5" ry="3" fill="#eaf8ff" opacity=".75"/></g></g>
    <!-- Layered trees frame a calm central play area. -->
    <g transform="translate(130 675)"><g class="env-fg-sway"><path d="M0 105 Q2 25 -4 -75 M0 5 Q-48 -30 -75 -70 M0 -15 Q44 -48 73 -82" stroke="#6f4d35" stroke-width="17" fill="none" stroke-linecap="round"/><g fill="#4d9a48"><circle cx="-75" cy="-72" r="45"/><circle cx="-34" cy="-102" r="52"/><circle cx="18" cy="-110" r="56"/><circle cx="70" cy="-84" r="48"/><circle cx="24" cy="-58" r="53"/></g><g fill="#8fd16e" opacity=".8"><circle cx="-42" cy="-115" r="23"/><circle cx="12" cy="-128" r="26"/><circle cx="62" cy="-94" r="22"/></g></g></g>
    <g transform="translate(1280 690)"><g class="env-fg-sway"><path d="M0 105 Q-2 24 5 -75 M2 -5 Q-38 -35 -60 -73 M4 -20 Q43 -50 67 -80" stroke="#74513a" stroke-width="17" fill="none" stroke-linecap="round"/><g fill="#438e43"><ellipse cx="-57" cy="-75" rx="43" ry="49"/><ellipse cx="-18" cy="-107" rx="49" ry="57"/><ellipse cx="31" cy="-104" rx="50" ry="58"/><ellipse cx="66" cy="-72" rx="42" ry="48"/><ellipse cx="18" cy="-57" rx="55" ry="45"/></g><g fill="#83c963" opacity=".82"><ellipse cx="-25" cy="-125" rx="23" ry="27"/><ellipse cx="25" cy="-125" rx="24" ry="29"/><ellipse cx="61" cy="-84" rx="20" ry="24"/></g></g></g>
    <!-- A colorful tulip colony fills the left bank in the middle distance. -->
    <g transform="translate(185 675)"><g class="env-s2-grass">
      <g stroke="#397642" stroke-width="4" stroke-linecap="round"><path d="M0 38 V5 M28 42 V3 M58 38 V-2 M90 44 V8 M122 39 V0 M154 43 V6"/></g>
      <g><path d="M-10 5 Q0 -12 10 5 Q0 18 -10 5Z" fill="#f45f7d"/><path d="M18 3 Q28 -15 38 3 Q28 17 18 3Z" fill="#f6c64f"/><path d="M48 -2 Q58 -20 68 -2 Q58 13 48 -2Z" fill="#a96be0"/><path d="M80 8 Q90 -10 100 8 Q90 22 80 8Z" fill="#f185b2"/><path d="M112 0 Q122 -18 132 0 Q122 15 112 0Z" fill="#ee6a45"/><path d="M144 6 Q154 -12 164 6 Q154 21 144 6Z" fill="#f5d85f"/></g>
      <g fill="#5b9a52"><ellipse cx="-7" cy="24" rx="11" ry="4" transform="rotate(-30 -7 24)"/><ellipse cx="36" cy="25" rx="11" ry="4" transform="rotate(28 36 25)"/><ellipse cx="50" cy="19" rx="11" ry="4" transform="rotate(-28 50 19)"/><ellipse cx="100" cy="28" rx="11" ry="4" transform="rotate(30 100 28)"/><ellipse cx="132" cy="20" rx="11" ry="4" transform="rotate(-30 132 20)"/></g>
    </g></g>
    <!-- Turtle moved into the deeper left bank, walking toward the tulips. -->
    <g transform="translate(360 675) scale(.88)"><g class="env-turtle-walk"><ellipse cx="0" cy="0" rx="28" ry="17" fill="#547a3e"/><path d="M-23 0 Q0 -28 23 0 Q0 17 -23 0Z" fill="#78964b"/><path d="M-14 -5 L14 7 M14 -5 L-14 7 M0 -16 V12" stroke="#a8b96d" stroke-width="2" opacity=".8"/><circle cx="31" cy="1" r="9" fill="#6f9450"/><circle cx="34" cy="-1" r="1.8" fill="#172417"/><path d="M-17 11 l-9 8 M17 11 l9 8 M-18 -10 l-8 -7 M17 -10 l8 -7" stroke="#587a42" stroke-width="5" stroke-linecap="round"/></g></g>
    <!-- Ground-feeding birds: independent pecking rhythms. -->
    <g transform="translate(365 724) rotate(27) scale(1.25)"><g class="env-bird-peck"><path d="M-6 -1 Q-15 -8 -22 -5 L-12 5 Q-8 6 -5 3Z" fill="#526b84"/><ellipse rx="10" ry="7" fill="#7b95ad"/><circle cx="8" cy="-6" r="6" fill="#9bb1c4"/><circle cx="10" cy="-8" r="1.5" fill="#17212a"/><path d="M14 -6 l8 3 -8 3Z" fill="#d6a34d"/></g></g>
    <g transform="translate(220 763) scale(1.2)"><g class="env-bird-peck env-bird-late"><path d="M-5 -1 Q-14 -7 -20 -4 L-11 5 Q-7 6 -4 3Z" fill="#8d624c"/><ellipse rx="9" ry="6" fill="#b48765"/><circle cx="7" cy="-5" r="5" fill="#d3ab87"/><circle cx="9" cy="-7" r="1.4" fill="#241a16"/><path d="M12 -5 l7 3 -7 3Z" fill="#d6a34d"/></g></g>
    <g transform="translate(280 751) scale(-1.25 1.25)"><g class="env-bird-peck env-bird-later"><path d="M-6 -1 Q-15 -8 -22 -5 L-12 5 Q-8 6 -5 3Z" fill="#536c50"/><ellipse rx="10" ry="7" fill="#78906f"/><circle cx="8" cy="-6" r="6" fill="#a8b69b"/><circle cx="10" cy="-8" r="1.5" fill="#17221a"/><path d="M14 -6 l8 3 -8 3Z" fill="#d6a34d"/></g></g>
    <g transform="translate(250 773)" fill="#e7bd47"><circle cx="-18" cy="0" r="2.4"/><circle cx="-12" cy="-3" r="2"/><circle cx="-6" cy="0" r="2.6"/><circle cx="0" cy="-2" r="2"/><circle cx="7" cy="1" r="2.4"/><circle cx="-4" cy="-5" r="2"/></g>
    <!-- Low brush and a fallen log replace the former shepherd area. -->
    <g transform="translate(1080 720)">
      <path d="M-34 8 Q-4 -8 42 3" stroke="#68482f" stroke-width="19" stroke-linecap="round"/>
      <ellipse cx="43" cy="3" rx="10" ry="12" fill="#9a7048"/><ellipse cx="43" cy="3" rx="5" ry="7" fill="none" stroke="#6e4d34" stroke-width="2"/>
      <path d="M-26 -1 l-17 -18 M4 -4 l12 -20" stroke="#65462f" stroke-width="6" stroke-linecap="round"/>
      <g fill="#689b56"><circle cx="-48" cy="7" r="20"/><circle cx="-29" cy="-2" r="24"/><circle cx="2" cy="2" r="19"/><circle cx="66" cy="9" r="18"/><circle cx="83" cy="3" r="21"/></g>
      <g fill="#9cc278" opacity=".8"><circle cx="-35" cy="-12" r="10"/><circle cx="73" cy="-8" r="9"/></g>
    </g>
    <!-- A soft country footpath curls away from the stream into the foreground. -->
    <g transform="translate(60 0)">
    <path d="M690 700 Q760 730 785 770 Q815 815 900 900 L1060 900 Q925 820 900 770 Q875 722 770 684Z" fill="#c7ad78" opacity=".92"/>
    <path d="M706 699 Q780 733 806 773 Q842 826 942 900" stroke="#e1ca98" stroke-width="5" fill="none" opacity=".62" stroke-linecap="round"/>
    <g fill="#8d805f" opacity=".88">
      <ellipse cx="742" cy="718" rx="11" ry="6" transform="rotate(-18 742 718)"/><ellipse cx="825" cy="772" rx="14" ry="8" transform="rotate(14 825 772)"/>
      <ellipse cx="865" cy="830" rx="12" ry="7" transform="rotate(-12 865 830)"/><ellipse cx="975" cy="876" rx="16" ry="9" transform="rotate(10 975 876)"/>
    </g>
    <!-- Naturally scattered edge stones and one mossy path rock. -->
    <g>
      <g fill="#827b68"><ellipse cx="705" cy="717" rx="13" ry="8" transform="rotate(-16 705 717)"/><ellipse cx="754" cy="758" rx="10" ry="7"/><ellipse cx="802" cy="814" rx="15" ry="9" transform="rotate(12 802 814)"/><ellipse cx="858" cy="865" rx="12" ry="8"/></g>
      <g fill="#9a927b"><ellipse cx="787" cy="704" rx="10" ry="6"/><ellipse cx="873" cy="752" rx="13" ry="8" transform="rotate(-12 873 752)"/><ellipse cx="930" cy="805" rx="11" ry="7"/><ellipse cx="1015" cy="871" rx="14" ry="9" transform="rotate(15 1015 871)"/></g>
      <g transform="translate(940 785)">
        <path d="M-38 25 Q-34 -11 -10 -30 Q18 -34 39 -8 Q50 15 31 29 H-27Z" fill="#777865"/>
        <path d="M-28 10 Q-22 -12 -6 -23 Q11 -26 26 -10 Q10 -5 -2 8 Q-15 15 -28 10Z" fill="#999b83" opacity=".82"/>
        <path d="M-17 -13 Q-3 -25 14 -15 Q4 -5 -11 1Z" fill="#76945e" opacity=".78"/>
        <ellipse cx="3" cy="29" rx="43" ry="8" fill="#536742" opacity=".2"/>
      </g>
    </g>
    <g transform="translate(720 760)"><g class="env-s2-grass slow" stroke="#397947" stroke-width="4" stroke-linecap="round" fill="none"><path d="M0 28 Q7 5 13 -9 M14 28 Q22 2 32 -13 M34 28 Q41 8 49 -5 M172 58 Q179 32 187 18 M190 60 Q198 28 207 13 M211 62 Q218 38 228 24"/></g></g>
    <g transform="translate(760 744)">
      <g stroke="#4d874c" stroke-width="2.5"><path d="M0 16 V0 M22 18 V1 M46 17 V-2 M190 70 V51 M216 74 V53"/></g>
      <g fill="#fffdf0"><circle cx="0" cy="-2" r="5"/><circle cx="22" cy="-1" r="5"/><circle cx="46" cy="-4" r="5"/><circle cx="190" cy="49" r="5"/><circle cx="216" cy="51" r="5"/></g>
      <g fill="#f2c84c"><circle cx="0" cy="-2" r="2"/><circle cx="22" cy="-1" r="2"/><circle cx="46" cy="-4" r="2"/><circle cx="190" cy="49" r="2"/><circle cx="216" cy="51" r="2"/></g>
    </g>
    <g transform="translate(930 810)">
      <path d="M0 20 V5 M22 22 V8 M40 21 V2" stroke="#eee2c1" stroke-width="6" stroke-linecap="round"/>
      <path d="M-13 6 Q0 -11 13 6Z" fill="#cf6856"/><path d="M10 9 Q22 -6 34 9Z" fill="#e39a59"/><path d="M27 3 Q40 -14 53 3Z" fill="#bd5f50"/>
      <g fill="#f8e4c4"><circle cx="-3" cy="1" r="2"/><circle cx="7" cy="2" r="2"/><circle cx="18" cy="5" r="1.8"/><circle cx="37" cy="-1" r="2"/></g>
    </g>
    </g>
    <!-- Two perched birds beneath the tree canopies. -->
    <g transform="translate(190 570) scale(1.2)"><g class="env-bird-perch"><path d="M-6 -1 Q-16 -9 -23 -6 L-12 5 Q-8 6 -5 3Z" fill="#48637d"/><ellipse rx="10" ry="7" fill="#627e9b"/><circle cx="8" cy="-6" r="6" fill="#8fa6bd"/><circle cx="10" cy="-8" r="1.5" fill="#17212a"/><path d="M14 -6 l8 3 -8 3Z" fill="#d9a54b"/></g></g>
    <g transform="translate(1225 585) scale(1.2)"><ellipse cx="0" cy="5" rx="19" ry="8" fill="#6f4b31"/><path d="M-16 3 Q0 -9 16 3 M-14 7 Q0 -3 14 7" stroke="#a27a50" stroke-width="3" fill="none"/><g class="env-bird-perch env-bird-late"><path d="M-6 -1 Q-16 -8 -22 -5 L-12 5 Q-8 6 -5 3Z" fill="#7f5049"/><ellipse rx="10" ry="7" fill="#a76d61"/><circle cx="8" cy="-6" r="6" fill="#c99382"/><circle cx="10" cy="-8" r="1.5" fill="#281915"/><path d="M14 -6 l8 3 -8 3Z" fill="#d9a54b"/></g></g>`,

    // Stage 4 â€” lush spring Sakura Garden, bright blue sky, rolling alpine hills & falling petals
    `<defs>
      <linearGradient id="s4sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#3b9de3"/>
        <stop offset="45%" stop-color="#6ee2ec"/>
        <stop offset="100%" stop-color="#cbf4e2"/>
      </linearGradient>
      <radialGradient id="s4sun" cx="0.2" cy="0.18" r="0.45">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
        <stop offset="35%" stop-color="#fff4b8" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="#fff4b8" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="s4ray" x1="0" y1="0" x2="0.5" y2="1">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="s4river" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#76d0e8" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="#a4f4e0" stop-opacity="0.95"/>
      </linearGradient>
      <linearGradient id="s4mist" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#d4f6e8" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="#d4f6e8" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <!-- Sky & Sun -->
    <rect width="1440" height="900" fill="url(#s4sky)"/>
    <circle cx="280" cy="150" r="160" fill="url(#s4sun)"/>
    <g class="env-rays" opacity="0.85">
      <polygon points="280,150 -50,650 100,650" fill="url(#s4ray)"/>
      <polygon points="280,150 160,900 380,900" fill="url(#s4ray)"/>
      <polygon points="280,150 560,900 800,900" fill="url(#s4ray)"/>
    </g>
    <!-- Drifting White Clouds -->
    <g class="env-clouds" opacity="0.85" fill="#ffffff">
      <path d="M80 150 Q110 110 150 120 Q190 100 230 130 Q260 120 280 150 Q290 170 260 180 L100 180 Z"/>
      <path d="M740 120 Q765 90 800 100 Q835 80 870 105 Q895 95 915 120 Q925 140 900 150 L755 150 Z" opacity="0.75"/>
      <path d="M1140 170 Q1165 140 1200 150 Q1235 130 1270 155 Q1295 145 1315 170 Q1325 190 1300 200 L1155 200 Z" opacity="0.7"/>
    </g>
    <!-- Organic snow-dusted Alpine ranges: layered, irregular and atmospheric. -->
    <path d="M0 448 Q95 392 180 420 Q278 350 365 412 Q455 332 552 406 Q650 354 742 418 Q842 344 935 410 Q1038 350 1128 414 Q1230 338 1320 402 Q1384 370 1440 406 V560 H0Z" fill="#75aaa4" opacity=".32"/>
    <path d="M0 512 L118 432 Q148 398 181 428 L286 480 L420 372 Q452 338 487 376 L632 462 L786 388 Q820 352 856 394 L1010 466 L1170 382 Q1205 345 1242 389 L1340 438 L1440 397 V606 H0Z" fill="#3c867c" opacity=".55"/>
    <path d="M0 558 Q150 480 300 524 Q438 455 585 516 Q725 455 865 520 Q1015 460 1165 518 Q1305 458 1440 506 V635 H0Z" fill="#2e746a" opacity=".58"/>
    <g fill="#edf7f5" opacity=".72"><path d="M420 372 Q452 338 487 376 L467 368 L452 391 L438 367Z"/><path d="M786 388 Q820 352 856 394 L836 383 L820 406 L806 382Z"/><path d="M1170 382 Q1205 345 1242 389 L1220 378 L1205 401 L1190 377Z"/></g>
    <g fill="#235f58" opacity=".36"><path d="M88 530 l9 -25 9 25Z M115 526 l8 -22 8 22Z M335 505 l9 -25 9 25Z M365 510 l8 -22 8 22Z M690 505 l9 -25 9 25Z M718 512 l8 -22 8 22Z M1065 500 l9 -25 9 25Z M1095 506 l8 -22 8 22Z M1360 486 l9 -25 9 25Z"/></g>
    <!-- Valley Floor & Winding River -->
    <path d="M0 600 Q360 540 720 580 T1440 570 L1440 900 L0 900Z" fill="#69b848"/>
    <path d="M720 580 Q660 620 685 670 T750 730 T670 810 T720 900 L785 900 Q720 810 L790 730 Q725 670 750 580 Z" fill="url(#s4river)"/>
    <!-- Valley Mist Layer -->
    <rect x="0" y="560" width="1440" height="120" fill="url(#s4mist)" class="env-mist"/>
    <!-- Midground Rolling Hills -->
    <path d="M0 660 Q420 615 780 645 T1440 635 L1440 900 L0 900Z" fill="#52a035"/>
    <path d="M0 730 Q380 690 760 715 T1440 705 L1440 900 L0 900Z" fill="#3f8826"/>
    <!-- Midground Sakura Groves (Slope Accents) -->
    <g transform="translate(1140, 590)">
      <path d="M0 35 Q-4 15 0 0" stroke="#3d261a" stroke-width="5" fill="none"/>
      <path d="M0 -15 Q-25 -25 -38 0 Q-15 25 0 15 Z" fill="#e77f9d"/>
      <path d="M0 -15 Q25 -25 38 0 Q15 25 0 15 Z" fill="#f78fb3"/>
      <circle cx="0" cy="-18" r="28" fill="#f8a5c2"/>
    </g>
    <!-- Foreground High Cliff Bluff (Bottom Right) -->
    <path d="M920 900 Q1040 690 1440 670 L1440 900 Z" fill="#2d6e1b"/>
    <path d="M960 900 Q1070 715 1440 700 L1440 900 Z" fill="#225414"/>
    <!-- Static Petal Drifts on Bluff Edge -->
    <path d="M1060 745 Q1200 710 1380 730 Q1240 760 1060 745 Z" fill="#f8a5c2" opacity="0.85"/>
    <path d="M1120 760 Q1240 735 1350 750 Q1240 775 1120 760 Z" fill="#f78fb3" opacity="0.8"/>
    <!-- Detailed Wildflowers & Grass Tufts -->
    <g fill="#f78fb3">
      <circle cx="1020" cy="760" r="3.5"/><circle cx="1035" cy="755" r="4"/><circle cx="1050" cy="762" r="3"/>
      <circle cx="1240" cy="735" r="3.5"/><circle cx="1255" cy="730" r="4"/><circle cx="1270" cy="738" r="3"/>
    </g>
    <g fill="#f6d743">
      <circle cx="1080" cy="770" r="3"/><circle cx="1095" cy="765" r="3.5"/><circle cx="1290" cy="745" r="3"/>
    </g>
    <g fill="#ffffff">
      <circle cx="1140" cy="778" r="2.5"/><circle cx="1155" cy="772" r="3"/><circle cx="1330" cy="752" r="2.5"/>
    </g>
    <!-- Stage 4-specific flowers: lupines, irises and alpine flowering shrubs. -->
    <g transform="translate(105 735)"><g class="env-s2-grass slow">
      <g stroke="#327246" stroke-width="4" stroke-linecap="round"><path d="M0 68 V5 M34 72 V0 M70 66 V8 M105 74 V-2 M142 68 V6"/></g>
      <g><path d="M-10 24 Q0 -12 10 24Z" fill="#8f68d9"/><path d="M24 20 Q34 -18 44 20Z" fill="#ba75df"/><path d="M60 27 Q70 -8 80 27Z" fill="#695fd0"/><path d="M95 19 Q105 -22 115 19Z" fill="#d58acb"/><path d="M132 25 Q142 -10 152 25Z" fill="#7b73df"/></g>
      <g fill="#f0d2f0" opacity=".8"><circle cx="0" cy="4" r="3"/><circle cx="34" cy="0" r="3"/><circle cx="70" cy="8" r="3"/><circle cx="105" cy="-2" r="3"/><circle cx="142" cy="6" r="3"/></g>
    </g></g>
    <g transform="translate(275 790)"><g class="env-s2-grass">
      <g stroke="#39784c" stroke-width="4"><path d="M0 48 V10 M38 52 V13 M75 48 V8"/></g>
      <g fill="#6676df"><path d="M-18 12 Q0 -8 18 12 Q5 17 0 32 Q-5 17 -18 12Z"/><path d="M20 15 Q38 -5 56 15 Q43 20 38 35 Q33 20 20 15Z"/><path d="M57 10 Q75 -10 93 10 Q80 15 75 30 Q70 15 57 10Z"/></g>
      <g fill="#f2c94e"><circle cx="0" cy="13" r="4"/><circle cx="38" cy="16" r="4"/><circle cx="75" cy="11" r="4"/></g>
    </g></g>
    <g transform="translate(1020 790)">
      <g fill="#b84f86"><circle cx="0" cy="8" r="24"/><circle cx="28" cy="0" r="29"/><circle cx="62" cy="8" r="25"/><circle cx="88" cy="14" r="20"/></g>
      <g fill="#f28eb4"><circle cx="9" cy="0" r="8"/><circle cx="31" cy="-10" r="9"/><circle cx="55" cy="1" r="8"/><circle cx="80" cy="7" r="7"/></g>
      <g fill="#f8d7e5"><circle cx="6" cy="-2" r="3"/><circle cx="31" cy="-12" r="3"/><circle cx="55" cy="-1" r="3"/><circle cx="80" cy="5" r="3"/></g>
    </g>
    <g transform="translate(1280 805) scale(.9)">
      <g fill="#a9477e"><circle cx="0" cy="8" r="23"/><circle cx="27" cy="0" r="28"/><circle cx="58" cy="9" r="24"/></g>
      <g fill="#ed82ac"><circle cx="7" cy="1" r="8"/><circle cx="29" cy="-9" r="9"/><circle cx="53" cy="2" r="8"/></g>
    </g>
    <!-- Intricate Organic Sakura Framing Branch (Top Left) -->
    <g class="env-fg-sway" transform="translate(0, 0)">
      <!-- Detailed Branching Splines -->
      <path d="M-30 -10 Q140 30 310 135 Q380 180 440 225" stroke="#331e13" stroke-width="16" stroke-linecap="round" fill="none"/>
      <path d="M150 42 Q240 95 300 165" stroke="#331e13" stroke-width="9" stroke-linecap="round" fill="none"/>
      <path d="M280 120 Q350 135 410 168" stroke="#331e13" stroke-width="7" stroke-linecap="round" fill="none"/>
      <path d="M80 18 Q140 60 190 95" stroke="#331e13" stroke-width="6" stroke-linecap="round" fill="none"/>
      <!-- Organic Layered Blossom Masses -->
      <path d="M110 15 Q170 -25 240 15 Q280 60 210 90 Q140 95 110 50 Z" fill="#d96b8a"/>
      <path d="M130 25 Q180 -10 230 25 Q260 60 200 80 Q150 80 130 50 Z" fill="#e77f9d"/>
      <path d="M150 30 Q190 5 220 30 Q240 60 190 70 Q160 70 150 50 Z" fill="#f78fb3"/>
      <!-- Mid Cluster -->
      <path d="M210 90 Q280 50 350 95 Q390 145 320 175 Q250 180 210 130 Z" fill="#d96b8a"/>
      <path d="M230 100 Q290 65 340 105 Q370 145 310 165 Q260 165 230 135 Z" fill="#e77f9d"/>
      <path d="M250 110 Q300 80 330 115 Q350 145 300 155 Q270 155 250 135 Z" fill="#f8a5c2"/>
      <!-- Outer Tip Cluster -->
      <path d="M320 150 Q380 120 430 160 Q460 205 400 230 Q340 235 320 190 Z" fill="#e77f9d"/>
      <path d="M340 160 Q395 135 435 170 Q455 205 405 220 Q360 220 340 195 Z" fill="#f78fb3"/>
      <path d="M360 170 Q405 150 430 178 Q445 205 405 212 Q375 210 360 195 Z" fill="#fce4ec"/>
      <!-- Delicate Petal Highlights -->
      <circle cx="180" cy="35" r="16" fill="#ffffff" opacity="0.65"/>
      <circle cx="280" cy="115" r="18" fill="#ffffff" opacity="0.65"/>
      <circle cx="385" cy="180" r="15" fill="#ffffff" opacity="0.7"/>
    </g>`,

    // Stage 5 â€” Night of the completed world: Stage 4 valley after dusk.
    // Same sakura, river, meadows â€” now moonlit, framed by great trees, fireflies.
    `<defs>
      <linearGradient id="s5sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0c1028"/>
        <stop offset="38%" stop-color="#1a1650"/>
        <stop offset="72%" stop-color="#2a2468"/>
        <stop offset="100%" stop-color="#3a2a5a"/>
      </linearGradient>
      <radialGradient id="s5moon" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stop-color="#f7f3e4" stop-opacity="1"/>
        <stop offset="38%" stop-color="#e8e4d4" stop-opacity="0.95"/>
        <stop offset="70%" stop-color="#c8d4f0" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#c8d4f0" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="s5river" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#4a6a98" stop-opacity="0.75"/>
        <stop offset="100%" stop-color="#1c2848" stop-opacity="0.92"/>
      </linearGradient>
      <linearGradient id="s5mist" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#2a2468" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#2a2468" stop-opacity="0"/>
      </linearGradient>
      <radialGradient id="s5glow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stop-color="#ffe9a0" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#ffe9a0" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="s5aurora" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#65e0c2" stop-opacity="0"/>
        <stop offset="45%" stop-color="#65e0c2" stop-opacity=".28"/>
        <stop offset="75%" stop-color="#c685e8" stop-opacity=".2"/>
        <stop offset="100%" stop-color="#c685e8" stop-opacity="0"/>
      </linearGradient>
    </defs>

    <rect width="1440" height="900" fill="url(#s5sky)"/>
    <g class="env-rays" opacity=".8">
      <path d="M140 -40 Q430 170 760 40 T1340 80 Q1050 170 740 120 T140 -40Z" fill="url(#s5aurora)"/>
      <path d="M-80 90 Q360 245 720 105 T1510 120 Q1110 260 700 190 T-80 90Z" fill="url(#s5aurora)" opacity=".55"/>
    </g>
    <g fill="#eef2ff">
      <circle cx="180" cy="70" r="1.2" opacity="0.7"/>
      <circle cx="260" cy="120" r="1.6" opacity="0.9"/>
      <circle cx="420" cy="55" r="1.1" opacity="0.55"/>
      <circle cx="510" cy="95" r="1.4" opacity="0.8"/>
      <circle cx="640" cy="40" r="1.2" opacity="0.65"/>
      <circle cx="780" cy="88" r="1.8" opacity="0.95"/>
      <circle cx="900" cy="50" r="1.1" opacity="0.5"/>
      <circle cx="1040" cy="110" r="1.3" opacity="0.75"/>
      <circle cx="1280" cy="62" r="1.5" opacity="0.85"/>
      <circle cx="1360" cy="130" r="1.1" opacity="0.6"/>
      <circle cx="90" cy="150" r="1" opacity="0.45"/>
      <circle cx="330" cy="180" r="1.2" opacity="0.55"/>
    </g>
    <circle cx="1180" cy="128" r="92" fill="url(#s5moon)" class="env-sun-glow"/>
    <circle cx="1180" cy="128" r="42" fill="#f4f0e0"/>
    <circle cx="1192" cy="118" r="7" fill="#d8d4c8" opacity="0.35"/>

    <path d="M0 500 L140 380 L280 450 L440 350 L620 440 L820 370 L1020 450 L1220 370 L1440 440 L1440 620 L0 620Z" fill="#1a2848" opacity="0.75"/>
    <path d="M0 540 L180 440 L340 490 L500 400 L700 480 L900 410 L1100 480 L1300 420 L1440 470 L1440 640 L0 640Z" fill="#152038" opacity="0.85"/>
    <path d="M440 350 L468 392 L412 392 Z" fill="#dce6f4" opacity="0.28"/>
    <path d="M820 370 L852 418 L788 418 Z" fill="#dce6f4" opacity="0.22"/>

    <path d="M0 600 Q360 540 720 580 T1440 570 L1440 900 L0 900Z" fill="#1c3a28"/>
    <path class="env-stream" d="M720 580 Q660 620 685 670 T750 730 T670 810 T720 900 L785 900 Q720 810 L790 730 Q725 670 750 580 Z" fill="url(#s5river)"/>
    <path d="M728 590 Q678 628 700 676 T762 734 T688 812" stroke="#c8d8f8" stroke-width="1.6" fill="none" opacity="0.28"/>
    <path d="M1172 172 Q1050 350 760 585 Q730 650 752 730 T700 900" stroke="#dbe8ff" stroke-width="14" fill="none" opacity=".08"/>
    <rect x="0" y="540" width="1440" height="130" fill="url(#s5mist)" class="env-mist"/>

    <path d="M0 660 Q420 615 780 645 T1440 635 L1440 900 L0 900Z" fill="#163224"/>
    <path d="M0 730 Q380 690 760 715 T1440 705 L1440 900 L0 900Z" fill="#12281c"/>

    <g transform="translate(1140, 590)">
      <path d="M0 35 Q-4 15 0 0" stroke="#1a100c" stroke-width="5" fill="none"/>
      <path d="M0 -15 Q-25 -25 -38 0 Q-15 25 0 15 Z" fill="#8a3d5c"/>
      <path d="M0 -15 Q25 -25 38 0 Q15 25 0 15 Z" fill="#b85a7a"/>
      <circle cx="0" cy="-18" r="28" fill="#c46a88"/>
      <circle cx="-8" cy="-22" r="8" fill="#f0c4d4" opacity="0.35"/>
    </g>

    <path d="M920 900 Q1040 690 1440 670 L1440 900 Z" fill="#0e2418"/>
    <path d="M960 900 Q1070 715 1440 700 L1440 900 Z" fill="#0a1c12"/>
    <path d="M1060 745 Q1200 710 1380 730 Q1240 760 1060 745 Z" fill="#8a3d5c" opacity="0.55"/>
    <path d="M1120 760 Q1240 735 1350 750 Q1240 775 1120 760 Z" fill="#b85a7a" opacity="0.5"/>

    <g fill="#e8a0b8" opacity="0.85">
      <circle cx="1020" cy="760" r="3.5"/><circle cx="1035" cy="755" r="4"/><circle cx="1050" cy="762" r="3"/>
      <circle cx="1240" cy="735" r="3.5"/><circle cx="1255" cy="730" r="4"/>
    </g>
    <g fill="#ffe08a" opacity="0.8">
      <circle cx="1080" cy="770" r="3"/><circle cx="1095" cy="765" r="3.5"/><circle cx="1290" cy="745" r="3"/>
    </g>
    <g fill="#fff4c8" opacity="0.7">
      <circle cx="1140" cy="778" r="2.5"/><circle cx="1155" cy="772" r="3"/>
    </g>
    <circle cx="1035" cy="755" r="10" fill="url(#s5glow)"/>
    <circle cx="1255" cy="730" r="10" fill="url(#s5glow)"/>
    <circle cx="1095" cy="765" r="8" fill="url(#s5glow)"/>

    <!-- Golden lantern path: a celebratory destination beyond the board. -->
    <g fill="#ffd878" stroke="#7a4c24" stroke-width="3">
      <rect x="500" y="675" width="20" height="30" rx="5"/><rect x="900" y="670" width="20" height="30" rx="5"/>
      <rect x="390" y="760" width="24" height="36" rx="6"/><rect x="1010" y="760" width="24" height="36" rx="6"/>
    </g>
    <g stroke="#432b1d" stroke-width="5"><path d="M510 705 V742"/><path d="M910 700 V737"/><path d="M402 796 V840"/><path d="M1022 796 V840"/></g>
    <g fill="url(#s5glow)"><circle cx="510" cy="690" r="30"/><circle cx="910" cy="685" r="30"/><circle cx="402" cy="778" r="38"/><circle cx="1022" cy="778" r="38"/></g>

    <!-- A mature moonlit branch, distinct from Stage 4's blossom-heavy Sakura canopy. -->
    <g class="env-fg-sway" transform="translate(-18, -8)">
      <g fill="none" stroke-linecap="round">
        <path d="M-35 4 Q92 16 190 68 Q286 118 410 205 Q455 238 492 278" stroke="#0c0909" stroke-width="20"/>
        <path d="M112 34 Q178 52 249 26 Q291 10 335 24" stroke="#130d0d" stroke-width="10"/>
        <path d="M192 70 Q242 106 274 163 Q294 199 334 224" stroke="#130d0d" stroke-width="9"/>
        <path d="M291 126 Q358 123 420 86" stroke="#130d0d" stroke-width="8"/>
        <path d="M372 179 Q428 185 474 161" stroke="#130d0d" stroke-width="6"/>
        <path d="M54 17 Q102 54 121 104" stroke="#130d0d" stroke-width="7"/>
      </g>
      <g fill="#274d45">
        <ellipse cx="56" cy="31" rx="30" ry="15" transform="rotate(28 56 31)"/><ellipse cx="91" cy="52" rx="29" ry="14" transform="rotate(-20 91 52)"/>
        <ellipse cx="116" cy="81" rx="31" ry="15" transform="rotate(48 116 81)"/><ellipse cx="146" cy="42" rx="34" ry="16" transform="rotate(-22 146 42)"/>
        <ellipse cx="181" cy="24" rx="31" ry="15" transform="rotate(-10 181 24)"/><ellipse cx="218" cy="34" rx="34" ry="16" transform="rotate(18 218 34)"/>
        <ellipse cx="256" cy="22" rx="31" ry="14" transform="rotate(-18 256 22)"/><ellipse cx="301" cy="30" rx="35" ry="16" transform="rotate(20 301 30)"/>
        <ellipse cx="171" cy="73" rx="34" ry="17" transform="rotate(24 171 73)"/><ellipse cx="216" cy="94" rx="35" ry="17" transform="rotate(-16 216 94)"/>
        <ellipse cx="249" cy="126" rx="32" ry="15" transform="rotate(43 249 126)"/><ellipse cx="273" cy="165" rx="31" ry="14" transform="rotate(58 273 165)"/>
        <ellipse cx="309" cy="130" rx="34" ry="16" transform="rotate(-12 309 130)"/><ellipse cx="351" cy="119" rx="33" ry="15" transform="rotate(12 351 119)"/>
        <ellipse cx="393" cy="96" rx="31" ry="14" transform="rotate(-27 393 96)"/><ellipse cx="329" cy="180" rx="35" ry="17" transform="rotate(29 329 180)"/>
        <ellipse cx="368" cy="203" rx="34" ry="16" transform="rotate(-13 368 203)"/><ellipse cx="409" cy="190" rx="32" ry="15" transform="rotate(20 409 190)"/>
        <ellipse cx="446" cy="170" rx="30" ry="14" transform="rotate(-18 446 170)"/><ellipse cx="414" cy="229" rx="34" ry="16" transform="rotate(31 414 229)"/>
        <ellipse cx="451" cy="251" rx="31" ry="15" transform="rotate(-9 451 251)"/><ellipse cx="482" cy="278" rx="28" ry="13" transform="rotate(38 482 278)"/>
      </g>
      <g fill="#3d7161">
        <ellipse cx="77" cy="20" rx="22" ry="10" transform="rotate(-16 77 20)"/><ellipse cx="132" cy="62" rx="23" ry="11" transform="rotate(32 132 62)"/>
        <ellipse cx="199" cy="52" rx="24" ry="11" transform="rotate(-12 199 52)"/><ellipse cx="273" cy="45" rx="22" ry="10" transform="rotate(25 273 45)"/>
        <ellipse cx="233" cy="112" rx="23" ry="11" transform="rotate(30 233 112)"/><ellipse cx="291" cy="145" rx="21" ry="10" transform="rotate(-21 291 145)"/>
        <ellipse cx="343" cy="102" rx="23" ry="10" transform="rotate(-18 343 102)"/><ellipse cx="388" cy="173" rx="23" ry="11" transform="rotate(25 388 173)"/>
        <ellipse cx="432" cy="208" rx="21" ry="10" transform="rotate(-12 432 208)"/><ellipse cx="468" cy="258" rx="20" ry="9" transform="rotate(30 468 258)"/>
      </g>
      <g fill="#72a58b" opacity=".72">
        <ellipse cx="84" cy="15" rx="12" ry="5" transform="rotate(-16 84 15)"/><ellipse cx="205" cy="47" rx="13" ry="5" transform="rotate(-12 205 47)"/>
        <ellipse cx="347" cy="96" rx="12" ry="5" transform="rotate(-18 347 96)"/><ellipse cx="392" cy="167" rx="12" ry="5" transform="rotate(25 392 167)"/>
        <ellipse cx="472" cy="253" rx="11" ry="4" transform="rotate(30 472 253)"/>
      </g>
      <g fill="#d999b6">
        <circle cx="158" cy="59" r="6"/><circle cx="166" cy="64" r="5"/><circle cx="321" cy="108" r="6"/><circle cx="329" cy="112" r="5"/>
        <circle cx="422" cy="180" r="5.5"/><circle cx="429" cy="184" r="4.5"/>
      </g>
      <g fill="#f6d5df" opacity=".9"><circle cx="160" cy="60" r="2"/><circle cx="323" cy="109" r="2"/><circle cx="424" cy="181" r="2"/></g>
    </g>

    <!-- Framing trees left and right so the board sits in a completed grove -->
    <g transform="translate(70, 720) scale(1.15)">
      <path d="M0 160 Q-12 40 -22 -80 Q-28 -150 -48 -220" stroke="#0c0806" stroke-width="22" stroke-linecap="round" fill="none"/>
      <path d="M-16 20 Q30 -50 70 -120" stroke="#0c0806" stroke-width="10" fill="none"/>
      <ellipse cx="-40" cy="-200" rx="70" ry="55" fill="#0e2418"/>
      <ellipse cx="10" cy="-170" rx="58" ry="46" fill="#163224"/>
      <ellipse cx="50" cy="-130" rx="40" ry="32" fill="#1c3a28"/>
      <circle cx="-20" cy="-210" r="18" fill="#2a5040" opacity="0.7"/>
    </g>
    <g transform="translate(1360, 700) scale(1.2)">
      <path d="M0 160 Q8 40 16 -70 Q22 -140 36 -200" stroke="#0c0806" stroke-width="20" stroke-linecap="round" fill="none"/>
      <path d="M10 10 Q-30 -40 -70 -100" stroke="#0c0806" stroke-width="9" fill="none"/>
      <ellipse cx="40" cy="-180" rx="68" ry="52" fill="#0e2418"/>
      <ellipse cx="-10" cy="-150" rx="54" ry="42" fill="#163224"/>
      <ellipse cx="-50" cy="-110" rx="36" ry="28" fill="#1c3a28"/>
      <circle cx="28" cy="-188" r="16" fill="#2a5040" opacity="0.65"/>
    </g>

    <path d="M30 860 Q55 810 80 860 M50 860 Q70 800 95 860 M100 870 Q125 820 150 870" stroke="#1a3c2c" stroke-width="6" stroke-linecap="round" fill="none"/>
    <path d="M1230 850 Q1255 800 1280 850 M1250 850 Q1270 790 1295 850 M1300 860 Q1325 810 1350 860" stroke="#1a3c2c" stroke-width="6" stroke-linecap="round" fill="none"/>

    <g fill="#ffe9a0" opacity="0.85">
      <circle cx="480" cy="640" r="2.2"/>
      <circle cx="620" cy="700" r="1.8"/>
      <circle cx="860" cy="660" r="2"/>
      <circle cx="980" cy="720" r="1.6"/>
      <circle cx="540" cy="760" r="1.7"/>
    </g>
    <circle cx="480" cy="640" r="9" fill="url(#s5glow)"/>
    <circle cx="860" cy="660" r="8" fill="url(#s5glow)"/>`
  ];

  // Floating particle config per stage
  const STAGE_PARTICLES = [
    { type: "snow", count: 8 },     // stage1 winter snow
    { type: "leaf", count: 5 },     // stage2 fresh green leaves
    { type: "pollen", count: 7 },   // stage3 pale blossom haze
    { type: "petal", count: 10 },   // stage4 lush alpine sakura petals
    { type: "firefly", count: 11 }  // stage5 luminous fireflies
  ];

  function renderStageSVG(stage) {
    if (envEl.hasAttribute("data-phaser-active")) {
      envSkyEl.replaceChildren();
      return;
    }
    envSkyEl.innerHTML = STAGE_SVG[stage - 1];
  }

  function clearEnvParticles() {
    envParticlesEl.innerHTML = "";
  }

  function spawnEnvParticles(stage) {
    if (envEl.hasAttribute("data-phaser-active")) {
      clearEnvParticles();
      return;
    }
    if (reduceMotion || !particlesOn) return;
    clearEnvParticles();
    const cfg = STAGE_PARTICLES[stage - 1];
    const count = document.body.classList.contains("perf-low") ? Math.min(7, cfg.count) : cfg.count;
    for (let i = 0; i < count; i++) {
      const el = document.createElement("span");
      el.className = "env-particle " + cfg.type;
      if (cfg.type === "snow" && i % 3 === 0) {
        el.classList.add("fg");
      }
      el.style.left = Math.random() * 100 + "%";
      el.style.top = (10 + Math.random() * 70) + "%";
      el.style.animationDelay = -Math.random() * 18 + "s";
      el.style.animationDuration = (cfg.type === "snow" && i % 3 === 0 ? 8 + Math.random() * 5 : 14 + Math.random() * 10) + "s";
      if (cfg.type === "firefly" || cfg.type === "pollen") {
        el.style.setProperty("--fx", (Math.random() * 60 - 30) + "px");
        el.style.setProperty("--fy", (Math.random() * 40 - 20) + "px");
      }
      envParticlesEl.appendChild(el);
    }
  }

  function setEnvironmentStage(stage, immediate) {
    if (stage === currentStage && !immediate) return;
    const previousStage = currentStage;
    currentStage = stage;
    envEl.dataset.stage = stage;
    renderStageSVG(stage);
    spawnEnvParticles(stage);
    preloadTileAssets(stage);
    updateEvolutionUI(stage);
    scheduleWorldEvent();
    if (!menuMode && audioCtx?.state === "running" && musicOn) startMusic();
    if (!immediate) {
      playStageRise(stage);
      showStageTransition(stage, previousStage);
    }
  }
  window.debugSetEnvironmentStage = setEnvironmentStage;

  const preloadedTileAssets = new Set();
  const TILE_PRELOAD_GROUPS = [
    [2, 4, 8, 16, 32, 64], [128, 256], [512], [1024, 2048], [4096, 8192]
  ];
  function preloadTileAssets(stage) {
    const values = TILE_PRELOAD_GROUPS.slice(0, Math.max(1, stage)).flat();
    const load = () => values.forEach(value => {
      if (preloadedTileAssets.has(value)) return;
      preloadedTileAssets.add(value);
      const image = new Image();
      image.decoding = "async";
      image.src = `/assets/tiles/v3/tile-${value}.png`;
    });
    if ("requestIdleCallback" in window) requestIdleCallback(load, { timeout: 1200 });
    else setTimeout(load, 120);
  }

  function maybeEvolveEnvironment() {
    const newStage = stageFor(maxValueReached);
    if (newStage !== currentStage) {
      setEnvironmentStage(newStage);
      // Brief gentle reaction on stage transition
      triggerEnvGust(false);
    }
  }

  function showStageTransition(stage, previousStage) {
    // A compositor-only veil softens the scene swap without text, layout work
    // or a synchronous reflow. The game UI remains stable and interactive.
    envEl.classList.remove("stage-soft-transition");
    clearTimeout(showStageTransition._t);
    requestAnimationFrame(() => envEl.classList.add("stage-soft-transition"));
    showStageTransition._t = setTimeout(() => {
      envEl.classList.remove("stage-soft-transition");
    }, reduceMotion || !motionOn ? 100 : 390);
  }

  const EVENT_GLYPHS = ["✦", "●", "✿", "❀", "✧"];
  const EVENT_COLORS = ["#eff9ff", "#82b85f", "#f5d76f", "#f39abb", "#ffe98f"];
  function triggerWorldEvent(stage, strong) {
    if (reduceMotion || !motionOn || !particlesOn || document.hidden) return;
    const count = document.body.classList.contains("perf-low") ? 3 : (strong ? 8 : 5);
    envEl.classList.remove("event-stage-1", "event-stage-2", "event-stage-3", "event-stage-4", "event-stage-5");
    envEl.classList.add(`event-stage-${stage}`);
    clearTimeout(triggerWorldEvent._t);
    triggerWorldEvent._t = setTimeout(() => envEl.classList.remove(`event-stage-${stage}`), 3600);
    for (let i = 0; i < count; i++) {
      const mote = document.createElement("span");
      mote.className = "world-event";
      mote.textContent = EVENT_GLYPHS[stage - 1];
      mote.style.setProperty("--x", `${8 + Math.random() * 84}%`);
      mote.style.setProperty("--y", `${55 + Math.random() * 38}%`);
      mote.style.setProperty("--drift", `${-70 + Math.random() * 140}px`);
      mote.style.setProperty("--size", `${10 + Math.random() * 13}px`);
      mote.style.setProperty("--event-color", EVENT_COLORS[stage - 1]);
      mote.style.animationDelay = `${Math.random() * .8}s`;
      worldEventLayerEl.appendChild(mote);
      mote.addEventListener("animationend", () => mote.remove(), { once: true });
    }
    triggerEnvGust(stage >= 4 || strong);
  }

  function scheduleWorldEvent() {
    clearTimeout(worldEventTimer);
    worldEventTimer = setTimeout(() => {
      triggerWorldEvent(currentStage, false);
      scheduleWorldEvent();
    }, 15000 + Math.random() * 14000);
  }

  // Subtle gust: briefly intensify particle drift via a CSS class
  let gustTimer = null;
  function triggerEnvGust(strong) {
    if (reduceMotion) return;
    envEl.classList.add(strong ? "gust-strong" : "gust");
    clearTimeout(gustTimer);
    gustTimer = setTimeout(() => {
      envEl.classList.remove("gust", "gust-strong");
    }, strong ? 1800 : 1200);
  }

  /* ---------- New game ---------- */
  function newGame() {
    gameGeneration++;
    completedMoves = 0;
    closeRestart(false);
    gameSession = null;
    gameSessionPromise = null;
    // The boot-time board is hidden behind the menu. Start the signed timer
    // only once the player is actually playing, not while they read the menu.
    if (!menuMode) ensureGameSession().catch(() => {});
    grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    tiles = {};
    nextId = 1;
    score = 0;
    goldenAchieved = false;
    victoryAchieved = false;
    busy = false;
    queuedDirection = null;
    maxValueReached = 0;
    bestCombo = 0;
    scoreSubmitted = false;
    resetCombo();
    tilesEl.innerHTML = "";
    boardEl.querySelectorAll(".particle").forEach(p => p.remove());
    tilesEl.querySelectorAll(".particle").forEach(p => p.remove());
    hideGameOver();
    setEnvironmentStage(1, true);
    measure();
    spawn();
    spawn();
    updateScore();
  }

  function buildGrid() {
    gridEl.innerHTML = "";
    for (let i = 0; i < SIZE * SIZE; i++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      gridEl.appendChild(cell);
    }
  }

  /* ---------- Controls ---------- */
  const KEY = {
    ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
    a: "left", d: "right", w: "up", s: "down",
    A: "left", D: "right", W: "up", S: "down"
  };
  window.addEventListener("keydown", e => {
    if (e.target instanceof HTMLElement && e.target.matches("input, textarea, select, [contenteditable='true']")) return;
    const dir = KEY[e.key];
    if (!dir) return;
    e.preventDefault();
    ensureAudio();
    move(dir);
  }, { passive: false });

  let ptrStart = null;
  function isInteractiveControl(target) {
    return target instanceof Element && Boolean(target.closest("input, textarea, select, button, form, [contenteditable='true']"));
  }
  boardEl.addEventListener("pointerdown", e => {
    if (isInteractiveControl(e.target)) {
      ptrStart = null;
      return;
    }
    ensureAudio();
    ptrStart = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  boardEl.addEventListener("pointermove", e => {
    if (isInteractiveControl(e.target)) return;
    if (!ptrStart || e.pointerId !== ptrStart.id) return;
    const dx = e.clientX - ptrStart.x;
    const dy = e.clientY - ptrStart.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;
    let dir;
    if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? "right" : "left";
    else dir = dy > 0 ? "down" : "up";
    ptrStart = null;
    move(dir);
  });
  const endPtr = e => { if (ptrStart && e.pointerId === ptrStart.id) ptrStart = null; };
  boardEl.addEventListener("pointerup", endPtr);
  boardEl.addEventListener("pointercancel", endPtr);
  boardEl.addEventListener("pointerleave", endPtr);

  boardEl.addEventListener("touchstart", e => {
    if (!isInteractiveControl(e.target)) e.preventDefault();
  }, { passive: false });
  boardEl.addEventListener("touchmove", e => {
    if (!isInteractiveControl(e.target)) e.preventDefault();
  }, { passive: false });

  function closeRestart(restoreFocus = true) {
    restartPanel.hidden = true;
    newBtn.setAttribute("aria-expanded", "false");
    if (restoreFocus) newBtn.focus();
  }
  newBtn.setAttribute("aria-haspopup", "dialog");
  newBtn.setAttribute("aria-controls", "newGameConfirm");
  newBtn.addEventListener("click", () => {
    ensureAudio();
    if (!completedMoves && !busy) { newGame(); return; }
    if (!restartPanel.hidden) { closeRestart(); return; }
    queuedDirection = null;
    coolFlow();
    restartPanel.hidden = false;
    newBtn.setAttribute("aria-expanded", "true");
    cancelRestart.focus();
  });
  cancelRestart.addEventListener("click", () => closeRestart());
  confirmRestart.addEventListener("click", () => { newGame(); newBtn.focus(); });
  document.addEventListener("click", event => {
    if (!restartPanel.hidden && !restartPanel.contains(event.target) && !newBtn.contains(event.target)) closeRestart(false);
  });
  restartPanel.addEventListener("keydown", event => {
    if (event.key === "Tab") {
      event.preventDefault();
      (document.activeElement === cancelRestart ? confirmRestart : cancelRestart).focus();
    }
  });
  playAgainBtn.addEventListener("click", () => { ensureAudio(); newGame(); });
  continueMilestoneBtn.addEventListener("click", () => {
    hideGameOver();
    boardEl.focus?.();
  });
  startPlayBtn.addEventListener("click", () => {
    ensureAudio();
    menuMode = false;
    ensureGameSession().catch(() => {});
    window.dispatchEvent(new CustomEvent("garden:game-started"));
    stopMenuMusic(true);
    if (audioCtx?.state === "running") startMusic();
    else audioCtx?.resume().then(startMusic).catch(() => {});
    startScreenEl.classList.add("leaving");
    const finish = () => {
      startScreenEl.hidden = true;
      startScreenEl.classList.remove("leaving");
      document.body.classList.remove("start-menu-active");
      boardEl.focus?.();
    };
    if (reduceMotion) finish(); else setTimeout(finish, 480);
  });
  startLeaderboardBtn.addEventListener("click", openLeaderboard);
  leaderboardBtn.addEventListener("click", openLeaderboard);
  leaderboardCloseBtn.addEventListener("click", closeLeaderboard);
  leaderboardModalEl.addEventListener("click", event => { if (event.target === leaderboardModalEl) closeLeaderboard(); });
  scoreFormEl.addEventListener("submit", submitScore);

  // Settings panel
  function syncToggles() {
    musicVolumeEl.value = String(Math.round(musicVolume));
    musicVolumeValueEl.value = `${Math.round(musicVolume)}%`;
    musicVolumeValueEl.textContent = `${Math.round(musicVolume)}%`;
    pianoToggle.setAttribute("aria-checked", String(pianoOn));
    pianoToggle.classList.toggle("off", !pianoOn);
    sfxToggle.setAttribute("aria-checked", String(sfxOn));
    sfxToggle.classList.toggle("off", !sfxOn);
    motionToggle.setAttribute("aria-checked", String(motionOn));
    motionToggle.classList.toggle("off", !motionOn);
    particlesToggle.setAttribute("aria-checked", String(particlesOn));
    particlesToggle.classList.toggle("off", !particlesOn);
    contrastToggle.setAttribute("aria-checked", String(contrastOn));
    contrastToggle.classList.toggle("off", !contrastOn);
  }
  function applyVisualPrefs() {
    document.body.classList.toggle("motion-off", !motionOn);
    document.body.classList.toggle("particles-off", !particlesOn);
    document.body.classList.toggle("high-contrast", contrastOn);
    if (particlesOn) spawnEnvParticles(Math.max(1, currentStage));
    else clearEnvParticles();
    window.dispatchEvent(new CustomEvent("garden:preferences", { detail: {
      motionOn, particlesOn, contrastOn
    }}));
  }
  function setSettingsOpen(open, trigger = settingsBtn) {
    if (open) { closeRestart(false); coolFlow(); queuedDirection = null; }
    const inGame = startScreenEl.hidden;
    settingsPanel.classList.toggle("settings-panel--popover", inGame);
    settingsPanel.style.removeProperty("top");
    settingsPanel.style.removeProperty("left");
    if (open && inGame) {
      const rect = settingsBtn.getBoundingClientRect();
      const panelWidth = Math.min(320, window.innerWidth - 24);
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - panelWidth - 8));
      settingsPanel.style.left = `${left}px`;
      settingsPanel.style.top = `${rect.bottom + 9}px`;
    }
    settingsPanel.hidden = !open;
    settingsBackdrop.hidden = !open || inGame;
    settingsBtn.setAttribute("aria-expanded", String(open));
    startSettingsBtn.setAttribute("aria-expanded", String(open));
    if (open) { syncToggles(); requestAnimationFrame(() => settingsCloseBtn.focus()); }
    else trigger?.focus?.();
  }
  function toggleSettings(e) {
    e.stopPropagation();
    setSettingsOpen(settingsPanel.hidden, e.currentTarget);
  }
  settingsBtn.addEventListener("click", toggleSettings);
  startSettingsBtn.addEventListener("click", toggleSettings);
  settingsCloseBtn.addEventListener("click", () => setSettingsOpen(false, !startScreenEl.hidden ? startSettingsBtn : settingsBtn));
  settingsBackdrop.addEventListener("click", () => setSettingsOpen(false, !startScreenEl.hidden ? startSettingsBtn : settingsBtn));
  document.addEventListener("click", e => {
    if (!settingsPanel.hidden && !settingsPanel.contains(e.target) && e.target !== settingsBtn && e.target !== startSettingsBtn) {
      setSettingsOpen(false, !startScreenEl.hidden ? startSettingsBtn : settingsBtn);
    }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !restartPanel.hidden) { closeRestart(); return; }
    if (e.key === "Escape" && !leaderboardModalEl.hidden) {
      closeLeaderboard();
      return;
    }
    if (e.key === "Escape" && !settingsPanel.hidden) {
      setSettingsOpen(false, !startScreenEl.hidden ? startSettingsBtn : settingsBtn);
    }
  });
  musicVolumeEl.addEventListener("input", () => {
    ensureAudio();
    setMusicVolume(musicVolumeEl.value);
    syncToggles();
  });
  pianoToggle.addEventListener("click", () => { ensureAudio(); setPianoEnabled(!pianoOn); syncToggles(); });
  sfxToggle.addEventListener("click", () => { ensureAudio(); setSfxEnabled(!sfxOn); syncToggles(); });
  motionToggle.addEventListener("click", () => { motionOn = !motionOn; savePref("gardenEvolutionMotion", motionOn); applyVisualPrefs(); syncToggles(); });
  particlesToggle.addEventListener("click", () => { particlesOn = !particlesOn; savePref("gardenEvolutionParticles", particlesOn); applyVisualPrefs(); syncToggles(); });
  contrastToggle.addEventListener("click", () => { contrastOn = !contrastOn; savePref("gardenEvolutionContrast", contrastOn); applyVisualPrefs(); syncToggles(); });
  languageSelect.addEventListener("change", () => applyLanguage(languageSelect.value));

  // Resize handling
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyLayout, 80);
  });

  // Conserve battery/GPU time on modest devices and whenever the page is not visible.
  const lowPowerDevice = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  document.body.classList.toggle("perf-low", Boolean(lowPowerDevice));
  performanceNoteEl.textContent = lowPowerDevice ? "Balanced mode is active for smoother play." : "Full detail mode is active.";
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { coolFlow(); queuedDirection = null; }
    document.body.classList.toggle("page-hidden", document.hidden);
  });

  // First user interaction unlocks audio + starts music
  let audioUnlocked = false;
  async function firstInteraction() {
    if (audioUnlocked) return;
    ensureAudio();
    if (!audioCtx) return;
    try {
      if (audioCtx.state === "suspended") await audioCtx.resume();
      if (audioCtx.state === "running") {
        audioUnlocked = true;
        if (musicOn) {
          if (menuMode) startMenuMusic();
          else startMusic();
        }
        window.removeEventListener("pointerdown", firstInteraction, true);
        window.removeEventListener("touchend", firstInteraction, true);
        window.removeEventListener("keydown", firstInteraction, true);
      }
    } catch (error) {
      // Some mobile browsers reject the first unlock attempt. Keep the
      // listeners active so the next real tap can try again.
    }
  }
  window.addEventListener("pointerdown", firstInteraction, true);
  window.addEventListener("touchend", firstInteraction, true);
  window.addEventListener("keydown", firstInteraction, true);

  // Autoplay is attempted for browsers/sessions that already grant it. On a
  // fresh visit the first pointer/key interaction retries through the handler
  // above, which is required by mobile and desktop autoplay policies.
  if (musicOn && menuMode) startMenuMusic();

  /* ---------- Boot ---------- */
  best = loadBest();
  bestEl.textContent = best;
  let savedLanguage = "en";
  try { savedLanguage = localStorage.getItem("gardenEvolutionLanguage") || "en"; } catch (e) {}
  applyLanguage(savedLanguage);
  applyVisualPrefs();
  syncToggles();
  buildGrid();
  setEnvironmentStage(1, true);
  newGame();
  // Local art direction helper: http://localhost:4173/?stage=2
  if (["localhost", "127.0.0.1"].includes(location.hostname)) {
    const previewParams = new URLSearchParams(location.search);
    const previewStage = Number(previewParams.get("stage"));
    if (previewStage >= 1 && previewStage <= 5) setEnvironmentStage(previewStage, true);
    // Local-only art review: show the complete current tile progression
    // without altering normal starts, saved data, scoring or production play.
    if (previewParams.get("tiles") === "preview") {
      grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
      tiles = {};nextId = 1;tilesEl.innerHTML = "";
      const previewValues=[2,4,8,16,32,64,128,256,512,1024,2048,2];
      previewValues.forEach((value,index)=>createTile(Math.floor(index/SIZE),index%SIZE,value,false));
    }
    const previewEnding = previewParams.get("ending");
    if (previewEnding === "milestone" || previewEnding === "victory") {
      const finalValue = previewEnding === "victory" ? 8192 : 2048;
      menuMode = false;
      startScreenEl.hidden = true;
      document.body.classList.remove("start-menu-active");
      score = previewEnding === "victory" ? 32768 : 8192;
      maxValueReached = finalValue;
      goldenAchieved = true;
      victoryAchieved = previewEnding === "victory";
      updateScore();
      setEnvironmentStage(5, true);
      previewEnding === "victory" ? showGameOver("victory") : showMilestone();
    }
  }
})();
