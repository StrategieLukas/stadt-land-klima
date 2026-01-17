# Measure Rating Examples & Decision Tree Specifications

This document provides concrete examples of how the structured rating system works for specific measures, with complete decision tree definitions and rating function configurations.

---

## Rating Level Reference

| Level | Key | Color | Numeric | Description |
|-------|-----|-------|---------|-------------|
| 1 | `dark_green` | #2D7D46 | 1.0 | Vorbildlich (Exemplary) |
| 2 | `light_green` | #8BC34A | 0.75 | Gut (Good) |
| 3 | `yellow` | #FFEB3B | 0.5 | Mittelmäßig (Moderate) |
| 4 | `orange` | #FF9800 | 0.25 | Mangelhaft (Deficient) |
| 5 | `red` | #F44336 | 0.0 | Nicht vorhanden (Absent) |

---

## EN_01: Kommunaler Klimaschutzplan (Municipal Climate Action Plan)

### Criteria Definitions

```yaml
criteria:
  - key: has_climate_action_plan
    display_name: "Klimaschutzkonzept vorhanden"
    type: logical
    how_to_find: "Auf der Website der Kommune nach 'Klimaschutzkonzept', 'Klimaschutzplan' oder 'Integriertes Klimaschutzkonzept' suchen. Auch im Ratsinformationssystem nachschauen."
    
  - key: plan_year
    display_name: "Jahr der Erstellung/letzten Aktualisierung"
    type: quantitative
    unit: "year"
    min_value: 2000
    max_value: 2030
    how_to_find: "Im Dokument selbst oder in der Ratsbeschluss-Vorlage nachsehen."
    depends_on: [has_climate_action_plan]
    
  - key: has_ghg_inventory
    display_name: "Enthält THG-Bilanzierung"
    type: logical
    description: "Das Konzept enthält eine vollständige Treibhausgasbilanz der Kommune."
    depends_on: [has_climate_action_plan]
    
  - key: has_reduction_targets
    display_name: "Enthält verbindliche Reduktionsziele"
    type: logical
    depends_on: [has_climate_action_plan]
    
  - key: target_year
    display_name: "Zieljahr für Klimaneutralität"
    type: quantitative
    unit: "year"
    min_value: 2025
    max_value: 2100
    how_to_find: "Im Klimaschutzkonzept nach 'Klimaneutralität', 'Netto-Null' oder 'CO2-neutral' suchen."
    depends_on: [has_reduction_targets]
    
  - key: has_implementation_measures
    display_name: "Konkrete Umsetzungsmaßnahmen definiert"
    type: logical
    depends_on: [has_climate_action_plan]
    
  - key: has_monitoring
    display_name: "Monitoring/Fortschrittskontrolle vorgesehen"
    type: logical
    depends_on: [has_climate_action_plan]
    
  - key: is_publicly_available
    display_name: "Öffentlich zugänglich"
    type: logical
    depends_on: [has_climate_action_plan]
```

### Decision Tree

