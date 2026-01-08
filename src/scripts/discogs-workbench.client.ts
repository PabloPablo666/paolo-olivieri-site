// src/scripts/discogs-workbench.client.ts
import { getDuckDB } from "../lib/duckdb";
import { loadWebDemoPack, jsonSafe } from "../lib/webDemoPack";
import { QUERY_PACK, type QueryDef } from "../lib/queryPack";
import { createPalette } from "../lib/commandPalette";

type Mode = "explore" | "showcase";
const mode = (document.body.getAttribute("data-discogs-mode") as Mode) || "explore";

const statusEl = document.getElementById("status") as HTMLElement | null;
const outEl = document.getElementById("out") as HTMLPreElement | null;
const sqlEl = document.getElementById("sql") as HTMLTextAreaElement | null;

const btnLoad = document.getElementById("btnLoad") as HTMLButtonElement | null;
const btnRun = document.getElementById("btnRun") as HTMLButtonElement | null;

// Explore-only UI (optional in showcase)
const packEl = document.getElementById("queryPack") as HTMLDivElement | null;
const packSearchEl = document.getElementById("querySearch") as HTMLInputElement | null;

// Showcase-only UI (optional in explore)
const featuredEl = document.getElementById("featuredQueries") as HTMLDivElement | null;

if (!statusEl || !outEl || !sqlEl || !btnLoad || !btnRun) {
  throw new Error("Workbench DOM not found (missing required elements).");
}

if (mode === "explore" && (!packEl || !packSearchEl)) {
  throw new Error("Explore DOM not found (missing queryPack/querySearch).");
}

/**
 * Explore: all queries
 * Showcase: only featured + Showcase group
 */
const ACTIVE_QUERIES: QueryDef[] =
  mode === "showcase"
    ? QUERY_PACK.filter((q) => q.featured || q.group === "Showcase")
    : QUERY_PACK;

let db: Awaited<ReturnType<typeof getDuckDB>>["db"] | null = null;
let conn: Awaited<ReturnType<typeof getDuckDB>>["conn"] | null = null;
let loaded = false;

function setStatus(msg: string) {
  statusEl.textContent = msg;
}
function log(msg: string) {
  outEl.textContent = msg;
}

async function ensureDB() {
  if (db && conn) return { db, conn };

  setStatus("Booting DuckDB WASM…");
  log("Booting DuckDB WASM…");

  const timeoutMs = 15000;
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`DuckDB init timed out after ${timeoutMs}ms`)), timeoutMs)
  );

  try {
    const h = await Promise.race([getDuckDB(), timeout]);
    db = h.db;
    conn = h.conn;
    setStatus("DuckDB ready.");
    // non sovrascrivere l'output se siamo in showcase e l'utente non ha chiesto nulla
    if (mode === "explore") log("DuckDB ready.");
    return h;
  } catch (e: any) {
    const msg = e?.stack ?? e?.message ?? String(e);
    setStatus("DuckDB boot failed.");
    log(
      "ERROR (DuckDB init):\n" +
        msg +
        "\n\nDevTools → Network: check duckdb*.wasm / worker loads (404/blocked)."
    );
    throw e;
  }
}

