# Directus Collections & Permissions Matrix

## Overview

This document defines the complete Directus schema for the StadtLandKlima structured rating system, including all new collections, field definitions, relationships, and role-based permissions.

---

## 1. New Collections

### 1.1 `rating_criteria_definitions`

Defines the structure and metadata of rating criteria for measures.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | uuid | ✓ (auto) | Primary key |
| `measure_id` | uuid | ✓ | FK → measures |
| `key` | string(64) | ✓ | Unique per measure, snake_case (e.g., `has_climate_action_plan`) |
| `display_name` | string(255) | ✓ | Human-readable name |
| `description` | text | | Detailed description |
| `type` | enum | ✓ | `quantitative`, `categorical`, `logical` |
| `unit` | string(32) | | For quantitative (e.g., `kW`, `%`, `€/capita`) |
| `min_value` | float | | For quantitative validation |
| `max_value` | float | | For quantitative validation |
| `precision` | integer | | Decimal places for quantitative |
| `enum_options` | json | | For categorical: `[{value, label, description}]` |
| `default_value` | json | | Type-appropriate default |
| `validation_rules` | json | | Custom validation rules |
| `how_to_find` | text | | Instructions for finding this information |
| `depends_on` | json | | Array of criterion keys this depends on |
| `excludes` | json | | Array of criterion keys mutually exclusive |
| `sort_order` | integer | ✓ | Display order within measure |
| `status` | enum | ✓ | `draft`, `published`, `archived` |
| `date_created` | datetime | ✓ (auto) | |
| `date_updated` | datetime | (auto) | |
| `user_created` | uuid | ✓ (auto) | FK → directus_users |
| `user_updated` | uuid | (auto) | FK → directus_users |

**Indexes:**
- `UNIQUE (measure_id, key)`
- `INDEX (measure_id, status)`

---

### 1.2 `rating_criteria_values`

Stores actual criterion values for each municipality rating.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | uuid | ✓ (auto) | Primary key |
| `rating_measure_id` | uuid | ✓ | FK → ratings_measures |
| `criterion_definition_id` | uuid | ✓ | FK → rating_criteria_definitions |
| `value_quantitative` | float | | For quantitative type |
| `value_categorical` | string(255) | | For categorical type |
| `value_logical` | boolean | | For logical type |
| `confidence` | enum | ✓ | `verified`, `estimated`, `unknown` |
| `notes` | text | | Optional notes about this value |
| `last_verified_at` | datetime | | When value was last verified |
| `verified_by` | uuid | | FK → directus_users |
| `date_created` | datetime | ✓ (auto) | |
| `date_updated` | datetime | (auto) | |
| `user_created` | uuid | ✓ (auto) | FK → directus_users |
| `user_updated` | uuid | (auto) | FK → directus_users |

**Indexes:**
- `UNIQUE (rating_measure_id, criterion_definition_id)`
- `INDEX (rating_measure_id)`

**Notes:**
- Only one of `value_quantitative`, `value_categorical`, `value_logical` should be set based on criterion type
- Consider using a generated column or trigger to enforce this

---

### 1.3 `rating_sources`

Manages citations and documentary sources.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | uuid | ✓ (auto) | Primary key |
| `title` | string(500) | ✓ | Source title/description |
| `source_type` | enum | ✓ | `url`, `document`, `official_registry`, `personal_communication`, `other` |
| `url` | string(2000) | | Web URL |
| `file` | uuid | | FK → directus_files |
| `author` | string(255) | | Author/organization |
| `publication_date` | date | | When source was published |
| `access_date` | date | ✓ | When source was accessed |
| `expires_at` | date | | When source should be re-verified |
| `notes` | text | | Additional context |
| `is_reusable` | boolean | ✓ | Can be used across multiple ratings (default: true) |
| `date_created` | datetime | ✓ (auto) | |
| `date_updated` | datetime | (auto) | |
| `user_created` | uuid | ✓ (auto) | FK → directus_users |
| `user_updated` | uuid | (auto) | FK → directus_users |

**Indexes:**
- `INDEX (user_created)` - for user's source library
- `INDEX (expires_at)` - for expiration alerts

