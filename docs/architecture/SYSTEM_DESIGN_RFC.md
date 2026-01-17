# StadtLandKlima System Design RFC

## Executive Summary

This RFC proposes a comprehensive architectural overhaul for StadtLandKlima, introducing:
1. **Frontend Authentication** via Directus user directory
2. **Role-based Frontend Administration** with contextual editing
3. **Structured Measure Ratings** with typed criteria and decision trees
4. **Measure Catalog Versioning** with migration workflows

---

## 1. Current Architecture Analysis

### 1.1 Existing Stack
- **Frontend**: Nuxt 3 with Vue 3 Composition API
- **Backend**: Directus 10 (headless CMS)
- **Database**: PostgreSQL
- **Authentication**: Static token for frontend→Directus communication (no user auth)

### 1.2 Current Data Model
```
municipalities (1) ←→ (1) localteams
localteams (N) ←→ (M) directus_users (via junction_directus_users_localteams)
measures (N) ←→ (1) measure_catalog
ratings_measures (N) ←→ (1) localteam_id + (1) measure_id
municipality_scores (N) ←→ (1) municipality + (1) catalog_version
```

### 1.3 Current Roles (in Directus)
- `EditorLocalteam` - Can edit articles, limited measure access
- `Maßnahmenteam` - Read-only access to measures/ratings
- `AdminLokalteam` - Local team administration
- `frontend` - Technical role for public API access

### 1.4 Key Pain Points
1. No user sessions in frontend → all admin work in Directus backend
2. No structured rating criteria → ratings are simple integers (0-4)
3. No formal version migration → manual catalog version switches
4. No audit trail for rating decisions

---

## 2. Proposed Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (Nuxt 3)                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   Public    │  │  Auth Layer │  │ Admin Panel │  │  Measure   │ │
│  │    Views    │  │  (Pinia)    │  │ (Contextual)│  │   Editor   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ Directus SDK (REST + Auth)
┌──────────────────────────────▼──────────────────────────────────────┐
│                        DIRECTUS BACKEND                              │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   Users &   │  │  Extended   │  │  Criteria   │  │  Version   │ │
│  │    Roles    │  │  Ratings    │  │   Engine    │  │  Migrator  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                         PostgreSQL                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Authentication Flow

```
┌─────────┐     ┌─────────┐     ┌─────────────┐     ┌──────────┐
│  User   │────▶│ Frontend│────▶│  Directus   │────▶│ Database │
│         │     │  Login  │     │  /auth/login│     │          │
└─────────┘     └────┬────┘     └──────┬──────┘     └──────────┘
                     │                 │
                     │  access_token   │
                     │  refresh_token  │
                     │◀────────────────┘
                     │
              ┌──────▼──────┐
              │ Pinia Store │
              │ + Cookies   │
              └─────────────┘
```

---

## 3. Data Model Design

### 3.1 New Collections

#### 3.1.1 `rating_criteria_definitions`
Defines the structure of criteria for each measure.

```yaml
collection: rating_criteria_definitions
fields:
  - id: uuid (PK)
  - measure_id: uuid (FK → measures)
  - key: string (e.g., "has_climate_action_plan")
  - display_name: string
  - description: text
  - type: enum ["quantitative", "categorical", "logical"]
  - unit: string (nullable, for quantitative)
  - enum_options: json (nullable, for categorical)
  - default_value: json (nullable)
  - validation_rules: json
  - how_to_find: text
  - sort_order: integer
  - status: enum ["draft", "published", "archived"]
```

#### 3.1.2 `rating_criteria_values`
Stores actual criterion values per municipality rating.

```yaml
collection: rating_criteria_values
fields:
  - id: uuid (PK)
  - rating_measure_id: uuid (FK → ratings_measures)
  - criterion_definition_id: uuid (FK → rating_criteria_definitions)
  - value: json  # Typed based on criterion type
  - confidence: enum ["verified", "estimated", "unknown"]
  - last_verified_at: datetime
  - verified_by: uuid (FK → directus_users)
```

#### 3.1.3 `rating_sources`
Manages citations and sources for criteria.

```yaml
collection: rating_sources
fields:
  - id: uuid (PK)
  - title: string
  - url: string (nullable)
  - file: uuid (FK → directus_files, nullable)
  - author: string (nullable)
  - publication_date: date (nullable)
  - access_date: date
  - notes: text (nullable)
  - expires_at: date (nullable)
  - created_by: uuid (FK → directus_users)
```

