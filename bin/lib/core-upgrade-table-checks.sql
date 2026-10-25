SET timezone = 'UTC';
SET datestyle = 'ISO, MDY';
SET intervalstyle = 'postgres';
SELECT format(
  'SELECT %1$L, count(*), coalesce(md5(string_agg(md5((%2$s)::text), '''' ORDER BY md5((%2$s)::text))), md5('''')) FROM %3$I.%4$I t;',
  n.nspname || '.' || c.relname, spatial.row_expression, n.nspname, c.relname
)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN LATERAL (
  -- Geometry's automatic GeoJSON rendering changes between PostGIS versions.
  -- Compare its lossless EWKB representation, including SRID, instead.
  SELECT CASE WHEN count(*) = 0 THEN 'to_jsonb(t)' ELSE format(
    '(to_jsonb(t) - %L::text[] || jsonb_build_object(%s))',
    array_agg(a.attname::text ORDER BY a.attnum),
    string_agg(format('%L, encode(ST_AsEWKB(t.%I::geometry), ''hex'')', a.attname, a.attname), ', ' ORDER BY a.attnum)
  ) END AS row_expression
  FROM pg_attribute a JOIN pg_type typ ON typ.oid = a.atttypid
  WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    AND typ.typname IN ('geometry', 'geography')
) spatial
WHERE c.relkind IN ('r', 'p')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg_toast%'
  AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e')
ORDER BY n.nspname, c.relname
\gexec