```json
{
  "rootNodeId": "root",
  "nodes": {
    "root": {
      "id": "root",
      "type": "decision",
      "criterionKey": "has_climate_action_plan",
      "question": "Existiert ein Klimaschutzkonzept?",
      "branches": [
        {
          "condition": { "type": "equals", "value": false },
          "label": "Nein",
          "targetNodeId": "no_plan"
        },
        {
          "condition": { "type": "equals", "value": true },
          "label": "Ja",
          "targetNodeId": "check_age"
        }
      ]
    },
    "no_plan": {
      "id": "no_plan",
      "type": "leaf",
      "ratingFunction": {
        "type": "direct_mapping",
        "rating": "red"
      }
    },
    "check_age": {
      "id": "check_age",
      "type": "decision",
      "criterionKey": "plan_year",
      "question": "Wie aktuell ist das Konzept?",
      "branches": [
        {
          "condition": { "type": "less_than", "value": 2015 },
          "label": "Vor 2015 (veraltet)",
          "targetNodeId": "outdated_plan"
        },
        {
          "condition": { "type": "in_range", "min": 2015, "max": 2019 },
          "label": "2015-2019",
          "targetNodeId": "evaluate_quality_older"
        },
        {
          "condition": { "type": "greater_than", "value": 2019 },
          "label": "2020 oder neuer",
          "targetNodeId": "evaluate_quality_recent"
        }
      ]
    },
    "outdated_plan": {
      "id": "outdated_plan",
      "type": "leaf",
      "ratingFunction": {
        "type": "direct_mapping",
        "rating": "orange"
      }
    },
    "evaluate_quality_older": {
      "id": "evaluate_quality_older",
      "type": "leaf",
      "ratingFunction": {
        "type": "quality_fulfillment",
        "config": {
          "criteriaKeys": [
            "has_ghg_inventory",
            "has_reduction_targets",
            "has_implementation_measures",
            "has_monitoring",
            "is_publicly_available"
          ],
          "thresholds": [
            { "minFulfilled": 5, "rating": "light_green" },
            { "minFulfilled": 3, "rating": "yellow" },
            { "minFulfilled": 1, "rating": "orange" },
            { "minFulfilled": 0, "rating": "orange" }
          ]
        }
      }
    },
    "evaluate_quality_recent": {
      "id": "evaluate_quality_recent",
      "type": "leaf",
      "ratingFunction": {
        "type": "quality_fulfillment",
        "config": {
          "criteriaKeys": [
            "has_ghg_inventory",
            "has_reduction_targets",
            "has_implementation_measures",
            "has_monitoring",
            "is_publicly_available"
          ],
          "thresholds": [
            { "minFulfilled": 5, "rating": "dark_green" },
            { "minFulfilled": 4, "rating": "light_green" },
            { "minFulfilled": 3, "rating": "yellow" },
            { "minFulfilled": 1, "rating": "orange" },
            { "minFulfilled": 0, "rating": "orange" }
          ]
        }
      }
    }
  }
}
```

---

## EN_02: Klimaneutralitätsziel (Climate Neutrality Target)

### Criteria Definitions

```yaml
criteria:
  - key: has_neutrality_target
    display_name: "Klimaneutralitätsziel beschlossen"
    type: logical
    how_to_find: "Ratsbeschlüsse nach 'Klimaneutralität', 'klimaneutral' oder 'Netto-Null-Emissionen' durchsuchen."
    
  - key: target_year
    display_name: "Zieljahr"
    type: quantitative
    unit: "year"
    min_value: 2025
    max_value: 2100
    depends_on: [has_neutrality_target]
    
  - key: scope_coverage
    display_name: "Geltungsbereich"
    type: categorical
    enum_options:
      - value: "administration_only"
        label: "Nur Kommunalverwaltung"
      - value: "municipality_partial"
        label: "Gesamtkommune (teilweise Sektoren)"
      - value: "municipality_full"
        label: "Gesamtkommune (alle Sektoren)"
    depends_on: [has_neutrality_target]
    
  - key: is_binding
    display_name: "Rechtlich verbindlich"
    type: logical
    description: "In Satzung oder verbindlichem Beschluss verankert"
    depends_on: [has_neutrality_target]
```

### Decision Tree