#### 3.1.4 `rating_criteria_sources` (Junction)
Links criteria values to their sources.

```yaml
collection: rating_criteria_sources
fields:
  - id: uuid (PK)
  - criteria_value_id: uuid (FK → rating_criteria_values)
  - source_id: uuid (FK → rating_sources)
  - relevance_note: text (nullable)
```

#### 3.1.5 `rating_resources`
Reusable rating objects (e.g., "Climate Action Plan", "Wind Turbines").

```yaml
collection: rating_resources
fields:
  - id: uuid (PK)
  - key: string (unique per catalog)
  - display_name: string
  - description: text
  - catalog_version: uuid (FK → measure_catalog)
  - resource_type: enum ["document", "infrastructure", "policy", "computed"]
  - computation_formula: json (nullable, for computed resources)
  - status: enum ["draft", "published"]
```

#### 3.1.6 `measure_rating_resource_links` (Junction)
Links measures to their required rating resources.

```yaml
collection: measure_rating_resource_links
fields:
  - id: uuid (PK)
  - measure_id: uuid (FK → measures)
  - rating_resource_id: uuid (FK → rating_resources)
  - is_required: boolean
```

#### 3.1.7 `decision_trees`
Stores decision tree structures for rating functions.

```yaml
collection: decision_trees
fields:
  - id: uuid (PK)
  - measure_id: uuid (FK → measures)
  - tree_structure: json  # Node-based tree definition
  - version: integer
  - status: enum ["draft", "active", "archived"]
  - created_at: datetime
  - created_by: uuid (FK → directus_users)
```

#### 3.1.8 `rating_functions`
Defines how criteria map to final ratings.

```yaml
collection: rating_functions
fields:
  - id: uuid (PK)
  - decision_tree_id: uuid (FK → decision_trees)
  - node_id: string  # Reference to leaf node in tree
  - function_type: enum ["quantity_map", "logical_combinations", "quality_fulfillment"]
  - function_config: json  # Type-specific configuration
```

#### 3.1.9 `catalog_migrations`
Tracks catalog version migrations.

```yaml
collection: catalog_migrations
fields:
  - id: uuid (PK)
  - source_version: uuid (FK → measure_catalog)
  - target_version: uuid (FK → measure_catalog)
  - status: enum ["pending", "in_progress", "completed", "failed"]
  - migration_log: json
  - affected_municipalities: json (array of IDs)
  - requires_review: json (criteria that changed)
  - started_at: datetime
  - completed_at: datetime (nullable)
  - executed_by: uuid (FK → directus_users)
```

### 3.2 Extended Existing Collections

#### `measure_catalog` (Extended)
```yaml
# Additional fields:
  - state: enum ["draft", "active", "archived"]  # Replaces hidden + isCurrentX
  - activated_at: datetime (nullable)
  - activated_by: uuid (FK → directus_users, nullable)
  - archived_at: datetime (nullable)
  - archived_by: uuid (FK → directus_users, nullable)
  - parent_version: uuid (FK → measure_catalog, nullable)  # For version lineage
```

#### `ratings_measures` (Extended)
```yaml
# Additional fields:
  - computed_rating: integer  # Calculated from criteria via decision tree
  - manual_override: integer (nullable)  # Admin override
  - override_reason: text (nullable)
  - criteria_snapshot: json  # Frozen criteria state at rating time
  - needs_review: boolean (default: false)
  - review_notes: text (nullable)
```

---

## 4. Role & Permission Design

### 4.1 Role Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                        Administrator                             │
│  • Full system access                                           │
│  • Catalog version activation/migration                         │
│  • User management                                              │
│  • Direct Directus backend access                               │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                      MeasureEditor                               │
│  • Edit measures in draft catalogs                              │
│  • Create/edit criteria definitions                             │
│  • Create/edit decision trees                                   │
│  • Duplicate measures across catalog versions                   │
│  • Cannot activate catalogs                                     │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                    LocalTeamAdmin                                │
│  • All LocalTeamMember permissions                              │
│  • View team progress dashboards                                │
│  • Approve/reject ratings                                       │
│  • Manage team members (invite/remove)                          │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                    LocalTeamMember                               │
│  • Rate assigned municipalities                                 │
│  • Add/edit criteria values                                     │
│  • Add sources and citations                                    │
│  • View own team's progress                                     │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Permission Matrix

