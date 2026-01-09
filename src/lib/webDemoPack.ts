import { DuckDBDataProtocol } from "./duckdb";

// Safe JSON stringify (DuckDB can return BigInt)
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

/**
 * Directory name  -> SQL view name
 * These are the tables exposed to the browser SQL layer.
 */
const VIEW_MAP: Record<string, string> = {
  // core entities
  releases_demo: "releases",
  masters_demo: "masters",
  artists_demo: "artists",
  labels_demo: "labels",

  // bridges / warehouse
  release_artists_demo: "release_artists",
  release_label_xref_demo: "release_label_xref",
  artist_name_map_demo: "artist_name_map",

  // artist graph
  artist_aliases_demo: "artist_aliases",
  artist_memberships_demo: "artist_memberships",
};

// Where the demo pack lives on the site (served from /public)
const DEFAULT_MANIFEST_URL = "/data/web_demo_pack_v1/demo_manifest.json";

/**
 * Load the Discogs web demo pack into DuckDB WASM
 * - registers Parquet files via HTTP
 * - creates SQL views matching the lakehouse schema (adapted)
 */
export async function loadWebDemoPack(
  db: any,
  conn: any,
  manifestUrl = DEFAULT_MANIFEST_URL
) {
  // 1) Fetch manifest
  const res = await fetch(manifestUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load demo manifest: ${manifestUrl} (${res.status})`);
  }

  const manifest = (await res.json()) as Manifest;

  // 2) Register each Parquet file and expose it as a view
  for (const [dir, viewName] of Object.entries(VIEW_MAP)) {
    // Expected path:
    // /data/<pack_name>/<dir>/data.parquet
    const parquetUrl = new URL(
      `/data/${manifest.pack_name}/${dir}/data.parquet`,
      location.href
    ).toString();

    // Stable virtual filename inside DuckDB
    const duckFile = `${dir}.parquet`;

    await db.registerFileURL(
      duckFile,
      parquetUrl,
      DuckDBDataProtocol.HTTP,
      true
    );

    await conn.query(`
      CREATE OR REPLACE VIEW ${viewName} AS
      SELECT * FROM read_parquet('${duckFile}');
    `);
  }

  return manifest;
}
