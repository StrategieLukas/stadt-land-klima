-- Migration: Add permissions for new rating system collections
-- This migration adds permissions for the following new collections:
--   - rating_criteria_definitions
--   - rating_criteria_values
--   - rating_sources
--   - rating_criteria_sources
--   - rating_resources
--   - measure_rating_resources
--   - decision_trees
--   - catalog_migrations

-- NOTE: Run this after the schema has been applied via directus CLI
-- The role UUIDs below are placeholders - replace with actual UUIDs from your database

-- First, let's get the role IDs we need
-- Run this query to find your role UUIDs:
-- SELECT id, name FROM directus_roles;

-- =====================================================
-- EditorLocalteam Permissions
-- =====================================================

-- rating_criteria_values: Create (for their own ratings)
INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT 
  r.id,
  'rating_criteria_values',
  'create',
  NULL,
  NULL,
  NULL,
  'criterion_definition,value_text,value_number,value_boolean,value_json,rating_measure,notes'
FROM directus_roles r WHERE r.name = 'EditorLocalteam';

-- rating_criteria_values: Read (for ratings in their localteam)
INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT 
  r.id,
  'rating_criteria_values',
  'read',
  '{"_and":[{"rating_measure":{"localteam_id":{"_in":["$CURRENT_USER.localteams.localteam_id"]}}}]}',
  NULL,
  NULL,
  '*'
FROM directus_roles r WHERE r.name = 'EditorLocalteam';

-- rating_criteria_values: Update (for ratings in their localteam)
INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT 
  r.id,
  'rating_criteria_values',
  'update',
  '{"_and":[{"rating_measure":{"localteam_id":{"_in":["$CURRENT_USER.localteams.localteam_id"]}}}]}',
  NULL,
  NULL,
  'value_text,value_number,value_boolean,value_json,notes'
FROM directus_roles r WHERE r.name = 'EditorLocalteam';

-- rating_criteria_values: Delete (for ratings in their localteam)
INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT 
  r.id,
  'rating_criteria_values',
  'delete',
  '{"_and":[{"rating_measure":{"localteam_id":{"_in":["$CURRENT_USER.localteams.localteam_id"]}}}]}',
  NULL,
  NULL,
  NULL
FROM directus_roles r WHERE r.name = 'EditorLocalteam';

-- rating_criteria_definitions: Read only (system-defined)
INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT 
  r.id,
  'rating_criteria_definitions',
  'read',
  '{"status":{"_eq":"active"}}',
  NULL,
  NULL,
  '*'
FROM directus_roles r WHERE r.name = 'EditorLocalteam';

-- rating_sources: Create (can add sources)
INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT 
  r.id,
  'rating_sources',
  'create',
  NULL,
  NULL,
  NULL,
  'title,source_type,url,file,author,publication_date,publisher,isbn_doi,is_reusable,notes'
FROM directus_roles r WHERE r.name = 'EditorLocalteam';

-- rating_sources: Read all reusable sources
INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT 
  r.id,
  'rating_sources',
  'read',
  NULL,
  NULL,
  NULL,
  '*'
FROM directus_roles r WHERE r.name = 'EditorLocalteam';

-- rating_sources: Update own sources
INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT 
  r.id,
  'rating_sources',
  'update',
  '{"user_created":{"_eq":"$CURRENT_USER"}}',
  NULL,
  NULL,
  'title,source_type,url,file,author,publication_date,publisher,isbn_doi,notes'
FROM directus_roles r WHERE r.name = 'EditorLocalteam';

-- rating_criteria_sources: Create (link sources to criteria)
INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT 
  r.id,
  'rating_criteria_sources',
  'create',
  NULL,
  NULL,
  NULL,
  'criterion_value,source,page_reference,relevance_note'
FROM directus_roles r WHERE r.name = 'EditorLocalteam';

-- rating_criteria_sources: Read
INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT 
  r.id,
  'rating_criteria_sources',
  'read',
  NULL,
  NULL,
  NULL,
  '*'
FROM directus_roles r WHERE r.name = 'EditorLocalteam';

-- rating_criteria_sources: Update
INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT 
  r.id,
  'rating_criteria_sources',
  'update',
  NULL,
  NULL,
  NULL,
  'page_reference,relevance_note'
FROM directus_roles r WHERE r.name = 'EditorLocalteam';

-- rating_criteria_sources: Delete
INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT 
  r.id,
  'rating_criteria_sources',
  'delete',
  NULL,
  NULL,
  NULL,
  NULL
FROM directus_roles r WHERE r.name = 'EditorLocalteam';

-- decision_trees: Read only (system-defined)
INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT 
  r.id,
  'decision_trees',
  'read',
  '{"is_active":{"_eq":true}}',
  NULL,
  NULL,
  'id,measure,name,version,description,tree_structure'
FROM directus_roles r WHERE r.name = 'EditorLocalteam';

-- rating_resources: Read only
INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT 
  r.id,
  'rating_resources',
  'read',
  '{"status":{"_eq":"active"}}',
  NULL,
  NULL,
  '*'