| Resource | Public | LocalTeamMember | LocalTeamAdmin | MeasureEditor | Administrator |
|----------|--------|-----------------|----------------|---------------|---------------|
| measures (read) | ✓ (published) | ✓ (published) | ✓ (published) | ✓ (all) | ✓ (all) |
| measures (write) | ✗ | ✗ | ✗ | ✓ (draft catalogs) | ✓ |
| ratings_measures (read) | ✓ (approved) | ✓ (own team) | ✓ (own team) | ✓ | ✓ |
| ratings_measures (write) | ✗ | ✓ (own team) | ✓ (own team) | ✗ | ✓ |
| rating_criteria_* (read) | ✗ | ✓ (own team) | ✓ (own team) | ✓ | ✓ |
| rating_criteria_* (write) | ✗ | ✓ (own team) | ✓ (own team) | ✓ (definitions) | ✓ |
| measure_catalog (read) | ✓ (active) | ✓ | ✓ | ✓ | ✓ |
| measure_catalog (activate) | ✗ | ✗ | ✗ | ✗ | ✓ |
| decision_trees (read) | ✗ | ✓ | ✓ | ✓ | ✓ |
| decision_trees (write) | ✗ | ✗ | ✗ | ✓ | ✓ |
| catalog_migrations | ✗ | ✗ | ✗ | ✗ | ✓ |

### 4.3 Row-Level Security

```javascript
// LocalTeamMember: ratings_measures filter
{
  "_and": [
    { "localteam_id": { "_in": "$CURRENT_USER.localteams.localteam_id" } }
  ]
}

// MeasureEditor: measures filter
{
  "_or": [
    { "status": { "_eq": "published" } },
    { "catalog_version": { "state": { "_eq": "draft" } } }
  ]
}
```

---

## 5. Authentication Implementation

### 5.1 Frontend Auth Store (Pinia)

```typescript
// ~/stores/auth.ts
interface AuthState {
  user: DirectusUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  roles: UserRole[];
  permissions: ComputedPermissions;
  localTeams: LocalTeam[];
}

interface UserRole {
  id: string;
  name: 'LocalTeamMember' | 'LocalTeamAdmin' | 'MeasureEditor' | 'Administrator';
}

interface ComputedPermissions {
  canRateMunicipality: (municipalityId: string) => boolean;
  canEditMeasures: boolean;
  canManageCatalogVersions: boolean;
  canAccessDirectus: boolean;
}
```

### 5.2 Auth Flow Implementation

```typescript
// ~/composables/useAuth.ts
export function useAuth() {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();
  
  const login = async (email: string, password: string) => {
    const directus = createDirectus(config.public.clientDirectusUrl)
      .with(authentication())
      .with(rest());
    
    const result = await directus.login(email, password);
    
    // Fetch user with role and localteam relations
    const user = await directus.request(
      readMe({
        fields: ['*', { role: ['id', 'name'] }, { localteams: ['*', { localteam_id: ['*'] }] }]
      })
    );
    
    authStore.setAuth(result.access_token, result.refresh_token, user);
    
    // Store tokens in httpOnly cookies (via server middleware)
    await $fetch('/api/auth/set-tokens', {
      method: 'POST',
      body: { accessToken: result.access_token, refreshToken: result.refresh_token }
    });
  };
  
  const logout = async () => {
    authStore.clearAuth();
    await $fetch('/api/auth/clear-tokens', { method: 'POST' });
  };
  
  const refreshAuth = async () => {
    // Token refresh logic with Directus refresh endpoint
  };
  
  return { login, logout, refreshAuth };
}
```

### 5.3 Authenticated Directus Client

```typescript
// ~/plugins/directus.client.ts (modified)
export default defineNuxtPlugin(async () => {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();
  
  // Create base client for public access
  const publicDirectus = createDirectus(config.public.clientDirectusUrl)
    .with(rest())
    .with(staticToken(config.public.directusToken));
  
  // Create authenticated client when user is logged in
  const getAuthenticatedClient = () => {
    if (!authStore.accessToken) return publicDirectus;
    
    return createDirectus(config.public.clientDirectusUrl)
      .with(rest())
      .with(authentication())
      .with(staticToken(authStore.accessToken));
  };
  
  return {
    provide: {
      directus: publicDirectus,
      authDirectus: getAuthenticatedClient,
    }
  };
});
```

