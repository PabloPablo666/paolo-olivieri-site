// src/lib/queryPack.ts
export type QueryDef = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  group: "Overview" | "Releases" | "Artists" | "Memberships" | "Showcase";
  sql: string;
  hotkey?: string; // "1".."9"
  featured?: boolean; // show on Showcase top
};

export const QUERY_PACK: QueryDef[] = [
  {
    id: "overview.tables",
    title: "Dataset overview (row counts)",
    description: "Sanity check: number of rows per table in the web demo pack",
    tags: ["overview", "sanity"],
    group: "Overview",
    hotkey: "1",
    featured: true,
    sql: `
SELECT 'releases' AS table, count(*) AS n FROM releases
UNION ALL SELECT 'release_artists', count(*) FROM release_artists
UNION ALL SELECT 'release_label_xref', count(*) FROM release_label_xref
UNION ALL SELECT 'artist_name_map', count(*) FROM artist_name_map
UNION ALL SELECT 'artists', count(*) FROM artists
UNION ALL SELECT 'artist_aliases', count(*) FROM artist_aliases
UNION ALL SELECT 'artist_memberships', count(*) FROM artist_memberships
ORDER BY table;
    `.trim(),
  },
  {
    id: "releases.top_countries",
    title: "Top countries",
    description: "Simple aggregation on releases.country (sample scope)",
    tags: ["releases", "agg"],
    group: "Releases",
    hotkey: "2",
    featured: true,
    sql: `
SELECT country, COUNT(*) AS n
FROM releases
WHERE country IS NOT NULL
GROUP BY 1
ORDER BY n DESC
LIMIT 20;
    `.trim(),
  },
  {
    id: "releases.top_styles",
    title: "Top styles (explode string)",
    description: "Explode denormalised styles and aggregate",
    tags: ["releases", "unnest"],
    group: "Releases",
    hotkey: "3",
    featured: true,
    sql: `
WITH exploded AS (
  SELECT unnest(str_split(styles, ',')) AS style
  FROM releases
  WHERE styles IS NOT NULL
)
SELECT trim(style) AS style, count(*) AS n
FROM exploded
GROUP BY 1
ORDER BY n DESC
LIMIT 25;
    `.trim(),
  },
  {
    id: "membership.top_groups",
    title: "Groups with most members",
    description: "Graph-ish query on membership edges (group ↔ members)",
    tags: ["memberships", "graph"],
    group: "Memberships",
    hotkey: "4",
    featured: true,
    sql: `
SELECT
  group_id,
  max(group_name) AS group_name,
  count(DISTINCT member_id) AS n_members
FROM artist_memberships
GROUP BY 1
ORDER BY n_members DESC
LIMIT 50;
    `.trim(),
  },
  {
    id: "showcase.release_rollup",
    title: "Release rollup (artists[] + labels[])",
    description: "End-to-end joins via bridges + name map + aggregation",
    tags: ["showcase", "joins", "modeling"],
    group: "Showcase",
    hotkey: "5",
    featured: true,
    sql: `
WITH br AS (
  SELECT release_id, title, country, released
  FROM releases
  WHERE country IS NOT NULL
  ORDER BY release_id
  LIMIT 50
),
artist_roll AS (
  SELECT
    ra.release_id,
    count(DISTINCT a.artist_id) AS n_artists,
    array_agg(DISTINCT a.name) AS artists
  FROM release_artists ra
  JOIN br ON br.release_id = ra.release_id
  JOIN artist_name_map am ON am.norm_name = ra.artist_norm
  JOIN artists a ON a.artist_id = am.artist_id
  GROUP BY 1
),
label_roll AS (
  SELECT
    rl.release_id,
    count(DISTINCT rl.label_norm) AS n_labels,
    array_agg(DISTINCT rl.label_name) AS labels
  FROM release_label_xref rl
  JOIN br ON br.release_id = rl.release_id
  GROUP BY 1
)
SELECT
  br.*,
  coalesce(ar.n_artists, 0) AS n_artists,
  coalesce(lr.n_labels, 0)  AS n_labels,
  ar.artists,
  lr.labels
FROM br
LEFT JOIN artist_roll ar ON ar.release_id = br.release_id
LEFT JOIN label_roll  lr ON lr.release_id = br.release_id;
    `.trim(),
  },

  // Extra non-featured (solo pack, utile per Explore)
  {
    id: "artists.alias_coverage",
    title: "Alias coverage (quick)",
    description: "How many aliases per artist (rough profiling)",
    tags: ["artists", "aliases", "profiling"],
    group: "Artists",
    hotkey: "6",
    sql: `
WITH a AS (
  SELECT artist_id, count(*) AS n_aliases
  FROM artist_aliases
  GROUP BY 1
)
SELECT
  approx_quantile(n_aliases, 0.5) AS p50,
  approx_quantile(n_aliases, 0.9) AS p90,
  approx_quantile(n_aliases, 0.99) AS p99,
  count(*) AS n_artists_with_aliases
FROM a;
    `.trim(),
  },
];
