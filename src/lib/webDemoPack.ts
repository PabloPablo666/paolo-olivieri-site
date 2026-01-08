// src/lib/webDemoPack.ts
import { DuckDBDataProtocol } from "./duckdb";

// stringify che non esplode su BigInt (DuckDB spesso spara stringhe comunque, ma meglio safe)
export function jsonSafe(v: unknown, indent = 2) {
  return JSON.stringify(
    v,
    (_k, val) => (typeof val === "bigint" ? val.toString() : val),
    indent
  );
}

type Manifest = {
  pack_name: string;
  files: Record<
    string,
    {
      path: string;
      rows?: number;
      bytes?: number;
    }
  >;
};

// mapping: directory -> view name
const VIEW_MAP: Record<string, string> = {
  releases_demo: "releases",
  release_artists_demo: "release_artists",
  release_label_xref_demo: "release_label_xref",
  artist_name_map_demo: "artist_name_map",
  artists_demo: "artists",
  artist_aliases_demo: "artist_aliases",
  artist_memberships_demo: "artist_memberships",
};

// dove sta il pack sul sito (mettilo in /public)
const DEFAULT_MANIFEST_URL = "/data/web_demo_pack_v1/demo_manifest.json";

export async function loadWebDemoPack(db: any, conn: any, manifestUrl = DEFAULT_MANIFEST_URL) {
  // 1) fetch manifest
  const res = await fetch(manifestUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load demo manifest: ${manifestUrl} (${res.status})`);
  const manifest = (await res.json()) as Manifest;

  // 2) For each file entry, register file URL + create view
  for (const [dir, viewName] of Object.entries(VIEW_MAP)) {
    // Expect parquet at /data/<pack_name>/<dir>/data.parquet
    const parquetUrl = new URL(`/data/${manifest.pack_name}/${dir}/data.parquet`, location.href).toString();

    // register in DuckDB virtual FS with a stable filename
    const duckFile = `${dir}.parquet`;

    await db.registerFileURL(duckFile, parquetUrl, DuckDBDataProtocol.HTTP, true);

    await conn.query(`
      CREATE OR REPLACE VIEW ${viewName} AS
      SELECT * FROM read_parquet('${duckFile}');
    `);
  }

  return manifest;
}
