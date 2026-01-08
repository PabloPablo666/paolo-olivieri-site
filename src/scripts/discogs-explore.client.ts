// src/scripts/discogs-explore.client.ts
import { getDuckDB } from "../lib/duckdb";
import { loadWebDemoPack, jsonSafe } from "../lib/webDemoPack";

const statusEl = document.getElementById("status") as HTMLDivElement | null;
const outEl = document.getElementById("out") as HTMLPreElement | null;
const sqlEl = document.getElementById("sql") as HTMLTextAreaElement | null;
const btnLoad = document.getElementById("btnLoad") as HTMLButtonElement | null;
const btnRun = document.getElementById("btnRun") as HTMLButtonElement | null;

if (!statusEl || !outEl || !sqlEl || !btnLoad || !btnRun) {
  throw new Error("Explore page DOM not found (missing required elements).");
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
  setStatus("Dataset loaded: releases + bridges + artists");
  log("OK. Run a query.\nHint: try the default query.");
}

async function runQuery() {
  const h = await ensureDB();

  if (!loaded) {
    setStatus("Dataset not loaded.");
    log("Click 'Load dataset' first.");
    return;
  }

  const sql = (sqlEl.value || "").trim();
  if (!sql) return;

  setStatus("Running query...");
  const res = await h.conn.query(sql);
  const rows = res.toArray().slice(0, 100);
  log(jsonSafe(rows, 2));
  setStatus(`OK (${rows.length} rows shown)`);
}

btnLoad.addEventListener("click", () => {
  loadPack().catch((e) => {
    console.error(e);
    setStatus("Load failed");
    log("ERROR: " + (e?.stack ?? e?.message ?? String(e)));
  });
});

btnRun.addEventListener("click", () => {
  runQuery().catch((e) => {
    console.error(e);
    setStatus("Query failed");
    log("ERROR: " + (e?.stack ?? e?.message ?? String(e)));
  });
});
