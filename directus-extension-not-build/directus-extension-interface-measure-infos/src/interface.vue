<template>
  <div class="measure-preview">
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
import useDirectusToken from "./use-directus-token";

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
    primaryKey: {
      immediate: true,
      handler(newKey) {
        if (newKey) {
          this.fetchCurrentItem();
        }
      }
    }
  },
  mounted() {
    this.fieldsToDisplay = this.fields_to_display;
    
    if (this.primaryKey) {
      this.fetchCurrentItem();
    }
  },
  methods: {
    async fetchCurrentItem() {
      if (!this.primaryKey || !this.api) return;
      
      try {
        const response = await this.api.get(`/items/${this.collection}/${this.primaryKey}`);
        this.currentItem = response.data.data;
        
        const measureId = this.currentItem[this.measureField];
        if (measureId) {
          this.measureId = measureId;
          this.fetchMeasure(measureId);
        }
      } catch (err) {
        console.error('[MeasurePreview] Error fetching current item:', err);
      }
    },

    async fetchMeasure(id) {
      if (!id || !this.api) return;
      
      this.loading = true;
      this.error = null;

      try {
        const response = await this.api.get(`/items/measures/${id}`, {
          params: {
            fields: this.fieldsToDisplay.join(',')
          }
        });
        
        if (response.data && response.data.data) {
          this.measureData = response.data.data;
        } else {
          this.measureData = response.data || {};
        }
        
      } catch (err) {
        console.error('[MeasurePreview] Error fetching measure:', err);
        this.error = err.message || this.$t('failed_to_fetch_measure_data');
        this.measureData = {};
      } finally {
        this.loading = false;
      }
    },

    getFieldLabel(fieldKey) {
      // Try to get the translated field name from the stores
      if (this.$stores) {
        try {
          const { useFieldsStore } = this.$stores();
          const fieldsStore = useFieldsStore();
          const field = fieldsStore.getField('measures', fieldKey);
          if (field && field.meta && field.meta.translations) {
            // Get the current locale
            const locale = this.$i18n?.locale || 'en-US';
            const translation = field.meta.translations.find(t => t.language === locale);
            if (translation && translation.translation) {
              return translation.translation;
            }
          }
          // Fallback to field name from meta
          if (field && field.meta && field.meta.field) {
            return field.meta.field;
          }
        } catch (e) {
          console.warn('Could not get field translation:', e);
        }
      }
      
      // Fallback to formatted field key
      return fieldKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  }
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
  font-size: 14px;
  color: var(--theme--foreground);
}

.field-content {
  color: var(--theme--foreground);
  font-size: 14px;
  line-height: 1.5;
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
</style>