---

### 1.4 `rating_criteria_sources` (Junction)

Links criterion values to their sources (M:N relationship).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | uuid | ✓ (auto) | Primary key |
| `criteria_value_id` | uuid | ✓ | FK → rating_criteria_values |
| `source_id` | uuid | ✓ | FK → rating_sources |
| `relevance_note` | text | | How this source supports the value |
| `page_reference` | string(100) | | Specific page/section reference |

**Indexes:**
- `UNIQUE (criteria_value_id, source_id)`

---

### 1.5 `rating_resources`

Defines reusable rating objects/concepts.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | uuid | ✓ (auto) | Primary key |
| `catalog_version` | uuid | ✓ | FK → measure_catalog |
| `key` | string(64) | ✓ | Unique per catalog, snake_case |
| `display_name` | string(255) | ✓ | |
| `description` | text | | |
| `resource_type` | enum | ✓ | `document`, `infrastructure`, `policy`, `metric`, `computed` |
| `criteria_schema` | json | | Schema for criteria this resource provides |
| `computation_formula` | json | | For computed resources: `{type, inputs, expression}` |
| `status` | enum | ✓ | `draft`, `published` |
| `date_created` | datetime | ✓ (auto) | |
| `date_updated` | datetime | (auto) | |
| `user_created` | uuid | ✓ (auto) | FK → directus_users |
| `user_updated` | uuid | (auto) | FK → directus_users |

**Indexes:**
- `UNIQUE (catalog_version, key)`

**Example Computed Resource:**
```json
{
  "key": "municipal_wind_power",
  "resource_type": "computed",
  "computation_formula": {
    "type": "sum",
    "inputs": [
      "wind_turbines_in_area.performance",
      "wind_power_participations.performance"
    ],
    "unit": "kW"
  }
}
```

---

### 1.6 `measure_rating_resources` (Junction)

Links measures to required rating resources.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | uuid | ✓ (auto) | Primary key |
| `measure_id` | uuid | ✓ | FK → measures |
| `rating_resource_id` | uuid | ✓ | FK → rating_resources |
| `is_required` | boolean | ✓ | Whether resource is mandatory |
| `usage_note` | text | | How this resource is used for the measure |

---

### 1.7 `decision_trees`

Stores decision tree definitions for rating calculation.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | uuid | ✓ (auto) | Primary key |
| `measure_id` | uuid | ✓ | FK → measures |
| `name` | string(255) | ✓ | Descriptive name |
| `description` | text | | |
| `tree_structure` | json | ✓ | Complete tree definition |
| `version` | integer | ✓ | Auto-incremented per measure |
| `status` | enum | ✓ | `draft`, `active`, `archived` |
| `date_created` | datetime | ✓ (auto) | |
| `date_updated` | datetime | (auto) | |
| `user_created` | uuid | ✓ (auto) | FK → directus_users |
| `user_updated` | uuid | (auto) | FK → directus_users |

**Constraints:**
- Only ONE decision tree per measure can have `status = 'active'`