---

## 6. UI/UX Design

### 6.1 Header Modifications

```vue
<!-- ~/components/TheHeaderDesktop.vue (modifications) -->
<template>
  <header>
    <!-- ... existing header content ... -->
    
    <div class="auth-section">
      <template v-if="!isAuthenticated">
        <button @click="openLoginModal" class="btn-login">
          {{ $t('auth.login') }}
        </button>
      </template>
      
      <template v-else>
        <div class="user-menu">
          <span>{{ user.first_name }}</span>
          <dropdown-menu>
            <template v-if="canAccessDirectus">
              <a :href="directusUrl" target="_blank" class="menu-item">
                {{ $t('auth.directus_backend') }} ↗
              </a>
            </template>
            <button @click="logout" class="menu-item">
              {{ $t('auth.logout') }}
            </button>
          </dropdown-menu>
        </div>
      </template>
    </div>
  </header>
</template>
```

### 6.2 Contextual Editing Pattern

```vue
<!-- ~/pages/municipalities/[slug].vue (with contextual editing) -->
<template>
  <article>
    <detail-municipality
      :municipality-score="municipalityScore"
      :sorted-ratings="sortedRatings"
      :edit-mode="canEditMunicipality"
    />
    
    <!-- Inline rating editor appears when authenticated with permissions -->
    <template v-if="canEditMunicipality">
      <rating-editor-panel
        v-for="rating in sortedRatings"
        :key="rating.id"
        :rating="rating"
        :criteria-definitions="getCriteriaDefinitions(rating.measure_id)"
        @save="handleSaveRating"
      />
    </template>
  </article>
</template>

<script setup>
const { canRateMunicipality } = usePermissions();
const canEditMunicipality = computed(() => 
  canRateMunicipality(municipalityScore.value?.municipality?.id)
);
</script>
```

### 6.3 Admin Routes Structure

```
/admin/
├── dashboard/                    # Overview for all authenticated users
├── municipalities/
│   └── [slug]/
│       ├── progress/             # Rating progress tracking
│       └── ratings/              # Unrated/partial measures list
├── measures/
│   └── [sector]/
│       ├── index.vue             # Measure list (MeasureEditor+)
│       └── [measureId]/
│           ├── edit.vue          # Measure editor
│           ├── criteria.vue      # Criteria definitions
│           └── decision-tree.vue # Visual tree editor
└── catalog/
    ├── versions/                 # Version management (Admin only)
    └── migrations/               # Migration workflows (Admin only)
```

### 6.4 Rating Editor Component

```vue
<!-- ~/components/admin/RatingEditorPanel.vue -->
<template>
  <div class="rating-editor-panel">
    <h3>{{ measure.name }}</h3>
    
    <!-- Criteria-based rating UI -->
    <div v-for="criterion in criteriaDefinitions" :key="criterion.id" class="criterion-input">
      <label>{{ criterion.display_name }}</label>
      <p class="help-text">{{ criterion.how_to_find }}</p>
      
      <!-- Type-specific input -->
      <component
        :is="getCriterionInputComponent(criterion.type)"
        v-model="criteriaValues[criterion.key]"
        :criterion="criterion"
        @add-source="openSourceModal(criterion.id)"
      />
      
      <!-- Source citations -->
      <source-citations
        :sources="getSources(criterion.id)"
        @remove="removeSource"
      />
    </div>
    
    <!-- Computed rating display -->
    <div class="computed-rating">
      <h4>{{ $t('rating.computed_result') }}</h4>
      <rating-badge :level="computedRating" />
      
      <!-- Decision tree visualization -->
      <decision-tree-viewer
        :tree="decisionTree"
        :highlighted-path="activePath"
      />
    </div>
    
    <!-- Override option (Admin only) -->
    <template v-if="canOverride">
      <toggle v-model="useOverride">
        {{ $t('rating.manual_override') }}
      </toggle>
      <template v-if="useOverride">
        <rating-selector v-model="manualOverride" />
        <textarea v-model="overrideReason" :placeholder="$t('rating.override_reason')" />
      </template>
    </template>
    
    <button @click="save" :disabled="!isValid">
      {{ $t('common.save') }}
    </button>
  </div>
</template>
```

