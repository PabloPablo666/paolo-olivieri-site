// src/lib/duckdb.ts
import * as duckdb from "@duckdb/duckdb-wasm";

export type DuckHandle = {
  db: duckdb.AsyncDuckDB;
  conn: duckdb.AsyncDuckDBConnection;
  bundle: duckdb.DuckDBBundle;
};

let cached: Promise<DuckHandle> | null = null;

/**
 * Local bundles served from /public/duckdb/*
 * This avoids:
 * - CORS issues constructing Worker from CDN
 * - wrong MIME type if WASM isn't served correctly
 */
function getLocalBundles(): duckdb.DuckDBBundles {
  return {
    mvp: {
      mainModule: "/duckdb/duckdb-mvp.wasm",
      mainWorker: "/duckdb/duckdb-browser-mvp.worker.js",
    },
    eh: {
      mainModule: "/duckdb/duckdb-eh.wasm",
      mainWorker: "/duckdb/duckdb-browser-eh.worker.js",
    },
    // If you later enable COI/threads, add `coi` here.
  };
}

async function bootDuckDB(): Promise<DuckHandle> {
  const bundles = getLocalBundles();

  // Pick best bundle for the platform (EH if supported, otherwise MVP)
  // If you want to force MVP always, replace with: const bundle = bundles.mvp;
  const bundle = await duckdb.selectBundle(bundles);

  // Worker must be same-origin to avoid SecurityError on Worker construction
  const worker = new Worker(bundle.mainWorker, { type: "module" });

  const logger = new duckdb.ConsoleLogger(); // quiet-ish; change if you want
  const db = new duckdb.AsyncDuckDB(logger, worker);

  // For DuckDB WASM, instantiate() expects the WASM module URL.
  await db.instantiate(bundle.mainModule, null);

  const conn = await db.connect();
  return { db, conn, bundle };
}

export async function getDuckDB(): Promise<DuckHandle> {
  if (!cached) cached = bootDuckDB();
  return cached;
}

export const DuckDBDataProtocol = duckdb.DuckDBDataProtocol;
