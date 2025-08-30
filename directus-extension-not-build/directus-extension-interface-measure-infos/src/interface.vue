<template>
  <div class="measure-preview">
    <!-- Link to Frontend -->
    <div v-if="measureData.slug && measureData.sector" class="measure-link">
      <a
        :href="`https://stadt-land-klima.de/measures/sectors/${measureData.sector}#measure-${measureData.slug}`"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ $t('directus.fields.view_measure_on_frontend') }}
      </a>
    </div>
    
    <div v-if="!measureId" class="v-notice info">
      <v-icon name="info" />
      <div class="content">
        <div class="title">{{ $t('no_measure_selected') }}</div>
      </div>
    </div>
    
    <div v-else-if="loading" class="loading-container">
      <v-progress-circular indeterminate />
      <span class="loading-text">{{ $t('loading_measure_data') }}</span>
    </div>
    
    <div v-else-if="error" class="v-notice danger">
      <v-icon name="error" />
      <div class="content">
        <div class="title">{{ $t('error') }}</div>
        <div class="text">{{ error }}</div>
      </div>
    </div>
    
    <div v-else-if="measureData && Object.keys(measureData).length > 0" class="measure-content">
      <div v-for="fieldKey in fieldsToDisplay" :key="fieldKey" class="field-preview">
        <div class="field-header">
          <v-icon name="info" small />
          <span class="field-label">{{ getFieldLabel(fieldKey) }}</span>
        </div>
        <div v-if="measureData[fieldKey]" class="field-content" v-html="measureData[fieldKey]"></div>
        <div v-else class="field-content empty">{{ $t('no_content_available') }}</div>
      </div>

    </div>
    
    <div v-else class="v-notice warning">
      <v-icon name="warning" />
      <div class="content">
        <div class="title">{{ $t('no_measure_data_available') }}</div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MeasurePreview',
  inject: ["api"],
  props: {
    value: {
      default: null
    },
    field: {
      type: String,
      required: true
    },
    collection: {
      type: String,
      required: true
    },
    primaryKey: {
      type: [String, Number],
      default: null
    },
    measure_field: {
      type: String,
      default: 'measure_id'
    },
    fields_to_display: {
      type: Array,
      default: () => ['description_about', 'description_evaluation_criteria', 'description_verification']
    }
  },
  data() {
    return {
      measureId: null,
      measureData: {},
      loading: false,
      error: null,
      fieldsToDisplay: [],
      currentItem: null
    };
  },
  computed: {
    measureField() {
      return this.measure_field || 'measure_id';
    }
  },
  watch: {
    primaryKey: { immediate: true, handler() { this.ensureMeasureLoaded(); } },
    value(newVal) { /* if your setup uses `value`, re-run */ this.ensureMeasureLoaded(); },
    options: { deep: true, handler() { this.ensureMeasureLoaded(); } }
  },
  mounted() {
    this.fieldsToDisplay = this.fields_to_display;
    this.ensureMeasureLoaded();
  },
  methods: {
    // call at mounted() and/or whenever primaryKey/value/options change
    async ensureMeasureLoaded() {
      // measure_field option name (the relation column on the ratings_measures item)
      const measureField = (this.options && this.options.measure_field) || this.measure_field || 'measure_id';

      // If we're attached *to* the measure_id field itself, value may already be the measure PK.
      // If attached to a separate field, primaryKey is needed to fetch the record and read measure_id.
      const pk = this.primaryKey ?? null; // Directus prop
      const boundValue = this.value ?? null; // some setups also provide `value` prop

      // CASE A: we have a proper item id (edit mode)
      if (pk && pk !== '+') {
        // fetch parent item only if we need to (i.e. we are not attached to the measure_id directly)
        // if our interface is attached to the measure field itself we could skip this fetch and use boundValue
        if (this.field === measureField) {
          // interface attached to the measure_id column -> value or boundValue is the measure id
          const measureId = boundValue || this.value || null;
          if (measureId) {
            await this.fetchMeasure(measureId);
          } else {
            // nothing selected on this item
            this.measureData = {};
            this.measureId = null;
          }
        } else {
          // interface attached to another field (test1234). Need to read the parent item to find the measure id.
          try {
            const resp = await this.api.get(`/items/${this.collection}/${pk}`);
            const item = resp?.data?.data || {};
            const measureId = item[measureField] ?? null;
            if (measureId) {
              this.measureId = measureId;
              await this.fetchMeasure(measureId);
            } else {
              this.measureData = {};
              this.measureId = null;
            }
          } catch (err) {
            // If you hit a 403 here, make sure the role/session has read permission for the collection
            console.error('[MeasurePreview] Error fetching parent item:', err);
            this.measureData = {};
            this.measureId = null;
          }
        }
        return;
      }

      // CASE B: create/new-item mode or no primaryKey — try to use value if interface is on measure_id
      if (this.field === measureField) {
        const measureId = boundValue || null;
        if (measureId) {
          this.measureId = measureId;
          await this.fetchMeasure(measureId);
        } else {
          this.measureData = {};
          this.measureId = null;
        }
        return;
      }

      // CASE C: nothing to do (create mode and interface not on measure field)
      this.measureData = {};
      this.measureId = null;
    },

    // your existing fetchMeasure method - unchanged
    async fetchMeasure(id) {
      if (!id || !this.api) return;
      this.loading = true;
      this.error = null;
      try {
        const response = await this.api.get(`/items/measures/${id}`, {
          params: { fields: [...this.fieldsToDisplay, 'sector', 'slug'].join(',') }
        });
        this.measureData = response?.data?.data || {};
      } catch (err) {
        console.error('[MeasurePreview] Error fetching measure:', err);
        this.error = err?.message || 'Failed to fetch measure';
        this.measureData = {};
      } finally {
        this.loading = false;
      }
    },

    getFieldLabel(fieldKey) {
      const key = `ratings_measures.fields.${fieldKey}`;
      const translated = this.$t(key);
      if (translated && translated !== key) return translated;

      // fallback: make it pretty
      return fieldKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  },
};
</script>

<style scoped>
.measure-preview {
  --v-notice-padding: 12px 16px;
}

.measure-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field-preview {
  background-color: var(--theme--background-subdued);
  border: 1px solid var(--theme--border-color-subdued);
  border-radius: var(--theme--border-radius);
  padding: 12px 16px;
  transition: border-color var(--fast) var(--transition);
}

.field-preview:hover {
  border-color: var(--theme--border-color);
}

.field-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: var(--theme--foreground-subdued);
}

.field-header .v-icon {
  --v-icon-color: var(--theme--primary);
}

.field-label {
  font-weight: 600;
  font-size: 16px;
  color: var(--theme--foreground);
}

.field-content {
  color: var(--theme--foreground);
  font-size: 15px;
  line-height: 1.6;
}

.field-content.empty {
  color: var(--theme--foreground-subdued);
  font-style: italic;
}

.field-content :deep(p) {
  margin: 0 0 8px 0;
}

.field-content :deep(p:last-child) {
  margin-bottom: 0;
}

.field-content :deep(ul),
.field-content :deep(ol) {
  margin: 8px 0;
  padding-left: 20px;
}

.field-content :deep(li) {
  margin-bottom: 4px;
}

.loading-container {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  color: var(--theme--foreground-subdued);
}

.loading-text {
  font-size: 14px;
}

.v-notice {
  --v-notice-margin: 0;
}

.measure-link {
  margin-top: 16px;
}

.measure-link a {
  color: var(--theme--primary);
  text-decoration: underline;
  font-weight: 500;
}
</style>