**Tree Structure JSON Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "rootNodeId": { "type": "string" },
    "nodes": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "type": { "enum": ["decision", "leaf"] },
          "criterionKey": { "type": "string" },
          "question": { "type": "string" },
          "branches": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "condition": { "type": "object" },
                "label": { "type": "string" },
                "targetNodeId": { "type": "string" }
              }
            }
          },
          "ratingFunction": { "type": "object" }
        }
      }
    }
  }
}
```

---

### 1.8 `rating_functions`

Stores rating function configurations (linked to decision tree leaf nodes).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | uuid | ✓ (auto) | Primary key |
| `decision_tree_id` | uuid | ✓ | FK → decision_trees |
| `leaf_node_id` | string(64) | ✓ | Reference to node in tree |
| `function_type` | enum | ✓ | `quantity_map`, `logical_combinations`, `quality_fulfillment`, `direct_mapping` |
| `config` | json | ✓ | Type-specific configuration |
| `description` | text | | Human-readable explanation |

**Config Examples:**

**QuantityMap:**
```json
{
  "function_type": "quantity_map",
  "config": {
    "criterionKey": "wind_power_per_capita",
    "unit": "kW/1000_inhabitants",
    "thresholds": [
      { "min": 0, "max": 50, "rating": "red" },
      { "min": 50, "max": 150, "rating": "orange" },
      { "min": 150, "max": 300, "rating": "yellow" },
      { "min": 300, "max": 500, "rating": "light_green" },
      { "min": 500, "rating": "dark_green" }
    ]
  }
}
```

**LogicalCombinations:**
```json
{
  "function_type": "logical_combinations",
  "config": {
    "criteriaKeys": ["has_heat_protection_plan", "has_early_warning_system", "has_cool_spaces"],
    "combinations": [
      { "values": {"has_heat_protection_plan": true, "has_early_warning_system": true, "has_cool_spaces": true}, "rating": "dark_green" },
      { "values": {"has_heat_protection_plan": true, "has_early_warning_system": true}, "rating": "light_green" },
      { "values": {"has_heat_protection_plan": true}, "rating": "yellow" },
      { "values": {}, "rating": "red" }
    ],
    "invalidCombinations": [
      { "values": {"has_heat_protection_plan": false, "has_early_warning_system": true}, "reason": "Early warning without plan is not sensible" }
    ]
  }
}
```

**QualityFulfillment:**
```json
{
  "function_type": "quality_fulfillment",
  "config": {
    "criteriaKeys": [
      "has_ghg_inventory",
      "includes_scope_3",
      "has_reduction_targets",
      "tracks_progress_annually",
      "is_publicly_available"
    ],
    "thresholds": [
      { "minFulfilled": 5, "rating": "dark_green" },
      { "minFulfilled": 4, "rating": "light_green" },
      { "minFulfilled": 3, "rating": "yellow" },
      { "minFulfilled": 2, "rating": "orange" },
      { "minFulfilled": 0, "rating": "red" }
    ]
  }
}
```

---

### 1.9 `catalog_migrations`

Tracks version migration history and status.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | uuid | ✓ (auto) | Primary key |
| `source_version` | uuid | ✓ | FK → measure_catalog |
| `target_version` | uuid | ✓ | FK → measure_catalog |
| `status` | enum | ✓ | `pending`, `in_progress`, `review_required`, `completed`, `failed` |
| `started_at` | datetime | | |
| `completed_at` | datetime | | |
| `executed_by` | uuid | | FK → directus_users |
| `total_municipalities` | integer | | |
| `migrated_count` | integer | | Successfully auto-migrated |
| `review_required_count` | integer | | Needs human review |
| `error_count` | integer | | Failed migrations |
| `migration_log` | json | | Detailed log of operations |
| `review_items` | json | | Items requiring review |

---

### 1.10 `citation_text_mappings`

Links text fragments to citations (for rich text with inline citations).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | uuid | ✓ (auto) | Primary key |
| `source_collection` | string(64) | ✓ | Collection containing the text (e.g., `ratings_measures`) |
| `source_item_id` | uuid | ✓ | Item ID in source collection |
| `source_field` | string(64) | ✓ | Field name (e.g., `current_progress`) |
| `text_fragment` | text | ✓ | The cited text portion |
| `fragment_start` | integer | ✓ | Character offset start |
| `fragment_end` | integer | ✓ | Character offset end |
| `source_id` | uuid | ✓ | FK → rating_sources |

**Indexes:**
- `INDEX (source_collection, source_item_id, source_field)`

---

## 2. Extended Existing Collections

### 2.1 `measure_catalog` (Extended)

| New Field | Type | Required | Notes |
|-----------|------|----------|-------|
| `state` | enum | ✓ | `draft`, `active`, `archived` (replaces `hidden` + `isCurrentX`) |
| `parent_version` | uuid | | FK → measure_catalog (for version lineage) |
| `activated_at` | datetime | | |
| `activated_by` | uuid | | FK → directus_users |
| `archived_at` | datetime | | |
| `archived_by` | uuid | | FK → directus_users |
| `description` | text | | Version description/changelog |
| `major_changes` | json | | Summary of major changes from parent |

**Migration Note:** 
- `hidden = false` + `isCurrentFrontend = true` → `state = 'active'`
- `hidden = true` → `state = 'draft'`
- Remove `hidden`, `isCurrentFrontend`, `isCurrentBackend` after migration

---

### 2.2 `ratings_measures` (Extended)

| New Field | Type | Required | Notes |
|-----------|------|----------|-------|
| `computed_rating` | enum | | `red`, `orange`, `yellow`, `light_green`, `dark_green` (from decision tree) |
| `final_rating` | enum | | Same enum, computed OR override |
| `manual_override` | enum | | Admin override value |
| `override_reason` | text | | Required if override is set |
| `override_by` | uuid | | FK → directus_users |
| `override_at` | datetime | | |
| `criteria_snapshot` | json | | Frozen criteria state at rating time |
| `decision_path` | json | | Path taken through decision tree |
| `needs_review` | boolean | ✓ | Default: false |
| `review_notes` | text | | Notes for review |
| `review_deadline` | date | | Optional deadline |

**Notes:**
- Keep existing `rating` field for backward compatibility
- `final_rating = COALESCE(manual_override, computed_rating)`
- Existing `rating` should be migrated to `final_rating`

---

### 2.3 `directus_users` (Extended via junction)

| Existing Junction | Notes |
|-------------------|-------|
| `junction_directus_users_localteams` | Already exists, keep as-is |

**New Fields on Junction:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `role_in_team` | enum | ✓ | `member`, `admin` |
| `joined_at` | datetime | ✓ | |
| `invited_by` | uuid | | FK → directus_users |

---

## 3. Relationships Diagram

```
measure_catalog (1) ──────────────────────────< (N) measures
       │                                              │
       │                                              │
       └─────────────< (N) rating_resources           │
                             │                        │
                             │                        │
                             └────< (N:M) ────────────┘
                                measure_rating_resources
                                          