FROM directus_roles r WHERE r.name = 'EditorLocalteam';

-- measure_rating_resources: Read only
INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT 
  r.id,
  'measure_rating_resources',
  'read',
  NULL,
  NULL,
  NULL,
  '*'
FROM directus_roles r WHERE r.name = 'EditorLocalteam';

-- =====================================================
-- Massnahmenteam Permissions (Full management)
-- =====================================================

-- rating_criteria_definitions: Full CRUD
INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'rating_criteria_definitions', 'create', NULL, NULL, NULL, '*'
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'rating_criteria_definitions', 'read', NULL, NULL, NULL, '*'
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'rating_criteria_definitions', 'update', NULL, NULL, NULL, '*'
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'rating_criteria_definitions', 'delete', NULL, NULL, NULL, NULL
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

-- rating_criteria_values: Full CRUD
INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'rating_criteria_values', 'create', NULL, NULL, NULL, '*'
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'rating_criteria_values', 'read', NULL, NULL, NULL, '*'
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'rating_criteria_values', 'update', NULL, NULL, NULL, '*'
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'rating_criteria_values', 'delete', NULL, NULL, NULL, NULL
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

-- rating_sources: Full CRUD
INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'rating_sources', 'create', NULL, NULL, NULL, '*'
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'rating_sources', 'read', NULL, NULL, NULL, '*'
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'rating_sources', 'update', NULL, NULL, NULL, '*'
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'rating_sources', 'delete', NULL, NULL, NULL, NULL
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

-- rating_criteria_sources: Full CRUD
INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'rating_criteria_sources', 'create', NULL, NULL, NULL, '*'
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'rating_criteria_sources', 'read', NULL, NULL, NULL, '*'
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'rating_criteria_sources', 'update', NULL, NULL, NULL, '*'
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'rating_criteria_sources', 'delete', NULL, NULL, NULL, NULL
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

-- decision_trees: Full CRUD
INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'decision_trees', 'create', NULL, NULL, NULL, '*'
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'decision_trees', 'read', NULL, NULL, NULL, '*'
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'decision_trees', 'update', NULL, NULL, NULL, '*'
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'decision_trees', 'delete', NULL, NULL, NULL, NULL
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

-- rating_resources: Full CRUD
INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'rating_resources', 'create', NULL, NULL, NULL, '*'
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'rating_resources', 'read', NULL, NULL, NULL, '*'
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'rating_resources', 'update', NULL, NULL, NULL, '*'
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'rating_resources', 'delete', NULL, NULL, NULL, NULL
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

-- measure_rating_resources: Full CRUD
INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'measure_rating_resources', 'create', NULL, NULL, NULL, '*'
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'measure_rating_resources', 'read', NULL, NULL, NULL, '*'
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'measure_rating_resources', 'update', NULL, NULL, NULL, '*'
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'measure_rating_resources', 'delete', NULL, NULL, NULL, NULL
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

-- catalog_migrations: Full CRUD
INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'catalog_migrations', 'create', NULL, NULL, NULL, '*'
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'catalog_migrations', 'read', NULL, NULL, NULL, '*'
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'catalog_migrations', 'update', NULL, NULL, NULL, '*'
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'catalog_migrations', 'delete', NULL, NULL, NULL, NULL
FROM directus_roles r WHERE r.name = 'Massnahmenteam';

-- =====================================================
-- Frontend Role (Public read access)
-- =====================================================

-- rating_criteria_definitions: Read active only
INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'rating_criteria_definitions', 'read', '{"status":{"_eq":"active"}}', NULL, NULL, 
  'id,measure,criterion_key,name,description,criterion_type,data_type,options,display_order'
FROM directus_roles r WHERE r.name = 'frontend';

-- rating_sources: Read only
INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'rating_sources', 'read', NULL, NULL, NULL, 
  'id,title,source_type,url,author,publication_date,publisher'
FROM directus_roles r WHERE r.name = 'frontend';

-- decision_trees: Read active only
INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'decision_trees', 'read', '{"is_active":{"_eq":true}}', NULL, NULL, 
  'id,measure,name,version,description'
FROM directus_roles r WHERE r.name = 'frontend';

-- rating_resources: Read active only
INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'rating_resources', 'read', '{"status":{"_eq":"active"}}', NULL, NULL, 
  'id,name,description,resource_type,criteria'
FROM directus_roles r WHERE r.name = 'frontend';

-- =====================================================
-- Public Role (Limited read access)
-- =====================================================

-- rating_criteria_definitions: Read active only (limited fields)
INSERT INTO directus_permissions (role, collection, action, permissions, validation, presets, fields)
SELECT r.id, 'rating_criteria_definitions', 'read', '{"status":{"_eq":"active"}}', NULL, NULL, 
  'id,measure,criterion_key,name,description'
FROM directus_roles r WHERE r.name IS NULL; -- Public role has NULL name

-- Note: For safety, we don't give public access to most rating data