```json
{
  "rootNodeId": "root",
  "nodes": {
    "root": {
      "id": "root",
      "type": "decision",
      "criterionKey": "has_neutrality_target",
      "question": "Wurde ein Klimaneutralitätsziel beschlossen?",
      "branches": [
        { "condition": { "type": "equals", "value": false }, "label": "Nein", "targetNodeId": "no_target" },
        { "condition": { "type": "equals", "value": true }, "label": "Ja", "targetNodeId": "check_year" }
      ]
    },
    "no_target": {
      "id": "no_target",
      "type": "leaf",
      "ratingFunction": { "type": "direct_mapping", "rating": "red" }
    },
    "check_year": {
      "id": "check_year",
      "type": "decision",
      "criterionKey": "target_year",
      "question": "Welches Zieljahr wurde festgelegt?",
      "branches": [
        { "condition": { "type": "less_than_or_equal", "value": 2035 }, "label": "≤2035", "targetNodeId": "check_scope_ambitious" },
        { "condition": { "type": "in_range", "min": 2036, "max": 2040 }, "label": "2036-2040", "targetNodeId": "check_scope_moderate" },
        { "condition": { "type": "greater_than", "value": 2040 }, "label": ">2040", "targetNodeId": "late_target" }
      ]
    },
    "late_target": {
      "id": "late_target",
      "type": "leaf",
      "ratingFunction": { "type": "direct_mapping", "rating": "orange" }
    },
    "check_scope_ambitious": {
      "id": "check_scope_ambitious",
      "type": "decision",
      "criterionKey": "scope_coverage",
      "question": "Welchen Bereich deckt das Ziel ab?",
      "branches": [
        { "condition": { "type": "equals", "value": "administration_only" }, "label": "Nur Verwaltung", "targetNodeId": "rating_yellow" },
        { "condition": { "type": "equals", "value": "municipality_partial" }, "label": "Kommune (teilweise)", "targetNodeId": "rating_light_green" },
        { "condition": { "type": "equals", "value": "municipality_full" }, "label": "Kommune (vollständig)", "targetNodeId": "check_binding" }
      ]
    },
    "check_scope_moderate": {
      "id": "check_scope_moderate",
      "type": "decision",
      "criterionKey": "scope_coverage",
      "branches": [
        { "condition": { "type": "equals", "value": "administration_only" }, "targetNodeId": "rating_orange" },
        { "condition": { "type": "equals", "value": "municipality_partial" }, "targetNodeId": "rating_yellow" },
        { "condition": { "type": "equals", "value": "municipality_full" }, "targetNodeId": "rating_light_green" }
      ]
    },
    "check_binding": {
      "id": "check_binding",
      "type": "decision",
      "criterionKey": "is_binding",
      "question": "Ist das Ziel rechtlich verbindlich?",
      "branches": [
        { "condition": { "type": "equals", "value": false }, "targetNodeId": "rating_light_green" },
        { "condition": { "type": "equals", "value": true }, "targetNodeId": "rating_dark_green" }
      ]
    },
    "rating_dark_green": { "id": "rating_dark_green", "type": "leaf", "ratingFunction": { "type": "direct_mapping", "rating": "dark_green" } },
    "rating_light_green": { "id": "rating_light_green", "type": "leaf", "ratingFunction": { "type": "direct_mapping", "rating": "light_green" } },
    "rating_yellow": { "id": "rating_yellow", "type": "leaf", "ratingFunction": { "type": "direct_mapping", "rating": "yellow" } },
    "rating_orange": { "id": "rating_orange", "type": "leaf", "ratingFunction": { "type": "direct_mapping", "rating": "orange" } }
  }
}
```

---

## EN_05: Kommunale Windenergie (Municipal Wind Power)

### Rating Resources

This measure uses a **computed rating resource**:

```yaml
rating_resources:
  - key: wind_turbines_in_municipal_area
    display_name: "Windkraftanlagen auf Gemeindegebiet"
    resource_type: infrastructure
    criteria_schema:
      - key: count
        type: quantitative
        unit: "Anlagen"
      - key: total_capacity
        type: quantitative
        unit: "kW"
        
  - key: wind_power_participations
    display_name: "Beteiligungen an externen Windparks"
    resource_type: infrastructure
    criteria_schema:
      - key: participation_capacity
        type: quantitative
        unit: "kW"
        description: "Anteil der Kommune an der Gesamtkapazität"
        
  - key: municipal_wind_power_total
    display_name: "Gesamte kommunale Windkraft"
    resource_type: computed
    computation_formula:
      type: sum
      inputs:
        - wind_turbines_in_municipal_area.total_capacity
        - wind_power_participations.participation_capacity
      unit: "kW"
```

### Criteria Definitions

