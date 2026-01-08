// public/audio.js
(() => {
  const KEY = "audio_enabled";

  // Put the file here: /public/sfx/glitch.mp3
  const GLITCH_URL = "/sfx/glitch.mp3";

  // Tweaks
  const GLITCH_GAIN = 0.4;       // 0..1-ish (final gain applied to the sample)
  const GLITCH_COOLDOWN_MS = 250;

  let audioEnabled = false;
  let audioCtx = null;

  let glitchBuf = null;          // AudioBuffer
  let glitchLoading = null;      // Promise
  let lastGlitchAt = 0;
  let lastSource = null;

  const $ = (sel) => document.querySelector(sel);

  function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

  function setHtmlAudio(enabled) {
    document.documentElement.dataset.audio = enabled ? "on" : "off";
  }

  function ensureAudioContext() {
    if (audioCtx) return audioCtx;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  async function resumeCtx() {
    const ctx = ensureAudioContext();
    if (ctx.state === "suspended") {
      try { await ctx.resume(); } catch {}
    }
  }

  async function loadGlitchBuffer() {
    if (glitchBuf) return glitchBuf;
    if (glitchLoading) return glitchLoading;

    glitchLoading = (async () => {
      const ctx = ensureAudioContext();
      const res = await fetch(GLITCH_URL, { cache: "force-cache" });
      if (!res.ok) throw new Error(`Failed to fetch ${GLITCH_URL} (${res.status})`);
      const arr = await res.arrayBuffer();
      glitchBuf = await ctx.decodeAudioData(arr.slice(0));
      return glitchBuf;
    })();

    return glitchLoading;
  }
  async function playGlitchSample() {
 if (!audioEnabled) return;

 const now = performance.now();
 if (now - lastGlitchAt < GLITCH_COOLDOWN_MS) return;
 lastGlitchAt = now;

 await resumeCtx();

 let buf;
 try {
   buf = await loadGlitchBuffer();
 } catch (e) {
   console.warn("[audio] glitch sample load failed:", e);
   return;
 }

 const ctx = ensureAudioContext();
 const t0 = ctx.currentTime;

 // Stop previous if still playing (keeps it tight)
 try { lastSource?.stop(); } catch {}

 const src = ctx.createBufferSource();
 src.buffer = buf;

 const g = ctx.createGain();

 // --- timing ---
 const MAX_LEN  = 0.68;    // hard limit: 800ms total
 const FADE_IN  = 0.008;  // 8ms
 const FADE_OUT = 0.115;  // 15ms

 // Play length can't exceed the buffer
 const playLen = Math.min(MAX_LEN, buf.duration);

 // Make sure fades fit inside playLen
 const fadeIn = Math.min(FADE_IN, Math.max(0, playLen * 0.25));
 const fadeOut = Math.min(FADE_OUT, Math.max(0, playLen - fadeIn));

 const tEnd = t0 + playLen;
 const tFadeOutStart = Math.max(t0 + fadeIn, tEnd - fadeOut);

 // envelope
 g.gain.setValueAtTime(0.0001, t0);
 g.gain.linearRampToValueAtTime(GLITCH_GAIN, t0 + fadeIn);

 g.gain.setValueAtTime(GLITCH_GAIN, tFadeOutStart);
 g.gain.linearRampToValueAtTime(0.0001, tEnd);

 src.connect(g);
 g.connect(ctx.destination);

 // schedule exact stop at 0.8s (or shorter if file is shorter)
 src.start(t0);
 src.stop(tEnd);

 lastSource = src;

 src.onended = () => {
   if (lastSource === src) lastSource = null;
 };
}


  function updateSoundBtn() {
    const btn = $("#soundToggle");
    if (!btn) return;
    btn.textContent = audioEnabled ? "SOUND: ON" : "SOUND: OFF";
    btn.setAttribute("aria-pressed", audioEnabled ? "true" : "false");
  }

  function updateMatrixBtn() {
    const btn = $("#matrixToggle");
    if (!btn) return;
    const on = document.documentElement.dataset.matrix === "on";
    btn.textContent = on ? "MATRIX: ON" : "MATRIX: OFF";
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function setAudioEnabled(enabled) {
    audioEnabled = !!enabled;
    lsSet(KEY, audioEnabled ? "1" : "0");
    setHtmlAudio(audioEnabled);
    updateSoundBtn();

    // Preload the sample when user enables audio (optional but feels snappy)
    if (audioEnabled) {
      resumeCtx().finally(() => {
        loadGlitchBuffer().catch(() => {});
      });
    } else {
      // stop any tail
      try { lastSource?.stop(); } catch {}
      lastSource = null;
    }
  }

  function bindButtons() {
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

  function bindHoverGlitch() {
    // Only HOME hacker title should trigger glitch sound.
    // Needs: <body data-page="home"> on home page.
    const isHome = document.body?.getAttribute("data-page") === "home";
    if (!isHome) return;

    const el = document.querySelector(".hacker-title");
    if (!el) return;

    el.addEventListener("pointerenter", () => {
      playGlitchSample().catch(() => {});
    }, { passive: true });
  }

  function init() {
    const saved = lsGet(KEY);
    audioEnabled = saved === "1";
    setHtmlAudio(audioEnabled);

    bindButtons();
    bindHoverGlitch();

    updateSoundBtn();
    updateMatrixBtn();

    // If audio already enabled, preload the sample quietly
    if (audioEnabled) {
      resumeCtx().finally(() => {
        loadGlitchBuffer().catch(() => {});
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