measures (1) ──────────────< (N) rating_criteria_definitions
       │                              │
       │                              │
       │                              └────────────────────────────────┐
       │                                                               │
       └────────────< (N) decision_trees                               │
                           │                                           │
                           │                                           │
                           └────< (N) rating_functions                 │
                                                                       │
ratings_measures (1) ──────────────< (N) rating_criteria_values        │
       │                                    │                          │
       │                                    │ (references)             │
       │                                    └──────────────────────────┘
       │                                    │
       │                                    │
       │                                    └────< (N:M) ────< rating_sources
       │                                         rating_criteria_sources
       │
       └────────< localteams (1) ────< (N:M) ────< directus_users
                      │               junction_directus_users_localteams
                      │
                      └────────< (1) municipalities
```

---

## 4. Role Permissions

### 4.1 Role: `LocalTeamMember`

```yaml
name: LocalTeamMember
icon: person
admin_access: false
app_access: false  # Frontend-only role
permissions:
  # Read own user data
  - collection: directus_users
    action: read
    permissions:
      id: { _eq: $CURRENT_USER }
    fields: [id, first_name, last_name, email, avatar]

  # Read own local teams
  - collection: localteams
    action: read
    permissions:
      id: { _in: $CURRENT_USER.localteams.localteam_id }
    fields: [id, name, municipality_id, municipality_name]

  # Read/write ratings for own teams
  - collection: ratings_measures
    action: read
    permissions:
      localteam_id: { _in: $CURRENT_USER.localteams.localteam_id }
    fields: ["*"]
  
  - collection: ratings_measures
    action: update
    permissions:
      _and:
        - localteam_id: { _in: $CURRENT_USER.localteams.localteam_id }
        - approved: { _eq: false }  # Cannot edit approved ratings
    fields:
      - current_progress
      - source
      - applicable
      - why_not_applicable
      - needs_review
      - review_notes

  # CRUD for criteria values (own team's ratings)
  - collection: rating_criteria_values
    action: create
    permissions:
      rating_measure_id:
        localteam_id: { _in: $CURRENT_USER.localteams.localteam_id }
    fields: ["*"]
  
  - collection: rating_criteria_values
    action: read
    permissions:
      rating_measure_id:
        localteam_id: { _in: $CURRENT_USER.localteams.localteam_id }
    fields: ["*"]
  
  - collection: rating_criteria_values
    action: update
    permissions:
      rating_measure_id:
        localteam_id: { _in: $CURRENT_USER.localteams.localteam_id }
    fields:
      - value_quantitative
      - value_categorical
      - value_logical
      - confidence
      - notes

  # Read criteria definitions (for form rendering)
  - collection: rating_criteria_definitions
    action: read
    permissions:
      status: { _eq: published }
    fields: ["*"]

  # CRUD for sources (own sources)
  - collection: rating_sources
    action: create
    permissions: null
    fields: ["*"]
  
  - collection: rating_sources
    action: read
    permissions:
      _or:
        - user_created: { _eq: $CURRENT_USER }
        - is_reusable: { _eq: true }
    fields: ["*"]
  
  - collection: rating_sources
    action: update
    permissions:
      user_created: { _eq: $CURRENT_USER }
    fields: [title, url, file, author, publication_date, access_date, expires_at, notes]

  # Link sources to criteria
  - collection: rating_criteria_sources
    action: create
    permissions:
      criteria_value_id:
        rating_measure_id:
          localteam_id: { _in: $CURRENT_USER.localteams.localteam_id }
    fields: ["*"]
  
  - collection: rating_criteria_sources
    action: delete
    permissions:
      criteria_value_id:
        rating_measure_id:
          localteam_id: { _in: $CURRENT_USER.localteams.localteam_id }

  # Read published measures and catalog
  - collection: measures
    action: read
    permissions:
      _and:
        - status: { _eq: published }
        - catalog_version: { state: { _neq: archived } }
    fields: ["*"]
  
  - collection: measure_catalog
    action: read
    permissions:
      state: { _neq: archived }
    fields: [id, name, state]

  # Read decision trees (for rating preview)
  - collection: decision_trees
    action: read
    permissions:
      status: { _eq: active }
    fields: ["*"]