```yaml
criteria:
  - key: has_wind_power
    display_name: "Windkraft vorhanden"
    type: logical
    
  - key: total_capacity_kw
    display_name: "Gesamtkapazität"
    type: quantitative
    unit: "kW"
    depends_on: [has_wind_power]
    
  - key: capacity_per_1000_inhabitants
    display_name: "Kapazität pro 1000 Einwohner"
    type: quantitative
    unit: "kW/1000 EW"
    description: "Berechnet aus Gesamtkapazität und Einwohnerzahl"
    
  - key: wind_area_designated
    display_name: "Windvorranggebiete ausgewiesen"
    type: logical
    
  - key: expansion_planned
    display_name: "Ausbau konkret geplant"
    type: logical
```

### Decision Tree

```json
{
  "rootNodeId": "root",
  "nodes": {
    "root": {
      "id": "root",
      "type": "decision",
      "criterionKey": "has_wind_power",
      "question": "Gibt es Windkraftanlagen mit kommunaler Beteiligung?",
      "branches": [
        { "condition": { "type": "equals", "value": false }, "label": "Nein", "targetNodeId": "no_wind_check_plans" },
        { "condition": { "type": "equals", "value": true }, "label": "Ja", "targetNodeId": "evaluate_capacity" }
      ]
    },
    "no_wind_check_plans": {
      "id": "no_wind_check_plans",
      "type": "decision",
      "criterionKey": "wind_area_designated",
      "question": "Sind Windvorranggebiete ausgewiesen?",
      "branches": [
        { "condition": { "type": "equals", "value": false }, "label": "Nein", "targetNodeId": "rating_red" },
        { "condition": { "type": "equals", "value": true }, "label": "Ja", "targetNodeId": "check_expansion" }
      ]
    },
    "check_expansion": {
      "id": "check_expansion",
      "type": "decision",
      "criterionKey": "expansion_planned",
      "branches": [
        { "condition": { "type": "equals", "value": false }, "targetNodeId": "rating_orange" },
        { "condition": { "type": "equals", "value": true }, "targetNodeId": "rating_yellow" }
      ]
    },
    "evaluate_capacity": {
      "id": "evaluate_capacity",
      "type": "leaf",
      "ratingFunction": {
        "type": "quantity_map",
        "config": {
          "criterionKey": "capacity_per_1000_inhabitants",
          "unit": "kW/1000 EW",
          "thresholds": [
            { "min": 0, "max": 100, "rating": "orange" },
            { "min": 100, "max": 300, "rating": "yellow" },
            { "min": 300, "max": 600, "rating": "light_green" },
            { "min": 600, "rating": "dark_green" }
          ]
        }
      }
    },
    "rating_red": { "id": "rating_red", "type": "leaf", "ratingFunction": { "type": "direct_mapping", "rating": "red" } },
    "rating_orange": { "id": "rating_orange", "type": "leaf", "ratingFunction": { "type": "direct_mapping", "rating": "orange" } },
    "rating_yellow": { "id": "rating_yellow", "type": "leaf", "ratingFunction": { "type": "direct_mapping", "rating": "yellow" } }
  }
}
```

---

## EN_06: Hitzeschutzkonzept (Heat Protection Concept)

### Criteria Definitions

```yaml
criteria:
  - key: has_heat_protection_plan
    display_name: "Hitzeschutzkonzept vorhanden"
    type: logical
    
  - key: has_early_warning_system
    display_name: "Hitzefrühwarnsystem aktiv"
    type: logical
    description: "System zur Warnung der Bevölkerung bei Hitzewellen"
    
  - key: has_cooling_spaces
    display_name: "Öffentliche Kühlräume/kühle Orte ausgewiesen"
    type: logical
    
  - key: has_vulnerable_groups_outreach
    display_name: "Aktive Ansprache vulnerabler Gruppen"
    type: logical
    description: "z.B. Besuchsdienste für Ältere, Info an Pflegeeinrichtungen"
    
  - key: has_urban_greening_measures
    display_name: "Städtebauliche Begrünungsmaßnahmen umgesetzt"
    type: logical
    
  - key: plan_quality
    display_name: "Qualität des Konzepts"
    type: categorical
    enum_options:
      - value: "basic"
        label: "Grundlegend (nur Bestandsaufnahme)"
      - value: "standard"
        label: "Standard (mit Maßnahmenkatalog)"
      - value: "comprehensive"
        label: "Umfassend (mit Monitoring & Evaluation)"
```

