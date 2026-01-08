// src/scripts/discogs-workbench.client.ts
import { getDuckDB } from "../lib/duckdb";
import { loadWebDemoPack, jsonSafe } from "../lib/webDemoPack";
import { QUERY_PACK, type QueryDef } from "../lib/queryPack";

type Mode = "explore" | "showcase";

/**
 * DOM helpers
 */
function $<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

const statusEl = $<HTMLElement>("status");
const outEl = $<HTMLPreElement>("out");
const sqlEl = $<HTMLTextAreaElement>("sql");

// Optional buttons (exist in Explore, not in Showcase)
const btnLoad = $<HTMLButtonElement>("btnLoad");
const btnRun = $<HTMLButtonElement>("btnRun");

// Explore-only UI (optional)
const packEl = $<HTMLDivElement>("queryPack");
const packSearchEl = $<HTMLInputElement>("querySearch");

// Showcase-only UI (optional)
const featuredEl = $<HTMLDivElement>("featuredQueries");

/**
 * Required elements: if these are missing, the page isn't the workbench.
 */
if (!statusEl || !outEl || !sqlEl) {
  throw new Error("Workbench DOM not found (missing required elements).");
}

/**
 * Mode selection:
 * - Prefer explicit data-discogs-mode on <body>
 * - Otherwise infer: if explore DOM exists => explore, else showcase
 */
const attrMode = (document.body.getAttribute("data-discogs-mode") as Mode | null) ?? null;
const hasExploreDom = !!(packEl && packSearchEl);
const inferredMode: Mode = hasExploreDom ? "explore" : "showcase";
const mode: Mode = attrMode ?? inferredMode;

/**
 * Active queries:
 * - Explore: all queries
 * - Showcase: featured + Showcase group
 */
 const MODE_QUERIES = QUERY_PACK.filter((q) => !q.modes || q.modes.includes(mode));

 const ACTIVE_QUERIES: QueryDef[] =
   mode === "showcase"
     ? MODE_QUERIES.filter((q) => q.featured || q.group === "Showcase")
     : MODE_QUERIES;

/**
 * DuckDB state
 */
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
  if (mode === "explore") log("Booting DuckDB WASM…");

  const timeoutMs = 15000;
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`DuckDB init timed out after ${timeoutMs}ms`)), timeoutMs)
  );

  try {
    const h = await Promise.race([getDuckDB(), timeout]);
    db = h.db;
    conn = h.conn;

    setStatus("DuckDB ready.");
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
      log("OK. Pick a preset (sidebar) or write custom SQL.");
    }
  } catch (e: any) {
    const msg = e?.stack ?? e?.message ?? String(e);
    setStatus("Load failed.");
    log("ERROR (pack load):\n" + msg + "\n\nDevTools → Network: check parquet/manifest fetches.");
    throw e;
  }
}

async function runQuery() {
  await ensureDB();

  if (!loaded) {
    setStatus("Dataset not loaded.");
    log(mode === "showcase" ? "Click a demo card." : "Click 'Load dataset' first.");
    return;
  }

  const sql = (sqlEl.value || "").trim();
  if (!sql) return;

  setStatus("Running query…");
  const t0 = performance.now();

  try {
    const res = await conn!.query(sql);
    const ms = Math.round(performance.now() - t0);

;

    const rows = res.toArray().slice(0, 100);
    log(jsonSafe(rows, 2));
    setStatus(`OK (${rows.length} rows shown, ${ms} ms)`);
  } catch (e: any) {
    const msg = e?.stack ?? e?.message ?? String(e);
    setStatus("Query failed");
    log("ERROR (query):\n" + msg);
    throw e;
  }
}

function applyQuery(q: QueryDef, runNow: boolean) {
  sqlEl.value = q.sql;
  if (runNow) runQuery().catch(console.error);
}

/**
 * Explore pack UI (sidebar)
 * NOTE: hotkey badges removed.
 */
function renderPack(list: QueryDef[]) {
  if (!packEl) return;

  packEl.innerHTML = list
    .map(
      (q) => `
<button class="qp-item" data-qid="${q.id}" type="button"
  style="width:100%; text-align:left; padding:10px 10px; border:1px solid #222; background:#070707; color:#fff; border-radius:12px; margin-bottom:8px; cursor:pointer;">
  <div style="display:flex; justify-content:space-between; gap:10px;">
    <span>${q.title}</span>
  </div>
  <div style="color:#888; font-size:12px; margin-top:2px;">${q.group} · ${q.description}</div>
</button>`
    )
    .join("");

  packEl.querySelectorAll<HTMLButtonElement>(".qp-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.qid!;
      const q = ACTIVE_QUERIES.find((x) => x.id === id);
      if (!q) return;
      // Explore: click loads SQL but does not run automatically
      applyQuery(q, false);
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

/**
 * Showcase featured UI
 * NOTE: hotkey badges removed.
 */
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
  </div>
  <div style="color:#888; font-size:12px; margin-top:6px;">${q.description}</div>
</button>`
          )
          .join("");

  featuredEl.querySelectorAll<HTMLButtonElement>("button[data-qid]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const q = ACTIVE_QUERIES.find((x) => x.id === btn.dataset.qid);
      if (!q) return;

      // Showcase: click should "just work" (auto-load then run)
      if (!loaded) {
        try {
          await loadPack();
        } catch {
          return;
        }
      }

      applyQuery(q, true);
    });
  });
}

/**
 * Mount
 * NOTE: no global hotkeys, no palette.
 */
function mount() {
  // Showcase polish: editor is informational
  if (mode === "showcase") {
    sqlEl.readOnly = true;
  }

  renderFeatured();

  if (mode === "showcase") {
    setStatus("Ready. Click a demo to start.");
    log("No demo run yet.");
  } else {
    setStatus("Ready.");
    log("Waiting…");

    if (hasExploreDom) {
      renderPack(ACTIVE_QUERIES);
      packSearchEl!.addEventListener("input", filterPack);
    }
  }

  // Buttons (optional)
  btnLoad?.addEventListener("click", () =>
    loadPack().catch((e) => {
      console.error(e);
      setStatus("Load failed");
      log("ERROR: " + (e?.stack ?? e?.message ?? String(e)));
    })
  );

  btnRun?.addEventListener("click", () =>
    runQuery().catch((e) => {
      console.error(e);
      setStatus("Query failed");
      log("ERROR: " + (e?.stack ?? e?.message ?? String(e)));
    })
  );
}

mount();
