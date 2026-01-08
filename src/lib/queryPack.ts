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
  // Explore pack
  // --------------------------
  {
    id: "explore.whats_in_here",
    title: "What’s in here? (schema discovery)",
    description: "List all tables available in the current database",
    tags: ["explore", "schema", "discovery"],
    group: "Overview",
    modes: ["explore"],
    sql: `
SHOW TABLES;
    `.trim(),
  },
  {
    id: "explore.releases.first20",
    title: "First 20 releases (real data)",
    description: "Inspect a random sample of real release rows",
    tags: ["explore", "releases", "sample"],
    group: "Releases",
    modes: ["explore"],
    sql: `
SELECT release_id, title, country, released
FROM releases
ORDER BY random()
LIMIT 20;
    `.trim(),
  },
  {
    id: "explore.releases.by_country",
    title: "How many releases per country",
    description: "Basic GROUP BY and ORDER BY example",
    tags: ["explore", "releases", "aggregation"],
    group: "Releases",
    modes: ["explore"],
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
    id: "explore.releases.search_keyword",
    title: "Search releases by keyword",
    description: "Search release titles using ILIKE",
    tags: ["explore", "releases", "search"],
    group: "Releases",
    modes: ["explore"],
    sql: `
SELECT release_id, title, country, released
FROM releases
WHERE title ILIKE '%jazz%'
ORDER BY released NULLS LAST
LIMIT 30;
    `.trim(),
  },
  {
    id: "explore.labels.top_labels",
    title: "Which labels have the most releases?",
    description: "Count distinct releases per label",
    tags: ["explore", "labels", "aggregation"],
    group: "Releases",
    modes: ["explore"],
    sql: `
SELECT label_name, COUNT(DISTINCT release_id) AS n_releases
FROM release_label_xref
WHERE label_name IS NOT NULL
GROUP BY 1
ORDER BY n_releases DESC
LIMIT 20;
    `.trim(),
  },
  {
    id: "explore.join.release_label",
    title: "Basic join: release → label",
    description: "One row per release–label pair",
    tags: ["explore", "join", "labels"],
    group: "Releases",
    modes: ["explore"],
    sql: `
SELECT r.release_id, r.title, x.label_name
FROM releases r
JOIN release_label_xref x ON x.release_id = r.release_id
ORDER BY r.release_id
LIMIT 30;
    `.trim(),
  },
  {
    id: "explore.join.release_artist",
    title: "Basic join: release → artist",
    description: "Join via normalized artist name and name map",
    tags: ["explore", "join", "artists"],
    group: "Artists",
    modes: ["explore"],
    sql: `
SELECT
  r.release_id,
  r.title,
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
    id: "explore.alias.find_variants",
    title: "Artist aliases (name variants)",
    description: "Find alias names for a given artist",
    tags: ["explore", "artists", "aliases"],
    group: "Artists",
    modes: ["explore"],
    sql: `
SELECT
  a.artist_id,
  a.name,
  aa.alias_name
FROM artists a
JOIN artist_aliases aa ON aa.artist_id = a.artist_id
WHERE a.name ILIKE '%st germain%'
LIMIT 50;
    `.trim(),
  },
  {
    id: "explore.membership.top_groups",
    title: "Groups with the most members",
    description: "Simple aggregation on artist memberships",
    tags: ["explore", "memberships", "aggregation"],
    group: "Memberships",
    modes: ["explore"],
    sql: `
SELECT
  group_id,
  max(group_name) AS group_name,
  COUNT(DISTINCT member_id) AS n_members
FROM artist_memberships
GROUP BY 1
ORDER BY n_members DESC
LIMIT 30;
    `.trim(),
  },
  {
    id: "explore.one_release.full_context",
    title: "One release, full context",
    description: "Inspect a single release with its associated labels",
    tags: ["explore", "join", "context"],
    group: "Showcase",
    modes: ["explore"],
    sql: `
WITH one AS (
  SELECT release_id
  FROM releases
  WHERE title IS NOT NULL
  ORDER BY release_id
  LIMIT 1
)
SELECT
  r.release_id,
  r.title,
  r.country,
  r.released,
  x.label_name
FROM releases r
JOIN one o ON o.release_id = r.release_id
LEFT JOIN release_label_xref x ON x.release_id = r.release_id
LIMIT 50;
    `.trim(),
  },

  // --------------------------
  // Showcase pack
  // --------------------------
  {
    id: "overview.tables",
    title: "Dataset overview (row counts)",
    description: "Sanity check: number of rows per table",
    tags: ["overview", "sanity"],
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
ORDER BY tbl;
    `.trim(),
  },
  {
    id: "releases.top_countries",
    title: "Top countries",
    description: "Releases grouped by country",
    tags: ["releases", "aggregation"],
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
    tags: ["releases", "unnest"],
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
    description: "Graph-style aggregation on memberships",
    tags: ["memberships", "graph"],
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
];
