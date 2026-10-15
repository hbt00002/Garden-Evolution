// What a visitor sees when part of the game's code cannot be loaded. The usual
// cause is an ad blocker or privacy extension that swallows a file, so the
// message says so and tells them what to do. It lives in its own tiny module
// because the game's own bundle (with all its translations) is exactly what
// failed to load.

export const LOAD_ERROR_COPY = {
  en: ["The game could not load", "Something on this device blocked part of the game, often an ad blocker or privacy extension. Turn it off for this site, then reload.", "Reload"],
  tr: ["Oyun yüklenemedi", "Bu cihazdaki bir şey oyunun bir bölümünü engelledi; çoğunlukla bir reklam engelleyici ya da gizlilik eklentisi. Bu site için kapatıp sayfayı yenileyin.", "Yenile"],
  zh: ["游戏无法加载", "此设备上的某些程序拦截了游戏的一部分，通常是广告拦截器或隐私扩展。请为本站关闭它，然后重新加载。", "重新加载"],
  ja: ["ゲームを読み込めませんでした", "この端末の何かがゲームの一部をブロックしました。広告ブロッカーやプライバシー系の拡張機能であることが多いです。このサイトで無効にしてから再読み込みしてください。", "再読み込み"],
  ko: ["게임을 불러오지 못했습니다", "이 기기의 무언가가 게임 일부를 차단했습니다. 광고 차단기나 개인정보 보호 확장 프로그램인 경우가 많습니다. 이 사이트에서 끈 뒤 새로고침하세요.", "새로고침"],
  es: ["No se pudo cargar el juego", "Algo en este dispositivo bloqueó una parte del juego, a menudo un bloqueador de anuncios o una extensión de privacidad. Desactívalo para este sitio y recarga.", "Recargar"],
  pt: ["Não foi possível carregar o jogo", "Algo neste dispositivo bloqueou parte do jogo, geralmente um bloqueador de anúncios ou uma extensão de privacidade. Desative-o para este site e recarregue.", "Recarregar"],
  fr: ["Le jeu n'a pas pu se charger", "Un élément de cet appareil a bloqué une partie du jeu, souvent un bloqueur de publicités ou une extension de confidentialité. Désactivez-le pour ce site, puis rechargez.", "Recharger"],
  de: ["Das Spiel konnte nicht geladen werden", "Etwas auf diesem Gerät hat einen Teil des Spiels blockiert, oft ein Werbeblocker oder eine Datenschutz-Erweiterung. Schalte ihn für diese Seite aus und lade neu.", "Neu laden"],
  ru: ["Не удалось загрузить игру", "Что-то на этом устройстве заблокировало часть игры — часто это блокировщик рекламы или расширение для приватности. Отключите его для этого сайта и перезагрузите страницу.", "Обновить"]
};

// The language the visitor chose in the game, else the browser's, else English.
export function pickLanguage(stored, browserLanguage) {
  for (const candidate of [stored, String(browserLanguage || "").slice(0, 2).toLowerCase()]) {
    if (candidate && Object.prototype.hasOwnProperty.call(LOAD_ERROR_COPY, candidate)) return candidate;
  }
  return "en";
}

// [title, explanation, button label]
export function loadErrorCopy(stored, browserLanguage) {
  return LOAD_ERROR_COPY[pickLanguage(stored, browserLanguage)];
}