### Decision Tree with Logical Combinations

```json
{
  "rootNodeId": "root",
  "nodes": {
    "root": {
      "id": "root",
      "type": "decision",
      "criterionKey": "has_heat_protection_plan",
      "question": "Existiert ein Hitzeschutzkonzept?",
      "branches": [
        { "condition": { "type": "equals", "value": false }, "label": "Nein", "targetNodeId": "no_plan_check_measures" },
        { "condition": { "type": "equals", "value": true }, "label": "Ja", "targetNodeId": "evaluate_plan_quality" }
      ]
    },
    "no_plan_check_measures": {
      "id": "no_plan_check_measures",
      "type": "leaf",
      "ratingFunction": {
        "type": "logical_combinations",
        "config": {
          "criteriaKeys": ["has_early_warning_system", "has_cooling_spaces", "has_vulnerable_groups_outreach"],
          "combinations": [
            {
              "values": { "has_early_warning_system": true, "has_cooling_spaces": true, "has_vulnerable_groups_outreach": true },
              "rating": "yellow",
              "note": "Gute Einzelmaßnahmen, aber kein übergreifendes Konzept"
            },
            {
              "values": { "has_early_warning_system": true, "has_cooling_spaces": true },
              "rating": "orange"
            },
            {
              "values": { "has_early_warning_system": true },
              "rating": "orange"
            },
            {
              "values": {},
              "rating": "red"
            }
          ]
        }
      }
    },
    "evaluate_plan_quality": {
      "id": "evaluate_plan_quality",
      "type": "decision",
      "criterionKey": "plan_quality",
      "question": "Wie umfassend ist das Konzept?",
      "branches": [
        { "condition": { "type": "equals", "value": "basic" }, "targetNodeId": "basic_plan_evaluate" },
        { "condition": { "type": "equals", "value": "standard" }, "targetNodeId": "standard_plan_evaluate" },
        { "condition": { "type": "equals", "value": "comprehensive" }, "targetNodeId": "comprehensive_plan_evaluate" }
      ]
    },
    "basic_plan_evaluate": {
      "id": "basic_plan_evaluate",
      "type": "leaf",
      "ratingFunction": {
        "type": "quality_fulfillment",
        "config": {
          "criteriaKeys": ["has_early_warning_system", "has_cooling_spaces", "has_vulnerable_groups_outreach", "has_urban_greening_measures"],
          "thresholds": [
            { "minFulfilled": 4, "rating": "yellow" },
            { "minFulfilled": 2, "rating": "orange" },
            { "minFulfilled": 0, "rating": "orange" }
          ]
        }
      }
    },
    "standard_plan_evaluate": {
      "id": "standard_plan_evaluate",
      "type": "leaf",
      "ratingFunction": {
        "type": "quality_fulfillment",
        "config": {
          "criteriaKeys": ["has_early_warning_system", "has_cooling_spaces", "has_vulnerable_groups_outreach", "has_urban_greening_measures"],
          "thresholds": [
            { "minFulfilled": 4, "rating": "light_green" },
            { "minFulfilled": 3, "rating": "yellow" },
            { "minFulfilled": 1, "rating": "orange" }
          ]
        }
      }
    },
    "comprehensive_plan_evaluate": {
      "id": "comprehensive_plan_evaluate",
      "type": "leaf",
      "ratingFunction": {
        "type": "quality_fulfillment",
        "config": {
          "criteriaKeys": ["has_early_warning_system", "has_cooling_spaces", "has_vulnerable_groups_outreach", "has_urban_greening_measures"],
          "thresholds": [
            { "minFulfilled": 4, "rating": "dark_green" },
            { "minFulfilled": 3, "rating": "light_green" },
            { "minFulfilled": 2, "rating": "yellow" },
            { "minFulfilled": 0, "rating": "orange" }
          ]
        }
      }
    }
  }
}
```

---

## EN_07: Klimaschutzmanagement (Climate Protection Management)

