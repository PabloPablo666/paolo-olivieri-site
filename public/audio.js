(() => {
  const KEY = "audio_enabled";
  const SOUNDCLOUD_URL = "https://soundcloud.com/paolo-olivieri-888893279";
  const SC_VOLUME = 25;
  const GLITCH_COOLDOWN = 120;

  let audioEnabled = false;
  let audioCtx = null;
  let lastGlitchAt = 0;

  let scIframe = null;
  let scWidget = null;
  let scReady = false;
  let scApiPromise = null;

  const $ = (sel) => document.querySelector(sel);

  function lsGet(k){ try { return localStorage.getItem(k); } catch { return null; } }
  function lsSet(k,v){ try { localStorage.setItem(k,v); } catch {} }

  function setHtmlAudio(enabled){
    document.documentElement.dataset.audio = enabled ? "on" : "off";
  }

  function ensureAudioContext(){
    if (audioCtx) return audioCtx;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  async function resumeCtx(){
    const ctx = ensureAudioContext();
    if (ctx.state === "suspended") {
      try { await ctx.resume(); } catch {}
    }
  }

  function playGlitchSound(){
  if (!audioEnabled) return;

  const now = performance.now();
  if (now - lastGlitchAt < GLITCH_COOLDOWN) return;
  lastGlitchAt = now;

  const ctx = ensureAudioContext();
  const t0 = ctx.currentTime;

  // ===== helpers =====
  const mkDistortionCurve = (amount = 18) => {
    const n = 44100;
    const curve = new Float32Array(n);
    const k = typeof amount === "number" ? amount : 18;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + k) * x * 20 * Math.PI / 180) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  };

  const dur = 0.48; // ~480ms long
  const N = Math.floor(ctx.sampleRate * dur);

  // ===== layered noise bed (darker, longer) =====
  const buffer = ctx.createBuffer(1, N, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  // darker "electric" noise: slightly correlated, not harsh white noise
  let last = 0;
  for (let i = 0; i < N; i++) {
    const white = (Math.random() * 2 - 1);
    // simple low-pass correlation
    last = last * 0.85 + white * 0.15;

    // slow-ish amplitude wobble inside the sound
    const wob = 0.65 + 0.35 * Math.sin((i / ctx.sampleRate) * (2 * Math.PI * 7.5));

    // envelope: fast in, slow out
    const x = i / N;
    const env = x < 0.08 ? (x / 0.08) : Math.pow(1 - x, 1.6);

    data[i] = last * wob * env * 0.9;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  // bandpass sweep but LOWER and WIDER (less sharp)
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 2.2;
  bp.frequency.setValueAtTime(420, t0);
  bp.frequency.exponentialRampToValueAtTime(1100, t0 + 0.14);
  bp.frequency.exponentialRampToValueAtTime(520,  t0 + dur);

  // soften top end
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(2400, t0); // keeps it non-tagliente
  lp.Q.value = 0.7;

  // gentle crunch
  const ws = ctx.createWaveShaper();
  ws.curve = mkDistortionCurve(22);
  ws.oversample = "2x";

  // master envelope
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.04);      // slower attack
  g.gain.setValueAtTime(0.14, t0 + 0.20);                    // hold a bit
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);     // tail

  noise.connect(bp);
  bp.connect(ws);
  ws.connect(lp);
  lp.connect(g);
  g.connect(ctx.destination);

  noise.start(t0);
  noise.stop(t0 + dur);

  // ===== warm "electric hum" layer (fills body) =====
  const humDur = dur;

  const osc = ctx.createOscillator();
  osc.type = "sine";
  // start higher then settle, like a power surge stabilizing
  osc.frequency.setValueAtTime(180, t0);
  osc.frequency.exponentialRampToValueAtTime(78, t0 + 0.22);

  const og = ctx.createGain();
  og.gain.setValueAtTime(0.0001, t0);
  og.gain.exponentialRampToValueAtTime(0.06, t0 + 0.06);
  og.gain.setValueAtTime(0.05, t0 + 0.25);
  og.gain.exponentialRampToValueAtTime(0.0001, t0 + humDur);

  const olp = ctx.createBiquadFilter();
  olp.type = "lowpass";
  olp.frequency.setValueAtTime(900, t0);

  osc.connect(olp);
  olp.connect(og);
  og.connect(ctx.destination);

  osc.start(t0);
  osc.stop(t0 + humDur);

  // ===== subtle stereo-ish movement (fake) via tiny tremolo =====
  // (kept minimal to avoid seasickness)
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.setValueAtTime(6.2, t0);

  const lfoGain = ctx.createGain();
  lfoGain.gain.setValueAtTime(0.04, t0); // depth

  lfo.connect(lfoGain);
  lfoGain.connect(g.gain);

  lfo.start(t0);
  lfo.stop(t0 + dur);
}

  function loadSoundCloudApi(){
    if (scApiPromise) return scApiPromise;
    scApiPromise = new Promise((resolve, reject) => {
      if (window.SC && window.SC.Widget) return resolve();
      const s = document.createElement("script");
      s.src = "https://w.soundcloud.com/player/api.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("SoundCloud API load failed"));
      document.head.appendChild(s);
    });
    return scApiPromise;
  }

  function createIframe(){
    if (scIframe) return scIframe;

    scIframe = document.createElement("iframe");
    scIframe.id = "sc-player";
    scIframe.allow = "autoplay";
    scIframe.title = "SoundCloud Player";

    scIframe.src = "https://w.soundcloud.com/player/?" + new URLSearchParams({
      url: SOUNDCLOUD_URL,
      auto_play: "false",
      hide_related: "true",
      show_comments: "false",
      show_user: "false",
      show_reposts: "false",
      visual: "false"
    }).toString();

    scIframe.style.position = "fixed";
    scIframe.style.left = "-9999px";
    scIframe.style.top = "0";
    scIframe.style.width = "1px";
    scIframe.style.height = "1px";
    scIframe.style.opacity = "0";
    scIframe.style.pointerEvents = "none";

    document.body.appendChild(scIframe);
    return scIframe;
  }

  async function ensureWidget(){
    if (scWidget && scReady) return scWidget;

    await loadSoundCloudApi();
    createIframe();

    scWidget = window.SC.Widget(scIframe);

    await new Promise((resolve) => {
      scWidget.bind(window.SC.Widget.Events.READY, () => {
        scReady = true;
        resolve();
      });
    });

    try { scWidget.setVolume(SC_VOLUME); } catch {}
    return scWidget;
  }

  async function playRandomFromSoundCloud(){
    try {
      const w = await ensureWidget();

      w.getSounds((sounds) => {
        if (Array.isArray(sounds) && sounds.length > 0) {
          const pick = sounds[Math.floor(Math.random() * sounds.length)];
          w.load(pick.permalink_url, { auto_play: true, visual: false, show_user: false });
          w.setVolume(SC_VOLUME);
        } else {
          // fallback
          w.play();
          w.setVolume(SC_VOLUME);
        }
      });
    } catch (e) {
      console.warn("[audio] SoundCloud not available:", e);
    }
  }

  function pauseSoundCloud(){
    try { scWidget?.pause(); } catch {}
  }

  function updateSoundBtn(){
    const btn = $("#soundToggle");
    if (!btn) return;
    btn.textContent = audioEnabled ? "SOUND: ON" : "SOUND: OFF";
    btn.setAttribute("aria-pressed", audioEnabled ? "true" : "false");
  }

  function updateMatrixBtn(){
    const btn = $("#matrixToggle");
    if (!btn) return;
    const on = document.documentElement.dataset.matrix === "on";
    btn.textContent = on ? "MATRIX: ON" : "MATRIX: OFF";
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function setAudioEnabled(enabled){
    audioEnabled = !!enabled;
    lsSet(KEY, audioEnabled ? "1" : "0");
    setHtmlAudio(audioEnabled);
    updateSoundBtn();

    if (audioEnabled) {
      resumeCtx().finally(() => playRandomFromSoundCloud());
    } else {
      pauseSoundCloud();
    }
  }

  function bindButtons(){
    const soundBtn = $("#soundToggle");
    const matrixBtn = $("#matrixToggle");

    if (soundBtn) {
      soundBtn.addEventListener("click", () => setAudioEnabled(!audioEnabled));
    }

    if (matrixBtn) {
      matrixBtn.addEventListener("click", () => {
        const on = document.documentElement.dataset.matrix === "on";
        if (typeof window.__setMatrixEnabled === "function") {
          window.__setMatrixEnabled(!on);
        } else {
          document.documentElement.dataset.matrix = on ? "off" : "on";
        }
        updateMatrixBtn();
      });
    }
  }

  function bindHoverGlitch(){
    document.querySelectorAll(".hacker-title, .site-name").forEach((el) => {
      el.addEventListener("pointerenter", () => playGlitchSound(), { passive: true });
    });
  }

  function init(){
    // audio default OFF
    const saved = lsGet(KEY);
    audioEnabled = saved === "1";
    setHtmlAudio(audioEnabled);

    bindButtons();
    bindHoverGlitch();

    updateSoundBtn();
    updateMatrixBtn();
  }

  // robust init (no race)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