---

## 7. Structured Rating System

### 7.1 Criterion Types

```typescript
// ~/types/criteria.ts

interface BaseCriterion {
  id: string;
  key: string;
  displayName: string;
  description: string;
  howToFind: string;
}

interface QuantitativeCriterion extends BaseCriterion {
  type: 'quantitative';
  unit: string;
  min?: number;
  max?: number;
  precision?: number;
}

interface CategoricalCriterion extends BaseCriterion {
  type: 'categorical';
  options: Array<{
    value: string;
    label: string;
    description?: string;
  }>;
}

interface LogicalCriterion extends BaseCriterion {
  type: 'logical';
  trueLabel?: string;
  falseLabel?: string;
}

type Criterion = QuantitativeCriterion | CategoricalCriterion | LogicalCriterion;

interface CriterionValue {
  criterionId: string;
  value: number | string | boolean;
  confidence: 'verified' | 'estimated' | 'unknown';
  lastVerifiedAt?: Date;
  verifiedBy?: string;
  sources: Source[];
}
```

### 7.2 Decision Tree Structure

```typescript
// ~/types/decisionTree.ts

interface DecisionNode {
  id: string;
  type: 'decision' | 'leaf';
  criterionKey?: string;  // For decision nodes
  condition?: DecisionCondition;
  children?: Record<string, DecisionNode>;  // value → child node
  ratingFunction?: RatingFunction;  // For leaf nodes
}

interface DecisionCondition {
  type: 'equals' | 'greater_than' | 'less_than' | 'in_range' | 'in_set';
  value?: any;
  min?: number;
  max?: number;
  set?: any[];
}

type RatingFunction = 
  | QuantityMapFunction 
  | LogicalCombinationsFunction 
  | QualityFulfillmentFunction;

interface QuantityMapFunction {
  type: 'quantity_map';
  criterionKey: string;
  thresholds: Array<{
    min: number;
    max?: number;
    rating: RatingLevel;
  }>;
}

interface LogicalCombinationsFunction {
  type: 'logical_combinations';
  criteriaKeys: string[];
  validCombinations: Array<{
    values: Record<string, boolean>;
    rating: RatingLevel;
  }>;
  invalidCombinations?: Array<{
    values: Record<string, boolean>;
    reason: string;
  }>;
}

interface QualityFulfillmentFunction {
  type: 'quality_fulfillment';
  criteriaKeys: string[];
  thresholds: Array<{
    minFulfilled: number;
    rating: RatingLevel;
  }>;
}

type RatingLevel = 'red' | 'orange' | 'yellow' | 'light_green' | 'dark_green';
```

### 7.3 Rating Engine

```typescript
// ~/shared/ratingEngine.ts

export class RatingEngine {
  evaluateDecisionTree(
    tree: DecisionNode,
    criteriaValues: Record<string, CriterionValue>
  ): { rating: RatingLevel; path: string[]; explanation: string[] } {
    const path: string[] = [];
    const explanation: string[] = [];
    
    let currentNode = tree;
    
    while (currentNode.type === 'decision') {
      path.push(currentNode.id);
      
      const criterionValue = criteriaValues[currentNode.criterionKey!];
      const evaluatedValue = criterionValue?.value;
      
      explanation.push(
        `${currentNode.criterionKey}: ${evaluatedValue}`
      );
      
      // Find matching child based on condition
      const nextNodeKey = this.evaluateCondition(
        currentNode.condition!,
        evaluatedValue
      );
      
      currentNode = currentNode.children![nextNodeKey];
    }
    
    // At leaf node - apply rating function
    path.push(currentNode.id);
    const rating = this.applyRatingFunction(
      currentNode.ratingFunction!,
      criteriaValues
    );
    
    return { rating, path, explanation };
  }
  
  private evaluateCondition(condition: DecisionCondition, value: any): string {
    // Condition evaluation logic
  }
  
  private applyRatingFunction(
    func: RatingFunction,
    values: Record<string, CriterionValue>
  ): RatingLevel {
    switch (func.type) {
      case 'quantity_map':
        return this.applyQuantityMap(func, values);
      case 'logical_combinations':
        return this.applyLogicalCombinations(func, values);
      case 'quality_fulfillment':
        return this.applyQualityFulfillment(func, values);
    }
  }
  
  private applyQuantityMap(
    func: QuantityMapFunction,
    values: Record<string, CriterionValue>
  ): RatingLevel {
    const value = values[func.criterionKey]?.value as number;
    
    for (const threshold of func.thresholds) {
      if (value >= threshold.min && (!threshold.max || value < threshold.max)) {
        return threshold.rating;
      }
    }
    
    return 'red'; // Default
  }
  
  // ... other rating function implementations
}
```