async function loadPack() {
  const h = await ensureDB();

  setStatus("Loading demo pack…");
  log("Loading demo pack…");

  const timeoutMs = 20000;
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Pack load timed out after ${timeoutMs}ms`)), timeoutMs)
  );

  try {
    const manifest = await Promise.race([loadWebDemoPack(h.db, h.conn), timeout]);
    loaded = true;

    const scope = (manifest as any)?.pack_name ? ` (${(manifest as any).pack_name})` : "";
    setStatus(`Demo pack loaded${scope}.`);

    if (mode === "showcase") {
      log("Dataset ready. Click a demo card to run it.");
    } else {
      log("OK. Pick a preset (sidebar / palette) or write custom SQL.");
    }
  } catch (e: any) {
    const msg = e?.stack ?? e?.message ?? String(e);
    setStatus("Load failed.");
    log(
      "ERROR (pack load):\n" +
        msg +
        "\n\nDevTools → Network: check parquet/manifest fetches."
    );
    throw e;
  }
}

async function runQuery() {
  await ensureDB();

  if (!loaded) {
    setStatus("Dataset not loaded.");
    log(mode === "showcase" ? "Click “Load dataset” or a demo card." : "Click 'Load dataset' first.");
    return;
  }

  const sql = (sqlEl.value || "").trim();
  if (!sql) return;

  setStatus("Running query…");
  const t0 = performance.now();
  const res = await conn!.query(sql);
  const ms = Math.round(performance.now() - t0);

  const rows = res.toArray().slice(0, 100);
  log(jsonSafe(rows, 2));
  setStatus(`OK (${rows.length} rows shown, ${ms} ms)`);
}

function applyQuery(q: QueryDef, runNow: boolean) {
  sqlEl.value = q.sql;
  if (runNow) runQuery().catch(console.error);
}

/* Explore pack UI */
function renderPack(list: QueryDef[]) {
  if (!packEl) return;

  packEl.innerHTML = list
    .map(
      (q) => `
<button class="qp-item" data-qid="${q.id}" type="button"
  style="width:100%; text-align:left; padding:10px 10px; border:1px solid #222; background:#070707; color:#fff; border-radius:12px; margin-bottom:8px; cursor:pointer;">
  <div style="display:flex; justify-content:space-between; gap:10px;">
    <span>${q.title}</span>
    ${q.hotkey ? `<span style="color:#666; font-size:12px;">Alt+${q.hotkey}</span>` : ""}
  </div>
  <div style="color:#888; font-size:12px; margin-top:2px;">${q.group} · ${q.description}</div>
</button>
`
    )
    .join("");

  packEl.querySelectorAll<HTMLButtonElement>(".qp-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.qid!;
      const q = ACTIVE_QUERIES.find((x) => x.id === id);
      if (!q) return;
      applyQuery(q, false); // explore: click = load only
    });
  });
}

function filterPack() {
  if (!packSearchEl) return;

  const s = (packSearchEl.value || "").trim().toLowerCase();
  const filtered = !s
    ? ACTIVE_QUERIES
    : ACTIVE_QUERIES.filter((q) =>
        (q.title + " " + q.description + " " + q.tags.join(" ") + " " + q.group)
          .toLowerCase()
          .includes(s)
      );

  renderPack(filtered);
}

/* Showcase featured UI */
function renderFeatured() {
  if (!featuredEl) return;

  const featured = ACTIVE_QUERIES.filter((q) => q.featured);

  featuredEl.innerHTML =
    featured.length === 0
      ? `<div class="muted small">No featured demos found.</div>`
      : featured
          .map(
            (q) => `
<button data-qid="${q.id}" type="button"
  style="padding:12px; border:1px solid #222; background:#070707; color:#fff; border-radius:14px; cursor:pointer; text-align:left;">
  <div style="display:flex; justify-content:space-between; gap:10px;">
    <strong style="font-weight:600;">${q.title}</strong>
    ${q.hotkey ? `<span style="color:#666; font-size:12px;">Alt+${q.hotkey}</span>` : ""}
  </div>
  <div style="color:#888; font-size:12px; margin-top:6px;">${q.description}</div>
</button>
`
          )
          .join("");

  featuredEl.querySelectorAll<HTMLButtonElement>("button[data-qid]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const q = ACTIVE_QUERIES.find((x) => x.id === btn.dataset.qid);
      if (!q) return;

      // Showcase: user-initiated load (reliable) + run
      if (!loaded) {
        try {
          await loadPack();
        } catch (e) {
          console.error(e);
          // loadPack already wrote status/output
          return;
        }
      }

      applyQuery(q, true);
    });
  });
}

/* Mount */
if (mode === "showcase") {
  setStatus("Ready. Click a demo to start.");
  log("No demo run yet.");
} else {
  setStatus("Ready.");
  log("Waiting…");
  renderPack(ACTIVE_QUERIES);
  packSearchEl?.addEventListener("input", filterPack);
}

renderFeatured();

/* Buttons */
btnLoad.addEventListener("click", () =>
  loadPack().catch((e) => {
    console.error(e);
    // loadPack already wrote status/output, but keep a generic fallback
    setStatus("Load failed");
    log("ERROR: " + (e?.stack ?? e?.message ?? String(e)));
  })
);

btnRun.addEventListener("click", () =>
  runQuery().catch((e) => {
    console.error(e);
    setStatus("Query failed");
    log("ERROR: " + (e?.stack ?? e?.message ?? String(e)));
  })
);

/**
 * Explore-only power features.
 * Showcase should not require engineering to view a demo.
 */
if (mode === "explore") {
  const palette = createPalette({
    queries: ACTIVE_QUERIES,
    onPick: (q, runImmediately) => applyQuery(q, runImmediately),
    runOnClick: false,
  });

  document.addEventListener("keydown", (e) => {
    const isMac = /mac/i.test(navigator.platform);
    const cmd = isMac ? e.metaKey : e.ctrlKey;

    if (cmd && e.key.toLowerCase() === "k") {
      e.preventDefault();
      palette.show();
      return;
    }
    if (cmd && e.key === "Enter") {
      e.preventDefault();
      runQuery().catch(console.error);
      return;
    }
    if (e.altKey && /^[1-9]$/.test(e.key)) {
      const q = ACTIVE_QUERIES.find((x) => x.hotkey === e.key);
      if (!q) return;
      e.preventDefault();
      applyQuery(q, true);
      return;
    }
  });
}
