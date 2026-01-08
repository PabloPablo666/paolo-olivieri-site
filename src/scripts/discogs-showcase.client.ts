// src/scripts/discogs-showcase.client.ts
import { getDuckDB } from "../lib/duckdb";
import { loadWebDemoPack, jsonSafe } from "../lib/webDemoPack";

const statusEl = document.getElementById("status") as HTMLParagraphElement | null;
const outEl = document.getElementById("out") as HTMLPreElement | null;

const btnLoad = document.getElementById("btnLoad") as HTMLButtonElement | null;
const btnSpotlight = document.getElementById("btnSpotlight") as HTMLButtonElement | null;
const btnCountries = document.getElementById("btnCountries") as HTMLButtonElement | null;

if (!statusEl || !outEl || !btnLoad || !btnSpotlight || !btnCountries) {
  throw new Error("Showcase page DOM not found (missing required elements).");
}

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
  setStatus("Booting DuckDB WASM...");
  const h = await getDuckDB();
  db = h.db;
  conn = h.conn;
  setStatus("DuckDB ready.");
  return h;
}

async function loadPack() {
  const h = await ensureDB();
  setStatus("Loading web demo pack (multi-table)...");
  await loadWebDemoPack(h.db, h.conn);
  loaded = true;
  setStatus("Demo pack loaded.");
  log("Loaded. Try Spotlight (rollup) or Top countries (on the sample).");
}

async function runAndPrint(sql: string) {
  const h = await ensureDB();
  if (!loaded) {
    setStatus("Dataset not loaded. Click 'Load dataset' first.");
    log("Dataset not loaded.");
    return;
  }

  setStatus("Running query...");
  const res = await h.conn.query(sql);
  const rows = res.toArray().slice(0, 50);
  log(jsonSafe(rows, 2));
  setStatus(`OK (${rows.length} rows shown)`);
}

// 1) WOW: spotlight rollup (release -> artists[] -> labels[])
async function spotlightRollup() {
  // pick one deterministic release_id from the sample
  const sql = `
WITH pick AS (
  SELECT release_id
  FROM releases
  WHERE country IS NOT NULL
  ORDER BY release_id
  LIMIT 1
),
br AS (
  SELECT r.release_id, r.title, r.country, r.released
  FROM releases r
  JOIN pick p ON p.release_id = r.release_id
),
artist_dim AS (
  SELECT
    ra.release_id,
    array_agg(DISTINCT a.name) AS artists
  FROM release_artists ra
  JOIN br ON br.release_id = ra.release_id
  JOIN artist_name_map am ON am.norm_name = ra.artist_norm
  JOIN artists a ON a.artist_id = am.artist_id
  GROUP BY 1
),
label_dim AS (
  SELECT
    rl.release_id,
    array_agg(DISTINCT rl.label_name) AS labels
  FROM release_label_xref rl
  JOIN br ON br.release_id = rl.release_id
  GROUP BY 1
)
SELECT
  br.*,
  ad.artists,
  ld.labels
FROM br
LEFT JOIN artist_dim ad ON ad.release_id = br.release_id
LEFT JOIN label_dim  ld ON ld.release_id = br.release_id;
`.trim();

  return runAndPrint(sql);
}

// 2) (ok) Top countries, MA dichiaratamente sul sample
async function topCountries() {
  const sql = `
SELECT country, COUNT(*) AS n
FROM releases
WHERE country IS NOT NULL
GROUP BY 1
ORDER BY n DESC
LIMIT 20;
`.trim();
  return runAndPrint(sql);
}

btnLoad.addEventListener("click", () => {
  loadPack().catch((e) => {
    console.error(e);
    setStatus("Load failed");
    log("ERROR: " + (e?.stack ?? e?.message ?? String(e)));
  });
});

btnSpotlight.addEventListener("click", () => {
  spotlightRollup().catch((e) => {
    console.error(e);
    setStatus("Query failed");
    log("ERROR: " + (e?.stack ?? e?.message ?? String(e)));
  });
});

btnCountries.addEventListener("click", () => {
  topCountries().catch((e) => {
    console.error(e);
    setStatus("Query failed");
    log("ERROR: " + (e?.stack ?? e?.message ?? String(e)));
  });
});
