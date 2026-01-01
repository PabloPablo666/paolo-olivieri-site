(() => {
  const KEY = "matrix_enabled";

  const canvas = document.getElementById("matrix");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true });

  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const chars = "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789#$%&*+-=<>?";
  const charArr = chars.split("");

  const settings = {
    fontSize: 16,
    speed: 1.0,
    fadeAlpha: 0.06,
    green: "rgba(124,247,194,0.95)"
  };

  let width = 0, height = 0, columns = 0, drops = [];
  let rafId = null;
  let running = false;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.floor(rect.width);
    height = Math.floor(rect.height);

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    columns = Math.max(1, Math.floor(width / settings.fontSize));
    drops = Array.from({ length: columns }, () => Math.random() * (height / settings.fontSize));
  }

  function clear() {
    ctx.clearRect(0, 0, width, height);
  }

  function draw() {
    if (!running) return;

    // fade layer (trails)
    ctx.fillStyle = `rgba(11,11,12,${settings.fadeAlpha})`;
    ctx.fillRect(0, 0, width, height);

    ctx.font = `${settings.fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;

    for (let i = 0; i < drops.length; i++) {
      const text = charArr[(Math.random() * charArr.length) | 0];
      const x = i * settings.fontSize;
      const y = drops[i] * settings.fontSize;

      ctx.fillStyle = settings.green;
      ctx.fillText(text, x, y);

      if (y > height && Math.random() > 0.975) drops[i] = 0;
      drops[i] += settings.speed;
    }

    rafId = requestAnimationFrame(draw);
  }

  function start() {
    if (running) return;
    running = true;
    canvas.style.display = "block";
    resize();
    rafId = requestAnimationFrame(draw);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    clear();
    canvas.style.display = "none";
  }

  function setEnabled(enabled) {
    try {
      localStorage.setItem(KEY, enabled ? "1" : "0");
    } catch {}
    document.documentElement.dataset.matrix = enabled ? "on" : "off";
    if (enabled) start();
    else stop();
  }

  function getEnabledDefault() {
    // default ON, ma se la macchina soffre puoi cambiare a default OFF
    try {
      const v = localStorage.getItem(KEY);
      if (v === "1") return true;
      if (v === "0") return false;
    } catch {}
    return true;
  }

  // resize handler solo quando attivo
  function onResize() {
    if (running) resize();
  }
  window.addEventListener("resize", onResize, { passive: true });

  // UI hook
  window.__setMatrixEnabled = setEnabled;
  window.__getMatrixEnabled = () => document.documentElement.dataset.matrix === "on";

  // init
  setEnabled(getEnabledDefault());
})();
