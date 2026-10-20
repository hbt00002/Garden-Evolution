// All the game's sound, made on the fly with the Web Audio API (no audio files
// except the menu track): merge sounds, an ambient bed that changes with each
// world, and the combo piano. createAudio() owns the audio context, the
// music/sound-effect settings and the unlock-on-first-touch dance browsers
// require. The game tells it which world is showing and whether the start menu
// is up, and calls the play* functions; it never touches Web Audio itself.
import { loadPref, savePref } from "./storage.js";

export function createAudio({ getStage, isMenu }) {
  // Music volume intentionally starts fresh on every page load.
  let musicVolume = 100;
  let musicOn = true;
  let pianoOn = loadPref("gardenEvolutionComboPiano", true);
  let sfxOn = loadPref("gardenEvolutionSfx", true);

  /* ============================================================
     AUDIO — procedural Web Audio
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
    // Warm low body — lower for higher values
    const bodyFreq = 150 - Math.min(60, log * 5);
    bodySound(bodyFreq, 0.16, 0.32, t0);
    // Woody transient — slightly higher pitch for small merges
    woodySound(260 + log * 18, 0.09, 0.14, t0);
    // Airy poof
    poofSound(0.12, 0.06, t0);

    if (v >= 2048) {
      // Golden: richer, elegant — deep body + warm shimmer + tonal bloom
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
      // Low: small soft pop — just body + poof + faint accent
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
     AMBIENT MUSIC — slow procedural pad + occasional pentatonic notes
     The same lightweight system now runs through every gameplay stage.
     Combo energy is deliberately kept out of the bed; its only musical
     response is the separate rising piano accent below.
     ============================================================ */
  let musicTimer = null;
  let musicRunning = false;
  let menuMusicRequest = 0;
  const menuMusic = new Audio("/assets/audio/bit-forest-intro.mp3");
  menuMusic.loop = true;
  menuMusic.preload = "metadata";
  menuMusic.autoplay = true;
  menuMusic.playsInline = true;
  menuMusic.volume = 0.38 * (musicVolume / 100);

  function stopProceduralMusic() {
    musicRunning = false;
    if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
  }

  function startMenuMusic() {
    if (!isMenu() || !musicOn) return;
    stopMusic();
    const request = ++menuMusicRequest;
    // Browsers may reject autoplay until the first real user gesture. The
    // global audio-unlock handler retries from that gesture without errors.
    menuMusic.play().then(() => {
      // Mobile browsers can settle play() after the Play button has already
      // switched to gameplay. Do not let that delayed request revive the
      // menu track over the procedural in-game music.
      if (request !== menuMusicRequest || !isMenu() || !musicOn) menuMusic.pause();
    }).catch(() => {});
  }

  function stopMenuMusic(reset = false) {
    menuMusicRequest += 1;
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
    const scale = STAGE_SCALES[Math.max(0, getStage() - 1)];
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
    const stage = Math.max(1, getStage() || 1);
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
    if (isMenu() || !audioCtx || audioCtx.state !== "running" || !musicOn) return;
    if (musicRunning) return;
    musicRunning = true;
    musicStep();
    const interval = () => (60 / MUSIC_PROFILES[Math.max(0, getStage() - 1)].bpm) * 4000;
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
    } else if (isMenu()) {
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

  // The player's first tap, key press or touch is the first moment a browser
  // allows sound: unlock the audio context then, and start the music.
  let audioUnlocked = false;
  async function firstInteraction(event) {
    if (audioUnlocked) return;
    const startsGame = event?.target instanceof Element && Boolean(event.target.closest("#startPlayBtn"));
    ensureAudio();
    if (!audioCtx) return;
    try {
      if (audioCtx.state === "suspended") await audioCtx.resume();
      if (audioCtx.state === "running") {
        audioUnlocked = true;
        if (musicOn) {
          // The Play tap is also the first permitted audio gesture on mobile.
          // Let its click handler start gameplay audio directly instead of
          // briefly scheduling the menu track during the same interaction.
          if (isMenu() && !startsGame) startMenuMusic();
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
  startMenuMusic();

  // The Play button: the menu track gives way to the in-game music.
  function startGameplayMusic() {
    stopMenuMusic(true);
    if (audioCtx?.state === "running") startMusic();
    else audioCtx?.resume().then(startMusic).catch(() => {});
  }

  return {
    ensure: ensureAudio,
    startMusic,
    stopMusic,
    startGameplayMusic,
    startMenuMusic,
    setMusicVolume,
    setSfxEnabled,
    setPianoEnabled,
    playMerge,
    playGolden,
    playGameOver,
    playComboPiano,
    playStageRise,
    get musicVolume() { return musicVolume; },
    get musicOn() { return musicOn; },
    get pianoOn() { return pianoOn; },
    get sfxOn() { return sfxOn; }
  };
}