### Criteria Definitions

```yaml
criteria:
  - key: has_climate_manager
    display_name: "Klimaschutzmanager*in vorhanden"
    type: logical
    
  - key: manager_fte
    display_name: "Stellenumfang"
    type: quantitative
    unit: "VZÄ"
    min_value: 0
    max_value: 10
    precision: 1
    depends_on: [has_climate_manager]
    
  - key: fte_per_10000_inhabitants
    display_name: "VZÄ pro 10.000 Einwohner"
    type: quantitative
    unit: "VZÄ/10.000 EW"
    precision: 2
    
  - key: position_permanence
    display_name: "Stellenart"
    type: categorical
    enum_options:
      - value: "project_funded"
        label: "Projektfinanziert/befristet"
      - value: "permanent"
        label: "Dauerstelle"
    depends_on: [has_climate_manager]
    
  - key: has_dedicated_budget
    display_name: "Eigenes Budget für Klimaschutzmaßnahmen"
    type: logical
    depends_on: [has_climate_manager]
    
  - key: reports_to_leadership
    display_name: "Direkter Zugang zur Verwaltungsleitung"
    type: logical
    depends_on: [has_climate_manager]
```

### Decision Tree

```json
{
  "rootNodeId": "root",
  "nodes": {
    "root": {
      "id": "root",
      "type": "decision",
      "criterionKey": "has_climate_manager",
      "question": "Gibt es Klimaschutzmanagement-Personal?",
      "branches": [
        { "condition": { "type": "equals", "value": false }, "label": "Nein", "targetNodeId": "rating_red" },
        { "condition": { "type": "equals", "value": true }, "label": "Ja", "targetNodeId": "check_staffing_level" }
      ]
    },
    "check_staffing_level": {
      "id": "check_staffing_level",
      "type": "decision",
      "criterionKey": "fte_per_10000_inhabitants",
      "question": "Wie ist die Personalausstattung relativ zur Gemeindegröße?",
      "branches": [
        { "condition": { "type": "less_than", "value": 0.1 }, "label": "<0.1 VZÄ/10k EW", "targetNodeId": "minimal_staffing" },
        { "condition": { "type": "in_range", "min": 0.1, "max": 0.3 }, "label": "0.1-0.3 VZÄ/10k EW", "targetNodeId": "moderate_staffing" },
        { "condition": { "type": "greater_than", "value": 0.3 }, "label": ">0.3 VZÄ/10k EW", "targetNodeId": "good_staffing" }
      ]
    },
    "minimal_staffing": {
      "id": "minimal_staffing",
      "type": "leaf",
      "ratingFunction": {
        "type": "quality_fulfillment",
        "config": {
          "criteriaKeys": ["position_permanence_is_permanent", "has_dedicated_budget", "reports_to_leadership"],
          "thresholds": [
            { "minFulfilled": 3, "rating": "yellow" },
            { "minFulfilled": 1, "rating": "orange" },
            { "minFulfilled": 0, "rating": "orange" }
          ]
        }
      }
    },
    "moderate_staffing": {
      "id": "moderate_staffing",
      "type": "leaf",
      "ratingFunction": {
        "type": "quality_fulfillment",
        "config": {
          "criteriaKeys": ["position_permanence_is_permanent", "has_dedicated_budget", "reports_to_leadership"],
          "thresholds": [
            { "minFulfilled": 3, "rating": "light_green" },
            { "minFulfilled": 2, "rating": "yellow" },
            { "minFulfilled": 0, "rating": "orange" }
          ]
        }
      }
    },
    "good_staffing": {
      "id": "good_staffing",
      "type": "leaf",
      "ratingFunction": {
        "type": "quality_fulfillment",
        "config": {
          "criteriaKeys": ["position_permanence_is_permanent", "has_dedicated_budget", "reports_to_leadership"],
          "thresholds": [
            { "minFulfilled": 3, "rating": "dark_green" },
            { "minFulfilled": 2, "rating": "light_green" },
            { "minFulfilled": 1, "rating": "yellow" },
            { "minFulfilled": 0, "rating": "orange" }
          ]
        }
      }
    },
    "rating_red": { "id": "rating_red", "type": "leaf", "ratingFunction": { "type": "direct_mapping", "rating": "red" } }
  }
}
```

