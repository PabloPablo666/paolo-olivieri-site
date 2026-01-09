// src/lib/queryPack.ts
export type Mode = "explore" | "showcase";

export type QueryDef = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  group: "Overview" | "Releases" | "Artists" | "Memberships" | "Showcase";
  sql: string;

  // Optional metadata
  hotkey?: string;
  featured?: boolean;
  modes?: Mode[];
};

export const QUERY_PACK: QueryDef[] = [
  // --------------------------
// Explore pack (Schema → Rows → Joins)
// --------------------------
{
  id: "explore.schema.show_tables",
  title: "Show tables",
  description: "List all tables available in the current database",
  tags: ["explore", "schema", "discovery"],
  group: "Overview",
  modes: ["explore"],
  sql: `
SHOW TABLES;
  `.trim(),
},
{
  id: "explore.schema.describe_table",
  title: "Describe a table (edit table_name)",
  description: "List columns, types and nullability for a table (edit table_name in the WHERE clause)",
  tags: ["explore", "schema", "columns"],
  group: "Overview",
  modes: ["explore"],
  sql: `
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'main'
  AND table_name = 'releases'  -- change this (e.g. 'labels', 'artists', 'masters')
ORDER BY ordinal_position;
  `.trim(),
},
{
  id: "explore.sample.labels",
  title: "Sample rows: labels (random 20)",
  description: "Preview real rows from labels (parent + sublabels fields if present)",
  tags: ["explore", "sample", "labels"],
  group: "Releases",
  modes: ["explore"],
  sql: `
SELECT
  label_id,
  name,
  parent_label_id,
  parent_label_name,
  sublabel_ids_csv,
  sublabel_names_csv
FROM labels
ORDER BY random()
LIMIT 20;
  `.trim(),
},
{
  id: "explore.join.release_label",
  title: "Basic join: releases → labels (xref)",
  description: "One row per release–label pair via release_label_xref",
  tags: ["explore", "join", "labels", "xref"],
  group: "Releases",
  modes: ["explore"],
  sql: `
SELECT
  r.release_id,
  r.title,
  x.label_name,
  x.label_norm
FROM releases r
JOIN release_label_xref x ON x.release_id = r.release_id
ORDER BY r.release_id
LIMIT 30;
  `.trim(),
},
{
  id: "explore.join.release_artist",
  title: "Basic join: releases → artists (name map)",
  description: "Join via release_artists → artist_name_map → artists",
  tags: ["explore", "join", "artists"],
  group: "Artists",
  modes: ["explore"],
  sql: `
SELECT
  r.release_id,
  r.title,
  a.artist_id,
  a.name AS artist_name
FROM releases r
JOIN release_artists ra ON ra.release_id = r.release_id
JOIN artist_name_map am ON am.norm_name = ra.artist_norm
JOIN artists a ON a.artist_id = am.artist_id
ORDER BY r.release_id
LIMIT 30;
  `.trim(),
},
{
  id: "explore.labels.parent_children",
  title: "Labels: parents with sublabels",
  description: "Show labels that have sublabels listed (CSV fields)",
  tags: ["explore", "labels", "hierarchy"],
  group: "Releases",
  modes: ["explore"],
  sql: `
SELECT
  label_id,
  name,
  parent_label_id,
  parent_label_name,
  sublabel_names_csv
FROM labels
WHERE sublabel_names_csv IS NOT NULL
  AND length(trim(sublabel_names_csv)) > 0
ORDER BY random()
LIMIT 30;
  `.trim(),
},


  // --------------------------
  // Showcase pack (featured demos)
  // --------------------------
  {
    id: "overview.tables",
    title: "Dataset overview (row counts)",
    description: "Row counts across the demo tables (sanity check)",
    tags: ["showcase", "overview", "sanity"],
    group: "Overview",
    modes: ["showcase"],
    featured: true,
    sql: `
SELECT 'releases' AS tbl, count(*) AS n FROM releases
UNION ALL SELECT 'release_artists', count(*) FROM release_artists
UNION ALL SELECT 'release_label_xref', count(*) FROM release_label_xref
UNION ALL SELECT 'artist_name_map', count(*) FROM artist_name_map
UNION ALL SELECT 'artists', count(*) FROM artists
UNION ALL SELECT 'artist_aliases', count(*) FROM artist_aliases
UNION ALL SELECT 'artist_memberships', count(*) FROM artist_memberships
UNION ALL SELECT 'labels', count(*) FROM labels
UNION ALL SELECT 'masters', count(*) FROM masters
ORDER BY tbl;
    `.trim(),
  },

  {
    id: "releases.top_countries",
    title: "Top countries",
    description: "Releases grouped by country",
    tags: ["showcase", "releases", "aggregation"],
    group: "Releases",
    modes: ["showcase"],
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
    title: "Top styles",
    description: "Explode denormalized styles and aggregate",
    tags: ["showcase", "releases", "unnest"],
    group: "Releases",
    modes: ["showcase"],
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
    title: "Groups with the most members",
    description: "Graph-ish aggregation on membership edges",
    tags: ["showcase", "memberships", "graph"],
    group: "Memberships",
    modes: ["showcase"],
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
    title: "Release rollup (artists + labels)",
    description: "End-to-end joins with aggregation",
    tags: ["showcase", "joins", "modeling"],
    group: "Showcase",
    modes: ["showcase"],
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

  {
    id: "showcase.labels.hierarchy_sample",
    title: "Labels hierarchy (parent + sublabels)",
    description: "Quick demo of label parent and sublabel fields from labels_v10",
    tags: ["showcase", "labels", "hierarchy"],
    group: "Showcase",
    modes: ["showcase"],
    featured: true,
    sql: `
SELECT
  label_id,
  name,
  parent_label_name,
  sublabel_names_csv
FROM labels
WHERE parent_label_id IS NOT NULL OR sublabel_names_csv IS NOT NULL
ORDER BY random()
LIMIT 40;
    `.trim(),
  },
];