---

## 8. Catalog Versioning & Migration

### 8.1 Version States

```
     ┌─────────┐
     │  Draft  │ ◄─── New version created (copy from active)
     └────┬────┘
          │ activate() [Administrator only]
          ▼
     ┌─────────┐
     │ Active  │ ◄─── Only ONE active version at a time
     └────┬────┘
          │ archive() [Administrator only]
          ▼
     ┌──────────┐
     │ Archived │ ◄─── Read-only, for historical reference
     └──────────┘
```

### 8.2 Version Duplication Workflow

```typescript
// MeasureEditor creates new draft version
async function duplicateCatalogVersion(sourceCatalogId: string): Promise<string> {
  const newCatalog = await directus.request(
    createItem('measure_catalog', {
      name: `Draft ${new Date().toISOString().split('T')[0]}`,
      state: 'draft',
      parent_version: sourceCatalogId,
    })
  );
  
  // Duplicate all measures
  const sourceMeasures = await directus.request(
    readItems('measures', {
      filter: { catalog_version: { _eq: sourceCatalogId } }
    })
  );
  
  for (const measure of sourceMeasures) {
    const { id, ...measureData } = measure;
    await directus.request(
      createItem('measures', {
        ...measureData,
        catalog_version: newCatalog.id,
        status: 'draft',
      })
    );
  }
  
  // Duplicate criteria definitions, decision trees, etc.
  // ...
  
  return newCatalog.id;
}
```

### 8.3 Migration Logic

```typescript
// ~/server/services/catalogMigration.ts

interface MigrationResult {
  success: boolean;
  migratedRatings: number;
  requiresReview: MigrationReviewItem[];
  errors: MigrationError[];
}

interface MigrationReviewItem {
  municipalityId: string;
  measureId: string;
  reason: string;
  changedCriteria: string[];
  previousRating: RatingLevel;
  suggestedRating: RatingLevel | null;
}

export class CatalogMigrationService {
  async migrateMunicipality(
    municipalityId: string,
    sourceVersionId: string,
    targetVersionId: string
  ): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      migratedRatings: 0,
      requiresReview: [],
      errors: [],
    };
    
    // Get measure mappings between versions
    const measureMappings = await this.getMeasureMappings(
      sourceVersionId,
      targetVersionId
    );
    
    // Get existing ratings
    const existingRatings = await this.getRatings(
      municipalityId,
      sourceVersionId
    );
    
    for (const [sourceMeasureId, targetMeasureId] of measureMappings) {
      const sourceRating = existingRatings.find(
        r => r.measure_id === sourceMeasureId
      );
      
      if (!sourceRating) continue;
      
      // Check for criterion changes
      const criteriaChanges = await this.detectCriteriaChanges(
        sourceMeasureId,
        targetMeasureId
      );
      
      if (criteriaChanges.hasBreakingChanges) {
        // Requires human review
        result.requiresReview.push({
          municipalityId,
          measureId: targetMeasureId,
          reason: 'Criteria definitions changed',
          changedCriteria: criteriaChanges.changedKeys,
          previousRating: sourceRating.rating,
          suggestedRating: null,
        });
      } else {
        // Safe to auto-migrate
        await this.createMigratedRating(
          sourceRating,
          targetMeasureId,
          targetVersionId
        );
        result.migratedRatings++;
      }
    }
    
    return result;
  }
  
  private async detectCriteriaChanges(
    sourceMeasureId: string,
    targetMeasureId: string
  ): Promise<{ hasBreakingChanges: boolean; changedKeys: string[] }> {
    const sourceCriteria = await this.getCriteriaDefinitions(sourceMeasureId);
    const targetCriteria = await this.getCriteriaDefinitions(targetMeasureId);
    
    const changedKeys: string[] = [];
    
    for (const targetCriterion of targetCriteria) {
      const sourceCriterion = sourceCriteria.find(
        c => c.key === targetCriterion.key
      );
      
      if (!sourceCriterion) {
        // New criterion added
        changedKeys.push(targetCriterion.key);
      } else if (
        sourceCriterion.type !== targetCriterion.type ||
        JSON.stringify(sourceCriterion.enum_options) !== 
          JSON.stringify(targetCriterion.enum_options)
      ) {
        // Breaking change in criterion definition
        changedKeys.push(targetCriterion.key);
      }
    }
    
    return {
      hasBreakingChanges: changedKeys.length > 0,
      changedKeys,
    };
  }
}
```

