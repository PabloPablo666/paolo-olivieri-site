// src/lib/commandPalette.ts
import type { QueryDef } from "./queryPack";

export function createPalette(opts: {
  queries: QueryDef[];
  onPick: (q: QueryDef, runImmediately: boolean) => void;
  /**
   * If true, clicking an item will load + run immediately.
   * Keyboard behavior stays the same: Enter = load, Shift+Enter = load+run.
   */
  runOnClick?: boolean;
}) {
  let isOpen = false;
  let idx = 0;
  let filtered = opts.queries;

  const root = document.createElement("div");
  root.style.cssText = `
position:fixed; inset:0; display:none; z-index:9999;
background:rgba(0,0,0,.55); padding:36px 14px;
`;

  const helpText = opts.runOnClick
    ? "Click = load+run · Enter = load · Shift+Enter = load+run · Esc = close"
    : "Enter = load · Shift+Enter = load+run · Esc = close";

  root.innerHTML = `
<div style="max-width:760px; margin:0 auto; background:#0b0b0b; border:1px solid #222; border-radius:16px; overflow:hidden;">
  <div style="padding:12px; border-bottom:1px solid #222;">
    <input id="qp-input" placeholder="Search queries…" style="width:100%; padding:10px 12px; background:#000; color:#fff; border:1px solid #222; border-radius:12px; outline:none;" />
    <div style="margin-top:6px; font-size:12px; color:#888;">${helpText}</div>
  </div>
  <div id="qp-list" style="max-height:440px; overflow:auto;"></div>
</div>
`;
  document.body.appendChild(root);

  const input = root.querySelector<HTMLInputElement>("#qp-input")!;
  const list = root.querySelector<HTMLDivElement>("#qp-list")!;

  function render() {
    list.innerHTML = filtered
      .map((q, i) => {
        const active = i === idx ? "background:#121212;" : "";
        const hk = q.hotkey ? `<span style="color:#666; font-size:12px;">Alt+${q.hotkey}</span>` : "";
        return `
<div data-i="${i}" style="padding:10px 12px; border-bottom:1px solid #151515; cursor:pointer; ${active}">
  <div style="display:flex; justify-content:space-between; gap:10px;">
    <div style="color:#fff;">${q.title}</div>
    ${hk}
  </div>
  <div style="color:#888; font-size:12px; margin-top:2px;">${q.group} · ${q.description}</div>
</div>`;
      })
      .join("");
  }

  function applyFilter() {
    const s = (input.value || "").trim().toLowerCase();
    filtered = !s
      ? opts.queries
      : opts.queries.filter((q) =>
          (q.title + " " + q.description + " " + q.tags.join(" ") + " " + q.group)
            .toLowerCase()
            .includes(s)
        );
    idx = 0;
    render();
  }

  function show() {
    isOpen = true;
    root.style.display = "block";
    input.value = "";
    applyFilter();
    setTimeout(() => input.focus(), 0);
  }

  function hide() {
    isOpen = false;
    root.style.display = "none";
  }

  root.addEventListener("mousedown", (ev) => {
    if (ev.target === root) hide();
  });

  list.addEventListener("click", (ev) => {
    const row = (ev.target as HTMLElement).closest("[data-i]") as HTMLElement | null;
    if (!row) return;

    idx = Number(row.dataset.i);
    const runNow = !!opts.runOnClick;
    opts.onPick(filtered[idx], runNow);
    hide();
  });

  input.addEventListener("input", applyFilter);

  document.addEventListener("keydown", (e) => {
    if (!isOpen) return;

    if (e.key === "Escape") {
      e.preventDefault();
      hide();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      idx = Math.min(idx + 1, filtered.length - 1);
      render();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      idx = Math.max(idx - 1, 0);
      render();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const runNow = e.shiftKey;
      opts.onPick(filtered[idx], runNow);
      hide();
      return;
    }
  });

  return { show, hide };
}