---

## Rating Engine Implementation

### TypeScript Implementation

```typescript
// ~/shared/ratingEngine.ts

import type {
  DecisionTree,
  DecisionNode,
  CriterionValue,
  RatingLevel,
  RatingResult,
  RatingFunction,
  QuantityMapConfig,
  LogicalCombinationsConfig,
  QualityFulfillmentConfig
} from '~/types/rating';

export class RatingEngine {
  /**
   * Evaluates a decision tree with the given criteria values
   */
  evaluate(
    tree: DecisionTree,
    criteriaValues: Record<string, CriterionValue>
  ): RatingResult {
    const path: string[] = [];
    const explanation: string[] = [];
    
    let currentNode = tree.nodes[tree.rootNodeId];
    
    while (currentNode.type === 'decision') {
      path.push(currentNode.id);
      
      const criterion = criteriaValues[currentNode.criterionKey!];
      const value = this.getCriterionValue(criterion);
      
      explanation.push(`${currentNode.question || currentNode.criterionKey}: ${this.formatValue(value)}`);
      
      // Find matching branch
      const matchingBranch = currentNode.branches?.find(branch => 
        this.evaluateCondition(branch.condition, value)
      );
      
      if (!matchingBranch) {
        throw new Error(`No matching branch for value ${value} in node ${currentNode.id}`);
      }
      
      currentNode = tree.nodes[matchingBranch.targetNodeId];
    }
    
    // At leaf node - apply rating function
    path.push(currentNode.id);
    
    const rating = this.applyRatingFunction(
      currentNode.ratingFunction!,
      criteriaValues
    );
    
    return {
      rating,
      path,
      explanation,
      computedAt: new Date().toISOString()
    };
  }
  
  private getCriterionValue(criterion?: CriterionValue): any {
    if (!criterion) return undefined;
    
    if (criterion.value_quantitative !== null && criterion.value_quantitative !== undefined) {
      return criterion.value_quantitative;
    }
    if (criterion.value_categorical !== null && criterion.value_categorical !== undefined) {
      return criterion.value_categorical;
    }
    if (criterion.value_logical !== null && criterion.value_logical !== undefined) {
      return criterion.value_logical;
    }
    
    return undefined;
  }
  
  private evaluateCondition(condition: any, value: any): boolean {
    switch (condition.type) {
      case 'equals':
        return value === condition.value;
        
      case 'not_equals':
        return value !== condition.value;
        
      case 'greater_than':
        return typeof value === 'number' && value > condition.value;
        
      case 'greater_than_or_equal':
        return typeof value === 'number' && value >= condition.value;
        
      case 'less_than':
        return typeof value === 'number' && value < condition.value;
        
      case 'less_than_or_equal':
        return typeof value === 'number' && value <= condition.value;
        
      case 'in_range':
        return typeof value === 'number' && 
               value >= condition.min && 
               (condition.max === undefined || value < condition.max);
        
      case 'in_set':
        return condition.set.includes(value);
        
      default:
        return false;
    }
  }
  
  private applyRatingFunction(
    func: RatingFunction,
    values: Record<string, CriterionValue>
  ): RatingLevel {
    switch (func.type) {
      case 'direct_mapping':
        return func.rating;
        
      case 'quantity_map':
        return this.applyQuantityMap(func.config, values);
        
      case 'logical_combinations':
        return this.applyLogicalCombinations(func.config, values);
        
      case 'quality_fulfillment':
        return this.applyQualityFulfillment(func.config, values);
        
      default:
        throw new Error(`Unknown rating function type: ${(func as any).type}`);
    }
  }
  
  private applyQuantityMap(
    config: QuantityMapConfig,
    values: Record<string, CriterionValue>
  ): RatingLevel {
    const criterion = values[config.criterionKey];
    const value = this.getCriterionValue(criterion) as number;
    
    if (typeof value !== 'number') {
      return 'red'; // Default for missing/invalid values
    }
    
    // Thresholds should be sorted by min value descending for proper matching
    const sortedThresholds = [...config.thresholds].sort((a, b) => b.min - a.min);
    
    for (const threshold of sortedThresholds) {
      if (value >= threshold.min) {
        return threshold.rating;
      }
    }
    
    return 'red';
  }
  
  private applyLogicalCombinations(
    config: LogicalCombinationsConfig,
    values: Record<string, CriterionValue>
  ): RatingLevel {
    // Check for invalid combinations first
    if (config.invalidCombinations) {
      for (const invalid of config.invalidCombinations) {
        if (this.matchesCombination(invalid.values, values)) {
          throw new Error(`Invalid combination detected: ${invalid.reason}`);
        }
      }
    }
    
    // Find matching combination (first match wins, so order matters)
    for (const combination of config.combinations) {
      if (this.matchesCombination(combination.values, values)) {
        return combination.rating;
      }
    }
    
    return 'red'; // Default
  }
  
  private matchesCombination(
    pattern: Record<string, boolean>,
    values: Record<string, CriterionValue>
  ): boolean {
    for (const [key, expectedValue] of Object.entries(pattern)) {
      const actualValue = this.getCriterionValue(values[key]);
      if (actualValue !== expectedValue) {
        return false;
      }
    }
    return true;
  }
  
  private applyQualityFulfillment(
    config: QualityFulfillmentConfig,
    values: Record<string, CriterionValue>
  ): RatingLevel {
    let fulfilledCount = 0;
    
    for (const key of config.criteriaKeys) {
      const value = this.getCriterionValue(values[key]);
      if (value === true) {
        fulfilledCount++;
      }
    }
    
    // Thresholds should be sorted by minFulfilled descending
    const sortedThresholds = [...config.thresholds].sort(
      (a, b) => b.minFulfilled - a.minFulfilled
    );
    
    for (const threshold of sortedThresholds) {
      if (fulfilledCount >= threshold.minFulfilled) {
        return threshold.rating;
      }
    }
    
    return 'red';
  }
  
  private formatValue(value: any): string {
    if (typeof value === 'boolean') {
      return value ? 'Ja' : 'Nein';
    }
    return String(value);
  }
}
```