---

## 9. Risk Assessment & Trade-offs

### 9.1 High-Risk Areas

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Token security** | Auth bypass | Use httpOnly cookies, short-lived access tokens, server-side refresh |
| **Permission bypass** | Data exposure | Enforce permissions at Directus API level, not just frontend |
| **Rating data loss during migration** | Historical inaccuracy | Always keep source ratings, create copies not moves |
| **Decision tree complexity** | Unmaintainable rating logic | Visual tree editor, validation rules, unit tests for trees |
| **Concurrent editing** | Data corruption | Optimistic locking via `date_updated` checks |

### 9.2 Technical Debt Considerations

1. **Existing `choices_rating` field**: Currently stores rating logic as JSON in measures. Plan gradual migration to `decision_trees` collection.

2. **Current rating integer (0-4)**: Maps to new enum. Maintain backward compatibility during transition.

3. **Static frontend token**: Continue using for public reads, add authenticated client for writes.

### 9.3 Trade-offs Made

| Decision | Benefit | Cost |
|----------|---------|------|
| Keep Directus as auth provider | Single user directory, no auth duplication | Dependent on Directus SDK behavior |
| JSON storage for decision trees | Flexible, easy to version | No referential integrity, harder to query |
| Contextual editing (no separate admin pages for ratings) | Better UX, no page duplication | More complex component logic |
| Separate `criteria_values` from `ratings_measures` | Granular tracking, reusability | More joins, higher complexity |

---

## 10. Implementation Phases

### Phase 1: Authentication Foundation (2-3 weeks)
- [ ] Implement Pinia auth store
- [ ] Add login/logout UI in header
- [ ] Create authenticated Directus client
- [ ] Add server-side token management
- [ ] Create permission composables

### Phase 2: Basic Frontend Administration (2-3 weeks)
- [ ] Add contextual edit mode to municipality pages
- [ ] Create admin dashboard route
- [ ] Implement progress tracking views
- [ ] Add unrated measures overview

### Phase 3: Structured Rating System (4-6 weeks)
- [ ] Create new Directus collections (criteria, sources, etc.)
- [ ] Build criterion input components (quantity, categorical, logical)
- [ ] Implement source/citation management
- [ ] Create rating editor panel

### Phase 4: Decision Trees & Rating Functions (3-4 weeks)
- [ ] Design decision tree JSON schema
- [ ] Build rating engine
- [ ] Create visual tree editor
- [ ] Implement all rating function types

### Phase 5: Catalog Versioning (3-4 weeks)
- [ ] Extend `measure_catalog` with state machine
- [ ] Build version duplication workflow
- [ ] Implement migration service
- [ ] Create migration UI for administrators

### Phase 6: Measure Editor UI (2-3 weeks)
- [ ] Build `/measures/[sector]` overview
- [ ] Create measure editing interface
- [ ] Add criteria definition editor
- [ ] Implement decision tree visual editor

---

## 11. Open Questions

1. **Historical ratings**: Should we maintain rating history per criterion, or only snapshots at rating time?

2. **Multi-language support**: How to handle criterion translations (display_name, description)?

3. **Computed rating resources**: Should computations run server-side (Directus hook) or client-side?

4. **Approval workflow**: Should LocalTeamAdmin approval be required before ratings become public?

5. **Offline support**: Any requirements for offline rating entry?

---

## 12. Next Steps

Recommended immediate actions:

1. **Create GitHub Epics** for each phase
2. **Design Directus collections matrix** with field definitions
3. **Build auth proof-of-concept** as the foundational layer
4. **Define JSON schema** for decision trees with examples
5. **Create test suite** for rating engine with example measures

---

*Document version: 1.0*  
*Last updated: January 2026*  
*Author: System Architect*
