// The settings panel: music volume, sound and visual toggles, language. On the
// start menu it is a centred dialog with a backdrop; in the game it is a
// popover under the gear button, kept on screen even on a short phone held
// sideways. It shows and changes what audio.js and preferences.js know.

// elements: the panel and everything in it (see script.js for the ids).
// hooks.onOpen(): the game cools its combo and closes the restart prompt.
// hooks.onVisualChange(): motion, particles or contrast changed.
// hooks.startMenuShowing(): whether the start menu is still up.
export function createSettingsPanel({ elements, audio, prefs, applyLanguage, hooks, syncInert }) {
  const {
    button: settingsBtn, startButton: startSettingsBtn, panel: settingsPanel, backdrop: settingsBackdrop,
    closeButton: settingsCloseBtn, musicVolume: musicVolumeEl, musicVolumeValue: musicVolumeValueEl,
    piano: pianoToggle, sfx: sfxToggle, motion: motionToggle, particles: particlesToggle,
    contrast: contrastToggle, reveal: revealToggle, haptics: hapticsToggle, language: languageSelect
  } = elements;

  function setToggle(toggle, on) {
    toggle.setAttribute("aria-checked", String(on));
    toggle.classList.toggle("off", !on);
  }

  function syncToggles() {
    musicVolumeEl.value = String(Math.round(audio.musicVolume));
    musicVolumeValueEl.value = `${Math.round(audio.musicVolume)}%`;
    musicVolumeValueEl.textContent = `${Math.round(audio.musicVolume)}%`;
    setToggle(pianoToggle, audio.pianoOn);
    setToggle(sfxToggle, audio.sfxOn);
    setToggle(motionToggle, prefs.motionOn);
    setToggle(particlesToggle, prefs.particlesOn);
    setToggle(contrastToggle, prefs.contrastOn);
    setToggle(revealToggle, prefs.revealOn);
    if (hapticsToggle) setToggle(hapticsToggle, prefs.hapticsOn);
  }

  // The button that opened the panel gets focus back, wherever the player is.
  const closeTrigger = () => (hooks.startMenuShowing() ? startSettingsBtn : settingsBtn);

  function setSettingsOpen(open, trigger = settingsBtn) {
    if (open) hooks.onOpen();
    const inGame = !hooks.startMenuShowing();
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
    syncInert();
    if (open && inGame) {
      // On a short screen (a phone held sideways) the panel would hang below the
      // bottom edge: keep it on screen and let it scroll if it is still taller.
      settingsPanel.style.maxHeight = `${window.innerHeight - 16}px`;
      const panelHeight = settingsPanel.getBoundingClientRect().height;
      const top = Math.max(8, Math.min(parseFloat(settingsPanel.style.top) || 8, window.innerHeight - panelHeight - 8));
      settingsPanel.style.top = `${top}px`;
    } else {
      settingsPanel.style.removeProperty("max-height");
    }
    settingsBackdrop.hidden = !open || inGame;
    settingsBtn.setAttribute("aria-expanded", String(open));
    startSettingsBtn.setAttribute("aria-expanded", String(open));
    if (open) { syncToggles(); requestAnimationFrame(() => settingsCloseBtn.focus()); }
    else trigger?.focus?.();
  }

  const close = () => setSettingsOpen(false, closeTrigger());

  function toggleSettings(event) {
    event.stopPropagation();
    setSettingsOpen(settingsPanel.hidden, event.currentTarget);
  }
  settingsBtn.addEventListener("click", toggleSettings);
  startSettingsBtn.addEventListener("click", toggleSettings);
  settingsCloseBtn.addEventListener("click", close);
  settingsBackdrop.addEventListener("click", close);
  document.addEventListener("click", event => {
    if (!settingsPanel.hidden && !settingsPanel.contains(event.target) && event.target !== settingsBtn && event.target !== startSettingsBtn) {
      close();
    }
  });

  musicVolumeEl.addEventListener("input", () => {
    audio.ensure();
    audio.setMusicVolume(musicVolumeEl.value);
    syncToggles();
  });
  pianoToggle.addEventListener("click", () => { audio.ensure(); audio.setPianoEnabled(!audio.pianoOn); syncToggles(); });
  sfxToggle.addEventListener("click", () => { audio.ensure(); audio.setSfxEnabled(!audio.sfxOn); syncToggles(); });
  for (const [name, toggle] of [["motion", motionToggle], ["particles", particlesToggle], ["contrast", contrastToggle]]) {
    toggle.addEventListener("click", () => { prefs.toggle(name); hooks.onVisualChange(); syncToggles(); });
  }
  revealToggle.addEventListener("click", () => { prefs.toggle("reveal"); syncToggles(); });
  hapticsToggle?.addEventListener("click", () => { prefs.toggle("haptics"); syncToggles(); });
  languageSelect.addEventListener("change", () => applyLanguage(languageSelect.value));

  return {
    sync: syncToggles,
    close,
    isOpen: () => !settingsPanel.hidden,
    element: settingsPanel
  };
}