```

### 4.2 Role: `LocalTeamAdmin`

```yaml
name: LocalTeamAdmin
icon: supervisor_account
admin_access: false
app_access: false
permissions:
  # Inherits all LocalTeamMember permissions, plus:
  
  # Can approve ratings
  - collection: ratings_measures
    action: update
    permissions:
      localteam_id: { _in: $CURRENT_USER.localteams.localteam_id }
    fields:
      - approved
      - current_progress
      - source
      - applicable
      - why_not_applicable
      - needs_review
      - review_notes

  # Can view all team members
  - collection: junction_directus_users_localteams
    action: read
    permissions:
      localteam_id: { _in: $CURRENT_USER.localteams.localteam_id }
    fields: ["*"]
```

### 4.3 Role: `MeasureEditor`

```yaml
name: MeasureEditor
icon: edit_note
admin_access: false
app_access: true  # Can access Directus for advanced editing
permissions:
  # Full read on all measures/criteria/trees
  - collection: measures
    action: read
    permissions: {}
    fields: ["*"]
  
  - collection: rating_criteria_definitions
    action: read
    permissions: {}
    fields: ["*"]
  
  - collection: decision_trees
    action: read
    permissions: {}
    fields: ["*"]
  
  - collection: rating_functions
    action: read
    permissions: {}
    fields: ["*"]
  
  - collection: rating_resources
    action: read
    permissions: {}
    fields: ["*"]

  # Can edit measures in DRAFT catalogs only
  - collection: measures
    action: create
    permissions:
      catalog_version: { state: { _eq: draft } }
    fields: ["*"]
  
  - collection: measures
    action: update
    permissions:
      catalog_version: { state: { _eq: draft } }
    fields: ["*"]

  # Can manage criteria definitions in draft catalogs
  - collection: rating_criteria_definitions
    action: create
    permissions:
      measure_id:
        catalog_version: { state: { _eq: draft } }
    fields: ["*"]
  
  - collection: rating_criteria_definitions
    action: update
    permissions:
      measure_id:
        catalog_version: { state: { _eq: draft } }
    fields: ["*"]

  # Can manage decision trees in draft catalogs
  - collection: decision_trees
    action: create
    permissions:
      measure_id:
        catalog_version: { state: { _eq: draft } }
    fields: ["*"]
  
  - collection: decision_trees
    action: update
    permissions:
      measure_id:
        catalog_version: { state: { _eq: draft } }
    fields: ["*"]

  # Can create draft catalog versions
  - collection: measure_catalog
    action: read
    permissions: {}
    fields: ["*"]
  
  - collection: measure_catalog
    action: create
    permissions: {}
    validation:
      state: { _eq: draft }  # Can only create drafts
    fields: [name, description, parent_version, state]
  
  - collection: measure_catalog
    action: update
    permissions:
      state: { _eq: draft }  # Can only edit drafts
    fields: [name, description]

  # CANNOT:
  # - Change catalog state (activate/archive)
  # - Run migrations
  # - Edit measures in active/archived catalogs