---

## Criteria Relationships

### Dependency Graph for EN_01

```
has_climate_action_plan
├── plan_year
├── has_ghg_inventory
├── has_reduction_targets
│   └── target_year
├── has_implementation_measures
├── has_monitoring
└── is_publicly_available
```

### Mutual Exclusions Example

```yaml
# EN_06 Heat Protection - these combinations don't make sense
mutual_exclusions:
  - criteria: [has_heat_protection_plan, plan_quality]
    rule: "plan_quality requires has_heat_protection_plan"
    invalid_combination:
      has_heat_protection_plan: false
      plan_quality: any
```

---

## Version Migration Compatibility

When migrating between catalog versions, criteria are compared:

### Safe to Auto-Migrate
- Criterion key unchanged
- Criterion type unchanged
- For categorical: enum options are superset
- For quantitative: unit unchanged

### Requires Human Review
- New criterion added
- Criterion type changed
- For categorical: enum option removed or renamed
- For quantitative: unit changed
- Threshold values in rating function changed significantly

### Example Migration Report

```json
{
  "measure_id": "EN_01",
  "source_version": "2025.1",
  "target_version": "2026.1",
  "status": "requires_review",
  "changes": [
    {
      "type": "criterion_added",
      "key": "has_sector_targets",
      "impact": "Municipalities need to provide new data"
    },
    {
      "type": "threshold_changed",
      "function": "evaluate_quality_recent",
      "old": { "minFulfilled": 4, "rating": "light_green" },
      "new": { "minFulfilled": 5, "rating": "light_green" },
      "impact": "Some municipalities may receive lower rating"
    }
  ],
  "affected_municipalities": 127,
  "auto_migrated": 0,
  "needs_review": 127
}
```

---

*Document version: 1.0*