```

### 4.4 Role: `Administrator`

```yaml
name: Administrator
icon: admin_panel_settings
admin_access: true
app_access: true
permissions:
  # Full access to everything
  # Plus exclusive capabilities:
  
  # Catalog state changes
  - collection: measure_catalog
    action: update
    permissions: {}
    fields: ["*"]  # Including state, activated_at, archived_at, etc.
  
  # Migration execution
  - collection: catalog_migrations
    action: create
    permissions: {}
    fields: ["*"]
  
  - collection: catalog_migrations
    action: update
    permissions: {}
    fields: ["*"]
  
  # Rating overrides
  - collection: ratings_measures
    action: update
    permissions: {}
    fields: ["*"]  # Including manual_override, override_reason
```

---

## 5. Hooks & Flows

### 5.1 `hook-compute-rating`

**Trigger:** After create/update on `rating_criteria_values`

**Logic:**
1. Load related `rating_measure_id`
2. Load all criteria values for that rating
3. Load active decision tree for the measure
4. Execute rating engine
5. Update `ratings_measures.computed_rating`
6. Update `ratings_measures.final_rating` if no override

### 5.2 `hook-catalog-state-change`

**Trigger:** Before update on `measure_catalog.state`

**Validation:**
- `draft → active`: Only if no other active catalog exists
- `active → archived`: Only if Administrator role
- `draft → archived`: Allowed
- `archived → *`: Not allowed

### 5.3 `flow-migration-execute`

**Trigger:** Manual trigger (Administrator)

**Steps:**
1. Create `catalog_migrations` record
2. For each municipality:
   - Compare criteria definitions between versions
   - Auto-migrate unchanged criteria
   - Flag changed criteria for review
3. Update migration record with results
4. Notify administrators of items requiring review

---

## 6. Indexes & Performance

### Critical Indexes

```sql
-- Fast rating lookups
CREATE INDEX idx_ratings_localteam_measure 
ON ratings_measures(localteam_id, measure_id);

-- Criteria value lookups
CREATE INDEX idx_criteria_values_rating 
ON rating_criteria_values(rating_measure_id);

-- Decision tree by measure
CREATE INDEX idx_decision_trees_measure_status 
ON decision_trees(measure_id, status);

-- Catalog version queries
CREATE INDEX idx_measures_catalog 
ON measures(catalog_version, status);

-- Source expiration monitoring
CREATE INDEX idx_sources_expires 
ON rating_sources(expires_at) 
WHERE expires_at IS NOT NULL;
```

---

## 7. Migration Strategy

### Phase 1: Schema Creation
1. Create all new collections
2. Add new fields to existing collections
3. Keep existing fields (`rating`, `choices`, etc.)

### Phase 2: Data Migration
1. Migrate existing `choices_rating` → `decision_trees` (manual, measure by measure)
2. Create `rating_criteria_definitions` from existing measure descriptions
3. Back-populate `rating_criteria_values` from existing ratings where possible

### Phase 3: Switchover
1. Enable hooks for automatic rating computation
2. Migrate `hidden`/`isCurrentX` → `state` field
3. Remove deprecated fields
4. Update frontend to use new rating system

---

*Document version: 1.0*  
*Schema version: 2026.1*
